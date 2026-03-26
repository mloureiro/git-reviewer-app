use git2::{DiffFindOptions, DiffFormat, DiffOptions, Oid, Patch, Repository, Sort};
use sha2::{Digest, Sha256};
use std::collections::HashMap;

use crate::types::{CommitInfo, DiffFile, FileStatus, ReviewData};

const NOTES_REF: &str = "refs/notes/git-reviewer";

/// Open the git repository at the current working directory.
pub fn open_repo() -> Result<Repository, String> {
    let cwd = std::env::current_dir().map_err(|e| format!("Failed to get cwd: {}", e))?;
    Repository::discover(&cwd).map_err(|e| format!("Failed to open git repository: {}", e))
}

/// Resolve a ref name (branch, tag, SHA, HEAD, etc.) to its full commit SHA.
pub fn resolve_ref(repo: &Repository, ref_name: &str) -> Result<String, String> {
    let obj = repo
        .revparse_single(ref_name)
        .map_err(|e| format!("Failed to resolve ref '{}': {}", ref_name, e))?;
    let commit = obj
        .peel_to_commit()
        .map_err(|e| format!("Ref '{}' does not point to a commit: {}", ref_name, e))?;
    Ok(commit.id().to_string())
}

// ---------------------------------------------------------------------------
// Diff helpers
// ---------------------------------------------------------------------------

/// Create a diff between two trees with rename detection.
fn diff_trees_with_renames<'a>(
    repo: &'a Repository,
    old_tree: Option<&git2::Tree<'a>>,
    new_tree: Option<&git2::Tree<'a>>,
) -> Result<git2::Diff<'a>, String> {
    let mut opts = DiffOptions::new();
    let mut diff = repo
        .diff_tree_to_tree(old_tree, new_tree, Some(&mut opts))
        .map_err(|e| format!("Failed to compute diff: {}", e))?;

    // Enable rename detection as a post-processing step
    let mut find_opts = DiffFindOptions::new();
    find_opts.renames(true);
    diff.find_similar(Some(&mut find_opts))
        .map_err(|e| format!("Failed to detect renames: {}", e))?;

    Ok(diff)
}

fn diff_to_text(diff: &git2::Diff) -> Result<String, String> {
    let mut text = String::new();
    diff.print(DiffFormat::Patch, |_delta, _hunk, line| {
        let origin = line.origin();
        match origin {
            '+' | '-' | ' ' => text.push(origin),
            _ => {}
        }
        if let Ok(content) = std::str::from_utf8(line.content()) {
            text.push_str(content);
        }
        true
    })
    .map_err(|e| format!("Failed to print diff: {}", e))?;

    Ok(text)
}

fn diff_to_files(diff: &git2::Diff) -> Result<Vec<DiffFile>, String> {
    let num_deltas = diff.deltas().len();
    let mut files = Vec::with_capacity(num_deltas);

    for i in 0..num_deltas {
        let delta = diff
            .get_delta(i)
            .ok_or_else(|| format!("Failed to get delta at index {}", i))?;

        let status = match delta.status() {
            git2::Delta::Added => FileStatus::Added,
            git2::Delta::Deleted => FileStatus::Deleted,
            git2::Delta::Renamed => FileStatus::Renamed,
            _ => FileStatus::Modified,
        };

        let new_path = delta
            .new_file()
            .path()
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_default();
        let old_path = if status == FileStatus::Renamed {
            delta
                .old_file()
                .path()
                .map(|p| p.to_string_lossy().to_string())
        } else {
            None
        };

        // Get line stats from patch
        let (additions, deletions) = match Patch::from_diff(diff, i) {
            Ok(Some(patch)) => {
                let (_, adds, dels) = patch.line_stats().unwrap_or((0, 0, 0));
                (adds as i64, dels as i64)
            }
            _ => (0, 0),
        };

        files.push(DiffFile {
            path: new_path,
            status,
            additions,
            deletions,
            old_path,
        });
    }

    Ok(files)
}

// ---------------------------------------------------------------------------
// Diff text
// ---------------------------------------------------------------------------

/// Get the unified diff text between two refs using the three-dot (merge-base) semantics.
pub fn get_diff_text(repo: &Repository, base: &str, head: &str) -> Result<String, String> {
    let base_oid = repo
        .revparse_single(base)
        .map_err(|e| format!("Failed to resolve base '{}': {}", base, e))?
        .peel_to_commit()
        .map_err(|e| format!("Base '{}' is not a commit: {}", base, e))?
        .id();
    let head_oid = repo
        .revparse_single(head)
        .map_err(|e| format!("Failed to resolve head '{}': {}", head, e))?
        .peel_to_commit()
        .map_err(|e| format!("Head '{}' is not a commit: {}", head, e))?
        .id();

    // Find merge base (three-dot semantics)
    let merge_base = repo.merge_base(base_oid, head_oid).unwrap_or(base_oid);

    let base_tree = repo
        .find_commit(merge_base)
        .and_then(|c| c.tree())
        .map_err(|e| format!("Failed to get base tree: {}", e))?;
    let head_tree = repo
        .find_commit(head_oid)
        .and_then(|c| c.tree())
        .map_err(|e| format!("Failed to get head tree: {}", e))?;

    let diff = diff_trees_with_renames(repo, Some(&base_tree), Some(&head_tree))?;
    diff_to_text(&diff)
}

/// Get the unified diff text for uncommitted changes (staged + unstaged).
pub fn get_uncommitted_diff_text(repo: &Repository) -> Result<String, String> {
    let head_commit = repo
        .head()
        .and_then(|r| r.peel_to_commit())
        .map_err(|e| format!("Failed to resolve HEAD: {}", e))?;
    let head_tree = head_commit
        .tree()
        .map_err(|e| format!("Failed to get HEAD tree: {}", e))?;

    let mut opts = DiffOptions::new();

    // staged: tree -> index
    let mut staged_diff = repo
        .diff_tree_to_index(Some(&head_tree), None, Some(&mut opts))
        .map_err(|e| format!("Failed to compute staged diff: {}", e))?;
    let mut find_opts = DiffFindOptions::new();
    find_opts.renames(true);
    staged_diff
        .find_similar(Some(&mut find_opts))
        .map_err(|e| format!("Failed to detect renames in staged diff: {}", e))?;

    // unstaged: index -> workdir
    let mut unstaged_diff = repo
        .diff_index_to_workdir(None, Some(&mut opts))
        .map_err(|e| format!("Failed to compute unstaged diff: {}", e))?;
    let mut find_opts2 = DiffFindOptions::new();
    find_opts2.renames(true);
    unstaged_diff
        .find_similar(Some(&mut find_opts2))
        .map_err(|e| format!("Failed to detect renames in unstaged diff: {}", e))?;

    let staged_text = diff_to_text(&staged_diff)?;
    let unstaged_text = diff_to_text(&unstaged_diff)?;

    let parts: Vec<&str> = [staged_text.as_str(), unstaged_text.as_str()]
        .into_iter()
        .filter(|s| !s.is_empty())
        .collect();

    Ok(parts.join("\n"))
}

// ---------------------------------------------------------------------------
// Changed files
// ---------------------------------------------------------------------------

/// Get the list of changed files between two refs (three-dot semantics).
pub fn get_changed_files(
    repo: &Repository,
    base: &str,
    head: &str,
) -> Result<Vec<DiffFile>, String> {
    let base_oid = repo
        .revparse_single(base)
        .map_err(|e| format!("Failed to resolve base '{}': {}", base, e))?
        .peel_to_commit()
        .map_err(|e| format!("Base '{}' is not a commit: {}", base, e))?
        .id();
    let head_oid = repo
        .revparse_single(head)
        .map_err(|e| format!("Failed to resolve head '{}': {}", head, e))?
        .peel_to_commit()
        .map_err(|e| format!("Head '{}' is not a commit: {}", head, e))?
        .id();

    let merge_base = repo.merge_base(base_oid, head_oid).unwrap_or(base_oid);

    let base_tree = repo
        .find_commit(merge_base)
        .and_then(|c| c.tree())
        .map_err(|e| format!("Failed to get base tree: {}", e))?;
    let head_tree = repo
        .find_commit(head_oid)
        .and_then(|c| c.tree())
        .map_err(|e| format!("Failed to get head tree: {}", e))?;

    let diff = diff_trees_with_renames(repo, Some(&base_tree), Some(&head_tree))?;
    diff_to_files(&diff)
}

/// Get the list of uncommitted changed files (staged + unstaged merged).
pub fn get_uncommitted_changed_files(repo: &Repository) -> Result<Vec<DiffFile>, String> {
    let head_commit = repo
        .head()
        .and_then(|r| r.peel_to_commit())
        .map_err(|e| format!("Failed to resolve HEAD: {}", e))?;
    let head_tree = head_commit
        .tree()
        .map_err(|e| format!("Failed to get HEAD tree: {}", e))?;

    let mut opts = DiffOptions::new();

    let mut staged_diff = repo
        .diff_tree_to_index(Some(&head_tree), None, Some(&mut opts))
        .map_err(|e| format!("Failed to compute staged diff: {}", e))?;
    let mut find_opts = DiffFindOptions::new();
    find_opts.renames(true);
    staged_diff
        .find_similar(Some(&mut find_opts))
        .map_err(|e| format!("Failed to detect renames: {}", e))?;

    let mut unstaged_diff = repo
        .diff_index_to_workdir(None, Some(&mut opts))
        .map_err(|e| format!("Failed to compute unstaged diff: {}", e))?;
    let mut find_opts2 = DiffFindOptions::new();
    find_opts2.renames(true);
    unstaged_diff
        .find_similar(Some(&mut find_opts2))
        .map_err(|e| format!("Failed to detect renames: {}", e))?;

    let staged_files = diff_to_files(&staged_diff)?;
    let unstaged_files = diff_to_files(&unstaged_diff)?;

    // Merge: staged takes precedence; add unstaged-only files
    let staged_paths: std::collections::HashSet<String> =
        staged_files.iter().map(|f| f.path.clone()).collect();
    let mut merged = staged_files;
    for file in unstaged_files {
        if !staged_paths.contains(&file.path) {
            merged.push(file);
        }
    }

    Ok(merged)
}

// ---------------------------------------------------------------------------
// Diff hashes
// ---------------------------------------------------------------------------

/// Split a unified diff by file and hash each file's diff section with SHA-256.
pub fn get_file_diff_hashes(diff_text: &str) -> HashMap<String, String> {
    let mut result = HashMap::new();

    if diff_text.trim().is_empty() {
        return result;
    }

    // Split on "diff --git" boundaries
    let sections = split_diff_sections(diff_text);

    for section in sections {
        if let Some(file_path) = extract_diff_file_path(section) {
            let mut hasher = Sha256::new();
            hasher.update(section.as_bytes());
            let hash = format!("{:x}", hasher.finalize());
            result.insert(file_path, hash);
        }
    }

    result
}

fn split_diff_sections(text: &str) -> Vec<&str> {
    let mut sections = Vec::new();
    let mut start = 0;
    let bytes = text.as_bytes();
    let marker = b"diff --git ";

    let mut i = 0;
    while i < bytes.len() {
        let is_boundary = if i == 0 {
            bytes[i..].starts_with(marker)
        } else if bytes[i] == b'\n' && i + 1 < bytes.len() {
            bytes[i + 1..].starts_with(marker)
        } else {
            false
        };

        if is_boundary && i > 0 {
            let end = if bytes[i] == b'\n' { i + 1 } else { i };
            let section = &text[start..end];
            if !section.is_empty() {
                sections.push(section);
            }
            start = end;
        }

        i += 1;
    }

    if start < text.len() {
        let section = &text[start..];
        if !section.is_empty() {
            sections.push(section);
        }
    }

    sections
}

fn extract_diff_file_path(section: &str) -> Option<String> {
    for line in section.lines() {
        if line.starts_with("diff --git a/") {
            if let Some(b_idx) = line.find(" b/") {
                let path = &line[b_idx + 3..];
                return Some(path.to_string());
            }
        }
    }
    None
}

// ---------------------------------------------------------------------------
// Git notes
// ---------------------------------------------------------------------------

pub fn read_review_note(
    repo: &Repository,
    commit_sha: &str,
) -> Result<Option<ReviewData>, String> {
    let oid = Oid::from_str(commit_sha)
        .map_err(|e| format!("Invalid commit SHA '{}': {}", commit_sha, e))?;

    match repo.find_note(Some(NOTES_REF), oid) {
        Ok(note) => {
            let message = note
                .message()
                .ok_or("Note message is not valid UTF-8")?;
            let data: ReviewData = serde_json::from_str(message)
                .map_err(|e| format!("Failed to parse review note: {}", e))?;
            Ok(Some(data))
        }
        Err(_) => Ok(None),
    }
}

pub fn write_review_note(
    repo: &Repository,
    commit_sha: &str,
    data: &ReviewData,
) -> Result<(), String> {
    let oid = Oid::from_str(commit_sha)
        .map_err(|e| format!("Invalid commit SHA '{}': {}", commit_sha, e))?;
    let json = serde_json::to_string_pretty(data)
        .map_err(|e| format!("Failed to serialize review data: {}", e))?;

    let sig = repo
        .signature()
        .map_err(|e| format!("Failed to get signature: {}", e))?;

    // force=true to overwrite existing note
    repo.note(&sig, &sig, Some(NOTES_REF), oid, &json, true)
        .map_err(|e| format!("Failed to write review note: {}", e))?;

    Ok(())
}

pub fn list_review_notes(repo: &Repository) -> Result<Vec<String>, String> {
    let mut commit_shas = Vec::new();

    match repo.notes(Some(NOTES_REF)) {
        Ok(notes) => {
            for note_result in notes {
                if let Ok((_note_oid, annotated_oid)) = note_result {
                    commit_shas.push(annotated_oid.to_string());
                }
            }
        }
        Err(_) => {
            // Notes ref doesn't exist yet
        }
    }

    Ok(commit_shas)
}

pub fn remove_review_note(repo: &Repository, commit_sha: &str) -> Result<(), String> {
    let oid = Oid::from_str(commit_sha)
        .map_err(|e| format!("Invalid commit SHA '{}': {}", commit_sha, e))?;

    let sig = repo
        .signature()
        .map_err(|e| format!("Failed to get signature: {}", e))?;

    let _ = repo.note_delete(oid, Some(NOTES_REF), &sig, &sig);

    Ok(())
}

// ---------------------------------------------------------------------------
// Commits
// ---------------------------------------------------------------------------

/// Returns the list of commits between base and head (exclusive of base), oldest-first.
pub fn get_commit_list(
    repo: &Repository,
    base: &str,
    head: &str,
) -> Result<Vec<CommitInfo>, String> {
    let base_oid = repo
        .revparse_single(base)
        .map_err(|e| format!("Failed to resolve base '{}': {}", base, e))?
        .peel_to_commit()
        .map_err(|e| format!("Base '{}' is not a commit: {}", base, e))?
        .id();
    let head_oid = repo
        .revparse_single(head)
        .map_err(|e| format!("Failed to resolve head '{}': {}", head, e))?
        .peel_to_commit()
        .map_err(|e| format!("Head '{}' is not a commit: {}", head, e))?
        .id();

    let mut revwalk = repo
        .revwalk()
        .map_err(|e| format!("Failed to create revwalk: {}", e))?;
    revwalk
        .push(head_oid)
        .map_err(|e| format!("Failed to push head to revwalk: {}", e))?;
    revwalk
        .hide(base_oid)
        .map_err(|e| format!("Failed to hide base in revwalk: {}", e))?;
    revwalk
        .set_sorting(Sort::TOPOLOGICAL | Sort::REVERSE)
        .map_err(|e| format!("Failed to set revwalk sorting: {}", e))?;

    let mut commits = Vec::new();
    for oid_result in revwalk {
        let oid = oid_result.map_err(|e| format!("Revwalk error: {}", e))?;
        let commit = repo
            .find_commit(oid)
            .map_err(|e| format!("Failed to find commit {}: {}", oid, e))?;

        let hash = commit.id().to_string();
        let short_hash = hash[..7.min(hash.len())].to_string();
        let message = commit.message().unwrap_or("").to_string();
        let author = commit.author().name().unwrap_or("").to_string();

        let time = commit.time();
        let secs = time.seconds();
        let offset_minutes = time.offset_minutes();
        let date = format_git_time(secs, offset_minutes);

        commits.push(CommitInfo {
            hash,
            short_hash,
            message,
            author,
            date,
        });
    }

    Ok(commits)
}

fn format_git_time(secs: i64, offset_minutes: i32) -> String {
    use chrono::{FixedOffset, TimeZone};

    let offset =
        FixedOffset::east_opt(offset_minutes * 60).unwrap_or(FixedOffset::east_opt(0).unwrap());
    let dt = offset.timestamp_opt(secs, 0);
    match dt {
        chrono::LocalResult::Single(dt) => dt.to_rfc3339(),
        _ => chrono::Utc
            .timestamp_opt(secs, 0)
            .single()
            .map(|d| d.to_rfc3339())
            .unwrap_or_default(),
    }
}

/// Returns the unified diff text for a single commit.
pub fn get_commit_diff_text(repo: &Repository, commit_hash: &str) -> Result<String, String> {
    let commit = repo
        .revparse_single(commit_hash)
        .map_err(|e| format!("Failed to resolve commit '{}': {}", commit_hash, e))?
        .peel_to_commit()
        .map_err(|e| format!("'{}' is not a commit: {}", commit_hash, e))?;

    let commit_tree = commit
        .tree()
        .map_err(|e| format!("Failed to get commit tree: {}", e))?;

    let parent_tree = if commit.parent_count() > 0 {
        Some(
            commit
                .parent(0)
                .and_then(|p| p.tree())
                .map_err(|e| format!("Failed to get parent tree: {}", e))?,
        )
    } else {
        None
    };

    let diff = diff_trees_with_renames(repo, parent_tree.as_ref(), Some(&commit_tree))?;
    diff_to_text(&diff)
}

/// Returns the list of files changed in a single commit.
pub fn get_commit_changed_files(
    repo: &Repository,
    commit_hash: &str,
) -> Result<Vec<DiffFile>, String> {
    let commit = repo
        .revparse_single(commit_hash)
        .map_err(|e| format!("Failed to resolve commit '{}': {}", commit_hash, e))?
        .peel_to_commit()
        .map_err(|e| format!("'{}' is not a commit: {}", commit_hash, e))?;

    let commit_tree = commit
        .tree()
        .map_err(|e| format!("Failed to get commit tree: {}", e))?;

    let parent_tree = if commit.parent_count() > 0 {
        Some(
            commit
                .parent(0)
                .and_then(|p| p.tree())
                .map_err(|e| format!("Failed to get parent tree: {}", e))?,
        )
    } else {
        None
    };

    let diff = diff_trees_with_renames(repo, parent_tree.as_ref(), Some(&commit_tree))?;
    diff_to_files(&diff)
}
