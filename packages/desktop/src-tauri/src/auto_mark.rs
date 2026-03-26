use regex::Regex;
use std::collections::{HashMap, HashSet};

use crate::types::{AutoMarkRule, DiffFile, FileStatus};

/// Result of a single auto-mark evaluation.
pub struct AutoMarkMatch {
    pub path: String,
    pub rule: AutoMarkRule,
}

/// Known lock-file basenames.
const LOCKFILE_NAMES: &[&str] = &[
    "package-lock.json",
    "yarn.lock",
    "pnpm-lock.yaml",
    "Gemfile.lock",
    "Pipfile.lock",
    "poetry.lock",
    "composer.lock",
    "Cargo.lock",
    "go.sum",
    "flake.lock",
    "bun.lockb",
    "bun.lock",
];

/// Evaluate the given auto-mark rules against a set of diff files.
/// Returns an array of matches (one per file that satisfies at least one rule).
/// Each file appears at most once, matched by the first applicable rule.
pub fn evaluate_auto_mark_rules(
    files: &[DiffFile],
    diff_text: &str,
    rules: &[AutoMarkRule],
) -> Vec<AutoMarkMatch> {
    if rules.is_empty() {
        return Vec::new();
    }

    // Pre-parse per-file diff sections for content-based rules
    let needs_sections = rules.iter().any(|r| {
        matches!(r, AutoMarkRule::ImportOnly | AutoMarkRule::WhitespaceOnly)
    });
    let file_diff_sections = if needs_sections {
        parse_file_diff_sections(diff_text)
    } else {
        HashMap::new()
    };

    let mut matches = Vec::new();
    let mut matched_paths = HashSet::new();

    for rule in rules {
        for file in files {
            if matched_paths.contains(&file.path) {
                continue;
            }

            let section = file_diff_sections.get(&file.path).map(|s| s.as_str()).unwrap_or("");
            if evaluate_single_rule(rule, file, section) {
                matches.push(AutoMarkMatch {
                    path: file.path.clone(),
                    rule: rule.clone(),
                });
                matched_paths.insert(file.path.clone());
            }
        }
    }

    matches
}

fn evaluate_single_rule(rule: &AutoMarkRule, file: &DiffFile, diff_section: &str) -> bool {
    match rule {
        AutoMarkRule::RenameOnly => {
            file.status == FileStatus::Renamed && file.additions == 0 && file.deletions == 0
        }
        AutoMarkRule::Lockfile => is_lockfile(&file.path),
        AutoMarkRule::Generated => is_generated(&file.path),
        AutoMarkRule::ImportOnly => is_import_only(diff_section),
        AutoMarkRule::WhitespaceOnly => is_whitespace_only(diff_section),
    }
}

fn is_lockfile(file_path: &str) -> bool {
    let basename = file_path.rsplit('/').next().unwrap_or("");
    LOCKFILE_NAMES.contains(&basename)
}

fn is_generated(file_path: &str) -> bool {
    let patterns: Vec<Regex> = vec![
        Regex::new(r"\.generated\.").unwrap(),
        Regex::new(r"\.min\.").unwrap(),
        Regex::new(r"(?:^|/)(dist|build|out|output|__generated__)/").unwrap(),
        Regex::new(r"\.d\.ts$").unwrap(),
        Regex::new(r"\.map$").unwrap(),
    ];
    patterns.iter().any(|p| p.is_match(file_path))
}

/// Check if all changed lines (additions/deletions) in a diff section
/// are import/require statements.
fn is_import_only(diff_section: &str) -> bool {
    if diff_section.is_empty() {
        return false;
    }

    let changed_lines = extract_changed_lines(diff_section);
    if changed_lines.is_empty() {
        return false;
    }

    let import_re = Regex::new(
        r"^\s*(import\b.*|export\b.*from\b.*|(?:const|let|var)\s+\S+\s*=\s*require\s*\(.*\)\s*;?\s*|require\s*\(.*\)\s*;?\s*)$"
    ).unwrap();

    changed_lines.iter().all(|line| import_re.is_match(line))
}

/// Check if stripping whitespace from added/removed lines yields no difference.
fn is_whitespace_only(diff_section: &str) -> bool {
    if diff_section.is_empty() {
        return false;
    }

    let lines: Vec<&str> = diff_section.lines().collect();
    let mut added: Vec<String> = Vec::new();
    let mut removed: Vec<String> = Vec::new();
    let mut in_hunk = false;

    for line in &lines {
        if line.starts_with("@@") {
            in_hunk = true;
            continue;
        }
        if !in_hunk {
            continue;
        }

        if line.starts_with('+') && !line.starts_with("+++") {
            added.push(line[1..].to_string());
        } else if line.starts_with('-') && !line.starts_with("---") {
            removed.push(line[1..].to_string());
        }
    }

    if added.is_empty() && removed.is_empty() {
        return false;
    }

    let normalise = |s: &str| -> String {
        let ws_re = Regex::new(r"\s+").unwrap();
        ws_re.replace_all(s, "").to_string()
    };

    let mut normalised_added: Vec<String> = added.iter().map(|s| normalise(s)).collect();
    let mut normalised_removed: Vec<String> = removed.iter().map(|s| normalise(s)).collect();
    normalised_added.sort();
    normalised_removed.sort();

    normalised_added.join("\n") == normalised_removed.join("\n")
}

/// Extract the content of added/removed lines (without the +/- prefix)
/// from a unified diff section.
fn extract_changed_lines(diff_section: &str) -> Vec<String> {
    let mut changed = Vec::new();
    let mut in_hunk = false;

    for line in diff_section.lines() {
        if line.starts_with("@@") {
            in_hunk = true;
            continue;
        }
        if !in_hunk {
            continue;
        }

        if (line.starts_with('+') && !line.starts_with("+++"))
            || (line.starts_with('-') && !line.starts_with("---"))
        {
            changed.push(line[1..].to_string());
        }
    }

    changed
}

/// Split a unified diff text into per-file sections keyed by file path.
fn parse_file_diff_sections(diff_text: &str) -> HashMap<String, String> {
    let mut result = HashMap::new();
    if diff_text.trim().is_empty() {
        return result;
    }

    // Split on "diff --git" boundaries
    let mut sections: Vec<String> = Vec::new();
    let mut current = String::new();

    for line in diff_text.lines() {
        if line.starts_with("diff --git ") {
            if !current.is_empty() {
                sections.push(current);
            }
            current = String::new();
        }
        current.push_str(line);
        current.push('\n');
    }
    if !current.is_empty() {
        sections.push(current);
    }

    for section in &sections {
        // Extract file path from "diff --git a/... b/..."
        if let Some(first_line) = section.lines().next() {
            if first_line.starts_with("diff --git a/") {
                if let Some(b_idx) = first_line.find(" b/") {
                    let file_path = &first_line[b_idx + 3..];
                    result.insert(file_path.to_string(), section.clone());
                }
            }
        }
    }

    result
}
