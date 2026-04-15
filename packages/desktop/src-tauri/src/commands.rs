use std::collections::HashMap;
use std::collections::HashSet;

use tauri::Manager;

use crate::auto_mark::evaluate_auto_mark_rules;
use crate::git_ops;
use crate::types::*;
use crate::InitialSession;
use crate::RepoRegistry;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

fn now_iso() -> String {
    chrono::Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Millis, true)
}

/// Open a repository, either from an explicit path or by falling back to CWD.
fn open_repo_from(repo: &Option<String>) -> Result<git2::Repository, String> {
    match repo {
        Some(path) if !path.is_empty() => git_ops::open_repo_at(path),
        _ => git_ops::open_repo(),
    }
}

/// Resolve the repo path string: if provided, use it; otherwise derive from CWD repo.
fn resolve_repo_path(repo: &Option<String>) -> Result<String, String> {
    match repo {
        Some(path) if !path.is_empty() => Ok(path.clone()),
        _ => {
            let r = git_ops::open_repo()?;
            r.workdir()
                .map(|p| p.to_string_lossy().to_string())
                .ok_or_else(|| "Repository has no working directory".to_string())
        }
    }
}

// ---------------------------------------------------------------------------
// Refs
// ---------------------------------------------------------------------------

#[tauri::command]
pub fn fetch_refs(repo: Option<String>) -> Result<RefsResponse, String> {
    let repository = open_repo_from(&repo)?;
    let branches = git_ops::list_branches(&repository)?;
    let remote_branches = git_ops::list_remote_branches(&repository)?;
    let tags = git_ops::list_tags(&repository)?;
    let current_branch = git_ops::current_branch_name(&repository).unwrap_or_default();

    Ok(RefsResponse {
        branches,
        remote_branches,
        tags,
        current_branch,
    })
}

#[tauri::command]
pub fn resolve_refs(refs: Vec<String>, repo: Option<String>) -> Result<ResolveRefsResponse, String> {
    let repository = open_repo_from(&repo)?;
    let mut resolved = HashMap::new();
    for r in &refs {
        if let Ok(sha) = git_ops::resolve_ref(&repository, r) {
            resolved.insert(r.clone(), sha);
        }
    }
    Ok(ResolveRefsResponse { refs: resolved })
}

// ---------------------------------------------------------------------------
// Files & Diff
// ---------------------------------------------------------------------------

#[tauri::command]
pub fn fetch_files(
    base: Option<String>,
    head: Option<String>,
    uncommitted: Option<String>,
    repo: Option<String>,
) -> Result<FilesResponse, String> {
    let repo = open_repo_from(&repo)?;
    let is_uncommitted = uncommitted.as_deref() == Some("true");

    let files = if is_uncommitted {
        git_ops::get_uncommitted_changed_files(&repo)?
    } else {
        let b = base.as_deref().unwrap_or("main");
        let h = head.as_deref().unwrap_or("HEAD");
        git_ops::get_changed_files(&repo, b, h)?
    };

    let diff_text = if is_uncommitted {
        git_ops::get_uncommitted_diff_text(&repo)?
    } else {
        let b = base.as_deref().unwrap_or("main");
        let h = head.as_deref().unwrap_or("HEAD");
        git_ops::get_diff_text(&repo, b, h)?
    };

    let diff_hashes = git_ops::get_file_diff_hashes(&diff_text);

    Ok(FilesResponse {
        files,
        diff_hashes: Some(diff_hashes),
    })
}

#[tauri::command]
pub fn fetch_diff(
    base: Option<String>,
    head: Option<String>,
    uncommitted: Option<String>,
    repo: Option<String>,
) -> Result<DiffResponse, String> {
    let repo = open_repo_from(&repo)?;
    let is_uncommitted = uncommitted.as_deref() == Some("true");

    let diff = if is_uncommitted {
        git_ops::get_uncommitted_diff_text(&repo)?
    } else {
        let b = base.as_deref().unwrap_or("main");
        let h = head.as_deref().unwrap_or("HEAD");
        git_ops::get_diff_text(&repo, b, h)?
    };

    Ok(DiffResponse { diff })
}

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

#[tauri::command]
pub fn fetch_sessions(
    registry: tauri::State<'_, RepoRegistry>,
) -> Result<SessionListResponse, String> {
    let paths = registry.paths.lock().unwrap().clone();
    let mut sessions: Vec<ReviewData> = Vec::new();

    if paths.is_empty() {
        // Fallback to CWD when no repos are registered
        if let Ok(repo) = git_ops::open_repo() {
            let repo_path = repo.workdir().map(|p| p.to_string_lossy().to_string());
            let commit_shas = git_ops::list_review_notes(&repo)?;
            for sha in &commit_shas {
                if let Some(mut data) = git_ops::read_review_note(&repo, sha)? {
                    if data.session.repo_path.is_none() {
                        data.session.repo_path = repo_path.clone();
                    }
                    if data.session.head_commit_date.is_none() {
                        data.session.head_commit_date =
                            git_ops::get_commit_date(&repo, &data.session.head_commit).ok();
                    }
                    sessions.push(data);
                }
            }
        }
    } else {
        for repo_path in &paths {
            if let Ok(repo) = git_ops::open_repo_at(repo_path) {
                if let Ok(commit_shas) = git_ops::list_review_notes(&repo) {
                    for sha in &commit_shas {
                        if let Ok(Some(mut data)) = git_ops::read_review_note(&repo, sha) {
                            if data.session.repo_path.is_none() {
                                data.session.repo_path = Some(repo_path.clone());
                            }
                            if data.session.head_commit_date.is_none() {
                                data.session.head_commit_date =
                                    git_ops::get_commit_date(&repo, &data.session.head_commit).ok();
                            }
                            sessions.push(data);
                        }
                    }
                }
            }
        }
    }

    Ok(SessionListResponse { sessions })
}

#[tauri::command]
pub fn validate_sessions(
    registry: tauri::State<'_, RepoRegistry>,
) -> Result<ValidateSessionsResponse, String> {
    let paths = registry.paths.lock().unwrap().clone();
    let mut health: HashMap<String, SessionHealth> = HashMap::new();
    let mut stats: HashMap<String, SessionStats> = HashMap::new();

    let repos: Vec<(String, git2::Repository)> = if paths.is_empty() {
        match git_ops::open_repo() {
            Ok(repo) => {
                let rp = repo
                    .workdir()
                    .map(|p| p.to_string_lossy().to_string())
                    .unwrap_or_default();
                vec![(rp, repo)]
            }
            Err(_) => vec![],
        }
    } else {
        paths
            .iter()
            .filter_map(|p| git_ops::open_repo_at(p).ok().map(|r| (p.clone(), r)))
            .collect()
    };

    for (_repo_path, repo) in &repos {
        let commit_shas = match git_ops::list_review_notes(repo) {
            Ok(shas) => shas,
            Err(_) => continue,
        };

        for sha in &commit_shas {
            let data = match git_ops::read_review_note(repo, sha) {
                Ok(Some(d)) => d,
                _ => continue,
            };

            let base_ref = &data.session.base_ref;
            let head_ref = &data.session.head_ref;

            let base_resolved = repo
                .revparse_single(base_ref)
                .ok()
                .and_then(|o| o.peel_to_commit().ok())
                .map(|c| c.id());
            let head_resolved = repo
                .revparse_single(head_ref)
                .ok()
                .and_then(|o| o.peel_to_commit().ok())
                .map(|c| c.id());

            match (base_resolved, head_resolved) {
                (None, None) => {
                    health.insert(
                        sha.clone(),
                        SessionHealth::Stale {
                            reason: SessionHealthReason::BothRefsMissing,
                        },
                    );
                }
                (None, Some(_)) => {
                    health.insert(
                        sha.clone(),
                        SessionHealth::Stale {
                            reason: SessionHealthReason::BaseRefMissing,
                        },
                    );
                }
                (Some(_), None) => {
                    health.insert(
                        sha.clone(),
                        SessionHealth::Stale {
                            reason: SessionHealthReason::HeadRefMissing,
                        },
                    );
                }
                (Some(base_oid), Some(head_oid)) => {
                    if base_oid == head_oid {
                        health.insert(
                            sha.clone(),
                            SessionHealth::Stale {
                                reason: SessionHealthReason::NoChanges,
                            },
                        );
                    } else {
                        health.insert(sha.clone(), SessionHealth::Ok);

                        // Compute lightweight diff stats
                        if let Ok(files) = git_ops::get_changed_files(repo, base_ref, head_ref) {
                            let mut additions: i64 = 0;
                            let mut deletions: i64 = 0;
                            for f in &files {
                                additions += f.additions;
                                deletions += f.deletions;
                            }
                            stats.insert(
                                sha.clone(),
                                SessionStats {
                                    files: files.len(),
                                    additions,
                                    deletions,
                                },
                            );
                        }
                    }
                }
            }
        }
    }

    Ok(ValidateSessionsResponse { health, stats })
}

#[tauri::command]
pub fn fetch_session(
    commit_sha: String,
    repo: Option<String>,
    registry: tauri::State<'_, RepoRegistry>,
) -> Result<ReviewData, String> {
    // If repo is specified, use it directly. Otherwise search all registered repos.
    if let Some(ref path) = repo {
        if !path.is_empty() {
            let repository = git_ops::open_repo_at(path)?;
            return match git_ops::read_review_note(&repository, &commit_sha)? {
                Some(mut data) => {
                    if data.session.repo_path.is_none() {
                        data.session.repo_path = Some(path.clone());
                    }
                    Ok(data)
                }
                None => Err("Review session not found".to_string()),
            };
        }
    }

    // Search across all registered repos
    let paths = registry.paths.lock().unwrap().clone();
    for path in &paths {
        if let Ok(repository) = git_ops::open_repo_at(path) {
            if let Ok(Some(mut data)) = git_ops::read_review_note(&repository, &commit_sha) {
                if data.session.repo_path.is_none() {
                    data.session.repo_path = Some(path.clone());
                }
                return Ok(data);
            }
        }
    }

    // Fallback to CWD
    let repository = git_ops::open_repo()?;
    match git_ops::read_review_note(&repository, &commit_sha)? {
        Some(data) => Ok(data),
        None => Err("Review session not found".to_string()),
    }
}

#[tauri::command]
pub fn create_session(
    title: String,
    base_ref: String,
    head_ref: String,
    repo: Option<String>,
) -> Result<ReviewData, String> {
    let repository = open_repo_from(&repo)?;
    let repo_path = resolve_repo_path(&repo)?;

    let base_commit = git_ops::resolve_ref(&repository, &base_ref)?;
    let head_commit = git_ops::resolve_ref(&repository, &head_ref)?;
    let head_commit_date = git_ops::get_commit_date(&repository, &head_commit).ok();

    let now = now_iso();

    let data = ReviewData {
        version: 1,
        session: ReviewSession {
            id: uuid::Uuid::new_v4().to_string(),
            title,
            base_ref,
            head_ref,
            base_commit,
            head_commit: head_commit.clone(),
            head_commit_date,
            status: ReviewStatus::Pending,
            created_at: now.clone(),
            updated_at: now,
            repo_path: Some(repo_path),
        },
        comments: Vec::new(),
        viewed_files: None,
        auto_mark_rules: None,
    };

    git_ops::write_review_note(&repository, &head_commit, &data)?;
    Ok(data)
}

#[tauri::command]
pub fn delete_session(commit_sha: String, repo: Option<String>) -> Result<(), String> {
    let repository = open_repo_from(&repo)?;

    // Verify session exists
    match git_ops::read_review_note(&repository, &commit_sha)? {
        Some(_) => {}
        None => return Err("Review session not found".to_string()),
    }

    git_ops::remove_review_note(&repository, &commit_sha)?;
    Ok(())
}

#[tauri::command]
pub fn update_session_status(
    commit_sha: String,
    status: String,
    repo: Option<String>,
) -> Result<ReviewSession, String> {
    let repo = open_repo_from(&repo)?;

    let review_status = match status.as_str() {
        "pending" => ReviewStatus::Pending,
        "approved" => ReviewStatus::Approved,
        "changes_requested" => ReviewStatus::ChangesRequested,
        _ => {
            return Err(format!(
                "Invalid status: must be one of pending, approved, changes_requested"
            ))
        }
    };

    let mut data = git_ops::read_review_note(&repo, &commit_sha)?
        .ok_or_else(|| "Review session not found".to_string())?;

    data.session.status = review_status;
    data.session.updated_at = now_iso();
    git_ops::write_review_note(&repo, &commit_sha, &data)?;

    Ok(data.session)
}

// ---------------------------------------------------------------------------
// Comments
// ---------------------------------------------------------------------------

#[tauri::command]
pub fn post_comment(
    commit_sha: String,
    file: String,
    line: i64,
    side: Option<String>,
    body: String,
    author: Option<String>,
    repo: Option<String>,
) -> Result<ReviewComment, String> {
    let repo = open_repo_from(&repo)?;

    let mut data = git_ops::read_review_note(&repo, &commit_sha)?
        .ok_or_else(|| "Review session not found".to_string())?;

    let comment_side = match side.as_deref().unwrap_or("right") {
        "left" => CommentSide::Left,
        "right" => CommentSide::Right,
        _ => return Err("Invalid side: must be 'left' or 'right'".to_string()),
    };

    let comment = ReviewComment {
        id: uuid::Uuid::new_v4().to_string(),
        file,
        line,
        side: comment_side,
        body,
        author: author.unwrap_or_else(|| "reviewer".to_string()),
        created_at: now_iso(),
        resolved: false,
    };

    data.comments.push(comment.clone());
    data.session.updated_at = now_iso();
    git_ops::write_review_note(&repo, &commit_sha, &data)?;

    Ok(comment)
}

#[tauri::command]
pub fn patch_comment(
    commit_sha: String,
    comment_id: String,
    resolved: bool,
    repo: Option<String>,
) -> Result<ReviewComment, String> {
    let repo = open_repo_from(&repo)?;

    let mut data = git_ops::read_review_note(&repo, &commit_sha)?
        .ok_or_else(|| "Review session not found".to_string())?;

    let comment = data
        .comments
        .iter_mut()
        .find(|c| c.id == comment_id)
        .ok_or_else(|| "Comment not found".to_string())?;

    comment.resolved = resolved;
    let updated_comment = comment.clone();

    data.session.updated_at = now_iso();
    git_ops::write_review_note(&repo, &commit_sha, &data)?;

    Ok(updated_comment)
}

#[tauri::command]
pub fn delete_comment(
    commit_sha: String,
    comment_id: String,
    repo: Option<String>,
) -> Result<(), String> {
    let repo = open_repo_from(&repo)?;

    let mut data = git_ops::read_review_note(&repo, &commit_sha)?
        .ok_or_else(|| "Review session not found".to_string())?;

    let index = data
        .comments
        .iter()
        .position(|c| c.id == comment_id)
        .ok_or_else(|| "Comment not found".to_string())?;

    data.comments.remove(index);
    data.session.updated_at = now_iso();
    git_ops::write_review_note(&repo, &commit_sha, &data)?;

    Ok(())
}

// ---------------------------------------------------------------------------
// Viewed files
// ---------------------------------------------------------------------------

#[tauri::command]
pub fn mark_file_viewed(commit_sha: String, path: String, repo: Option<String>) -> Result<ViewedFile, String> {
    let repo = open_repo_from(&repo)?;

    let mut data = git_ops::read_review_note(&repo, &commit_sha)?
        .ok_or_else(|| "Review session not found".to_string())?;

    // Compute the current diff hash for this file
    let diff_text = git_ops::get_diff_text(&repo, &data.session.base_ref, &data.session.head_ref)?;
    let diff_hashes = git_ops::get_file_diff_hashes(&diff_text);
    let diff_hash = diff_hashes.get(&path).cloned().unwrap_or_default();

    let viewed_file = ViewedFile {
        path: path.clone(),
        viewed_at: now_iso(),
        diff_hash,
        auto_marked_by: None,
    };

    let viewed_files = data.viewed_files.get_or_insert_with(Vec::new);
    if let Some(idx) = viewed_files.iter().position(|vf| vf.path == path) {
        viewed_files[idx] = viewed_file.clone();
    } else {
        viewed_files.push(viewed_file.clone());
    }

    data.session.updated_at = now_iso();
    git_ops::write_review_note(&repo, &commit_sha, &data)?;

    Ok(viewed_file)
}

#[tauri::command]
pub fn unmark_file_viewed(commit_sha: String, path: String, repo: Option<String>) -> Result<(), String> {
    let repo = open_repo_from(&repo)?;

    let mut data = git_ops::read_review_note(&repo, &commit_sha)?
        .ok_or_else(|| "Review session not found".to_string())?;

    if let Some(ref mut viewed_files) = data.viewed_files {
        viewed_files.retain(|vf| vf.path != path);
    }

    data.session.updated_at = now_iso();
    git_ops::write_review_note(&repo, &commit_sha, &data)?;

    Ok(())
}

// ---------------------------------------------------------------------------
// Auto-mark rules
// ---------------------------------------------------------------------------

#[tauri::command]
pub fn update_auto_mark_rules(
    commit_sha: String,
    rules: Vec<AutoMarkRule>,
    repo: Option<String>,
) -> Result<AutoMarkRulesResponse, String> {
    let repo = open_repo_from(&repo)?;

    let mut data = git_ops::read_review_note(&repo, &commit_sha)?
        .ok_or_else(|| "Review session not found".to_string())?;

    data.auto_mark_rules = Some(rules.clone());

    // Evaluate rules against current files
    let files = git_ops::get_changed_files(&repo, &data.session.base_ref, &data.session.head_ref)?;
    let diff_text = git_ops::get_diff_text(&repo, &data.session.base_ref, &data.session.head_ref)?;
    let diff_hashes = git_ops::get_file_diff_hashes(&diff_text);
    let matches = evaluate_auto_mark_rules(&files, &diff_text, &rules);

    let now = now_iso();
    let auto_marked: Vec<ViewedFile> = matches
        .iter()
        .map(|m| ViewedFile {
            path: m.path.clone(),
            viewed_at: now.clone(),
            diff_hash: diff_hashes.get(&m.path).cloned().unwrap_or_default(),
            auto_marked_by: Some(m.rule.clone()),
        })
        .collect();

    // Merge: keep manually-marked files, remove stale auto-marked, add new auto-marked
    let viewed_files = data.viewed_files.take().unwrap_or_default();
    let manually_viewed: Vec<ViewedFile> = viewed_files
        .into_iter()
        .filter(|vf| vf.auto_marked_by.is_none())
        .collect();
    let auto_marked_paths: HashSet<String> = auto_marked.iter().map(|vf| vf.path.clone()).collect();
    let kept: Vec<ViewedFile> = manually_viewed
        .into_iter()
        .filter(|vf| !auto_marked_paths.contains(&vf.path))
        .collect();

    let mut final_viewed = kept;
    final_viewed.extend(auto_marked.clone());
    data.viewed_files = Some(final_viewed);
    data.session.updated_at = now;
    git_ops::write_review_note(&repo, &commit_sha, &data)?;

    Ok(AutoMarkRulesResponse {
        rules,
        auto_marked,
    })
}

#[tauri::command]
pub fn apply_auto_mark_rules(commit_sha: String, repo: Option<String>) -> Result<AutoMarkApplyResponse, String> {
    let repo = open_repo_from(&repo)?;

    let mut data = git_ops::read_review_note(&repo, &commit_sha)?
        .ok_or_else(|| "Review session not found".to_string())?;

    let rules = data.auto_mark_rules.clone().unwrap_or_default();
    let files = git_ops::get_changed_files(&repo, &data.session.base_ref, &data.session.head_ref)?;
    let diff_text = git_ops::get_diff_text(&repo, &data.session.base_ref, &data.session.head_ref)?;
    let diff_hashes = git_ops::get_file_diff_hashes(&diff_text);
    let matches = evaluate_auto_mark_rules(&files, &diff_text, &rules);

    let now = now_iso();
    let auto_marked: Vec<ViewedFile> = matches
        .iter()
        .map(|m| ViewedFile {
            path: m.path.clone(),
            viewed_at: now.clone(),
            diff_hash: diff_hashes.get(&m.path).cloned().unwrap_or_default(),
            auto_marked_by: Some(m.rule.clone()),
        })
        .collect();

    // Merge: keep manually-marked, replace auto-marked
    let viewed_files = data.viewed_files.take().unwrap_or_default();
    let manually_viewed: Vec<ViewedFile> = viewed_files
        .into_iter()
        .filter(|vf| vf.auto_marked_by.is_none())
        .collect();
    let auto_marked_paths: HashSet<String> = auto_marked.iter().map(|vf| vf.path.clone()).collect();
    let kept: Vec<ViewedFile> = manually_viewed
        .into_iter()
        .filter(|vf| !auto_marked_paths.contains(&vf.path))
        .collect();

    let mut final_viewed = kept;
    final_viewed.extend(auto_marked.clone());
    data.viewed_files = Some(final_viewed);
    data.session.updated_at = now;
    git_ops::write_review_note(&repo, &commit_sha, &data)?;

    Ok(AutoMarkApplyResponse { auto_marked })
}

// ---------------------------------------------------------------------------
// Commits
// ---------------------------------------------------------------------------

#[tauri::command]
pub fn fetch_commits(commit_sha: String, repo: Option<String>) -> Result<CommitsResponse, String> {
    let repo = open_repo_from(&repo)?;

    let data = git_ops::read_review_note(&repo, &commit_sha)?
        .ok_or_else(|| "Review session not found".to_string())?;

    let commits = git_ops::get_commit_list(
        &repo,
        &data.session.base_commit,
        &data.session.head_commit,
    )?;

    Ok(CommitsResponse { commits })
}

#[tauri::command]
pub fn fetch_commit_diff(commit_hash: String, repo: Option<String>) -> Result<DiffResponse, String> {
    let repo = open_repo_from(&repo)?;
    let diff = git_ops::get_commit_diff_text(&repo, &commit_hash)?;
    Ok(DiffResponse { diff })
}

#[tauri::command]
pub fn fetch_commit_files(commit_hash: String, repo: Option<String>) -> Result<FilesResponse, String> {
    let repo = open_repo_from(&repo)?;
    let files = git_ops::get_commit_changed_files(&repo, &commit_hash)?;
    let diff_text = git_ops::get_commit_diff_text(&repo, &commit_hash)?;
    let diff_hashes = git_ops::get_file_diff_hashes(&diff_text);

    Ok(FilesResponse {
        files,
        diff_hashes: Some(diff_hashes),
    })
}

// ---------------------------------------------------------------------------
// Install CLI
// ---------------------------------------------------------------------------

#[tauri::command]
pub fn install_cli() -> Result<String, String> {
    let bin_dir = dirs::home_dir()
        .ok_or_else(|| "Could not determine home directory".to_string())?
        .join(".local")
        .join("bin");

    std::fs::create_dir_all(&bin_dir)
        .map_err(|e| format!("Failed to create {}: {}", bin_dir.display(), e))?;

    let target_path = bin_dir.join("git-reviewer");

    // Determine the app binary path.
    // In a bundled macOS .app, current_exe() points to Contents/MacOS/<binary>.
    // We use the actual running binary so it works both in dev and production.
    let exe_path = std::env::current_exe()
        .map_err(|e| format!("Failed to determine executable path: {}", e))?
        .canonicalize()
        .map_err(|e| format!("Failed to canonicalize executable path: {}", e))?;

    // On macOS, if inside a .app bundle, use `open` to launch (forks automatically).
    // Otherwise run the binary directly in background.
    let script_content = if cfg!(windows) {
        format!("@echo off\r\nstart \"\" \"{}\" %*\r\n", exe_path.display())
    } else if cfg!(target_os = "macos") {
        // Walk up from Contents/MacOS/<binary> to find the .app bundle
        let app_bundle = exe_path
            .parent() // MacOS/
            .and_then(|p| p.parent()) // Contents/
            .and_then(|p| p.parent()) // *.app/
            .filter(|p| p.extension().is_some_and(|ext| ext == "app"));

        if let Some(app_path) = app_bundle {
            format!(
                "#!/bin/sh\nopen -a \"{}\" --args --repo \"$(pwd)\" \"$@\"\n",
                app_path.display()
            )
        } else {
            format!(
                "#!/bin/sh\n\"{}\" \"$@\" &\ndisown\n",
                exe_path.display()
            )
        }
    } else {
        format!(
            "#!/bin/sh\n\"{}\" \"$@\" &\ndisown\n",
            exe_path.display()
        )
    };

    let target_file = if cfg!(windows) {
        target_path.with_extension("cmd")
    } else {
        target_path.clone()
    };

    // Remove existing file/symlink if present
    if target_file.exists() || target_file.is_symlink() {
        std::fs::remove_file(&target_file)
            .map_err(|e| format!("Failed to remove existing {}: {}", target_file.display(), e))?;
    }

    std::fs::write(&target_file, &script_content)
        .map_err(|e| format!("Failed to write {}: {}", target_file.display(), e))?;

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        std::fs::set_permissions(&target_file, std::fs::Permissions::from_mode(0o755))
            .map_err(|e| format!("Failed to set permissions on {}: {}", target_file.display(), e))?;
    }

    Ok(format!(
        "CLI installed at {}",
        target_file.display()
    ))
}

// ---------------------------------------------------------------------------
// CLI support
// ---------------------------------------------------------------------------

/// Create a review session from CLI arguments (called during app setup, not a Tauri command).
pub fn create_session_from_cli(base_ref: &str, head_ref: &str) -> Result<String, String> {
    let repo = git_ops::open_repo()?;
    let repo_path = repo.workdir().map(|p| p.to_string_lossy().to_string());

    let base_commit = git_ops::resolve_ref(&repo, base_ref)?;
    let head_commit = git_ops::resolve_ref(&repo, head_ref)?;
    let head_commit_date = git_ops::get_commit_date(&repo, &head_commit).ok();

    // Resolve human-friendly names: replace "HEAD" with the current branch name
    let display_head = if head_ref.eq_ignore_ascii_case("HEAD") {
        git_ops::current_branch_name(&repo).unwrap_or_else(|| "HEAD".to_string())
    } else {
        head_ref.to_string()
    };
    let display_base = if base_ref.eq_ignore_ascii_case("HEAD") {
        git_ops::current_branch_name(&repo).unwrap_or_else(|| "HEAD".to_string())
    } else {
        base_ref.to_string()
    };
    let title = format!("Review {}..{}", display_base, display_head);
    let now = now_iso();

    let data = ReviewData {
        version: 1,
        session: ReviewSession {
            id: uuid::Uuid::new_v4().to_string(),
            title,
            base_ref: base_ref.to_string(),
            head_ref: head_ref.to_string(),
            base_commit,
            head_commit: head_commit.clone(),
            head_commit_date,
            status: ReviewStatus::Pending,
            created_at: now.clone(),
            updated_at: now,
            repo_path,
        },
        comments: Vec::new(),
        viewed_files: None,
        auto_mark_rules: None,
    };

    git_ops::write_review_note(&repo, &head_commit, &data)?;
    Ok(head_commit)
}

/// Returns the commit SHA of the session auto-created from CLI args, if any.
#[tauri::command]
pub fn get_initial_session(
    state: tauri::State<'_, InitialSession>,
) -> Result<Option<String>, String> {
    let guard = state
        .0
        .lock()
        .map_err(|e| format!("Failed to read initial session state: {}", e))?;
    Ok(guard.clone())
}

// ---------------------------------------------------------------------------
// Repository selection
// ---------------------------------------------------------------------------

/// Check if the current working directory is inside a git repository.
#[tauri::command]
pub fn get_current_repo() -> Result<Option<String>, String> {
    match git_ops::open_repo() {
        Ok(repo) => {
            let path = repo
                .workdir()
                .map(|p| p.to_string_lossy().to_string())
                .unwrap_or_default();
            Ok(Some(path))
        }
        Err(_) => Ok(None),
    }
}

/// Set the working directory to the given path (must be a git repository).
/// Also registers the repo in the registry.
#[tauri::command]
pub fn select_repository(
    path: String,
    registry: tauri::State<'_, RepoRegistry>,
) -> Result<String, String> {
    let p = std::path::Path::new(&path);
    if !p.exists() || !p.is_dir() {
        return Err(format!("Path does not exist or is not a directory: {}", path));
    }
    // Verify it's a git repo
    git2::Repository::discover(p)
        .map_err(|e| format!("Not a git repository: {}", e))?;
    std::env::set_current_dir(p)
        .map_err(|e| format!("Failed to set working directory: {}", e))?;

    let mut paths = registry.paths.lock().unwrap();
    if !paths.contains(&path) {
        paths.push(path.clone());
    }
    drop(paths);
    registry.save();

    Ok(path)
}

/// Open a review session in a new window.
#[tauri::command]
pub fn open_session_window(
    app: tauri::AppHandle,
    commit_sha: String,
    title: Option<String>,
) -> Result<(), String> {
    let label = format!("session-{}", &commit_sha[..7.min(commit_sha.len())]);
    let url = format!("/session/{}", commit_sha);
    let window_title = title.unwrap_or_else(|| format!("Review {}", &commit_sha[..7.min(commit_sha.len())]));

    // Check if window already exists, and focus it
    if let Some(window) = app.get_webview_window(&label) {
        window.set_focus().map_err(|e| format!("Failed to focus window: {}", e))?;
        return Ok(());
    }

    tauri::WebviewWindowBuilder::new(&app, &label, tauri::WebviewUrl::App(url.into()))
        .title(&window_title)
        .inner_size(1200.0, 800.0)
        .resizable(true)
        .build()
        .map_err(|e| format!("Failed to create window: {}", e))?;

    Ok(())
}

/// List all registered repository paths.
#[tauri::command]
pub fn list_repos(registry: tauri::State<'_, RepoRegistry>) -> Result<ReposResponse, String> {
    let paths = registry.paths.lock().unwrap().clone();
    Ok(ReposResponse { repos: paths })
}

/// Register a new repository path.
#[tauri::command]
pub fn register_repo(
    path: String,
    registry: tauri::State<'_, RepoRegistry>,
) -> Result<String, String> {
    let p = std::path::Path::new(&path);
    if !p.exists() || !p.is_dir() {
        return Err(format!("Path does not exist or is not a directory: {}", path));
    }
    // Verify it's a git repo
    git2::Repository::discover(p)
        .map_err(|e| format!("Not a git repository: {}", e))?;

    let mut paths = registry.paths.lock().unwrap();
    if !paths.contains(&path) {
        paths.push(path.clone());
    }
    drop(paths);
    registry.save();

    Ok(path)
}

/// Remove a repository from the registry.
#[tauri::command]
pub fn unregister_repo(
    path: String,
    registry: tauri::State<'_, RepoRegistry>,
) -> Result<(), String> {
    let mut paths = registry.paths.lock().unwrap();
    let before = paths.len();
    paths.retain(|p| p != &path);
    if paths.len() == before {
        return Err(format!("Repository not registered: {}", path));
    }
    drop(paths);
    registry.save();
    Ok(())
}
