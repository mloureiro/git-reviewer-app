use std::collections::HashSet;

use crate::auto_mark::evaluate_auto_mark_rules;
use crate::git_ops;
use crate::types::*;
use crate::InitialSession;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

fn now_iso() -> String {
    chrono::Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Millis, true)
}

// ---------------------------------------------------------------------------
// Files & Diff
// ---------------------------------------------------------------------------

#[tauri::command]
pub fn fetch_files(
    base: Option<String>,
    head: Option<String>,
    uncommitted: Option<String>,
) -> Result<FilesResponse, String> {
    let repo = git_ops::open_repo()?;
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
) -> Result<DiffResponse, String> {
    let repo = git_ops::open_repo()?;
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
pub fn fetch_sessions() -> Result<SessionListResponse, String> {
    let repo = git_ops::open_repo()?;
    let commit_shas = git_ops::list_review_notes(&repo)?;
    let mut sessions: Vec<ReviewData> = Vec::new();

    for sha in &commit_shas {
        if let Some(data) = git_ops::read_review_note(&repo, sha)? {
            sessions.push(data);
        }
    }

    Ok(SessionListResponse { sessions })
}

#[tauri::command]
pub fn fetch_session(commit_sha: String) -> Result<ReviewData, String> {
    let repo = git_ops::open_repo()?;
    match git_ops::read_review_note(&repo, &commit_sha)? {
        Some(data) => Ok(data),
        None => Err("Review session not found".to_string()),
    }
}

#[tauri::command]
pub fn create_session(
    title: String,
    base_ref: String,
    head_ref: String,
) -> Result<ReviewData, String> {
    let repo = git_ops::open_repo()?;

    let base_commit = git_ops::resolve_ref(&repo, &base_ref)?;
    let head_commit = git_ops::resolve_ref(&repo, &head_ref)?;

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
            status: ReviewStatus::Pending,
            created_at: now.clone(),
            updated_at: now,
        },
        comments: Vec::new(),
        viewed_files: None,
        auto_mark_rules: None,
    };

    git_ops::write_review_note(&repo, &head_commit, &data)?;
    Ok(data)
}

#[tauri::command]
pub fn delete_session(commit_sha: String) -> Result<(), String> {
    let repo = git_ops::open_repo()?;

    // Verify session exists
    match git_ops::read_review_note(&repo, &commit_sha)? {
        Some(_) => {}
        None => return Err("Review session not found".to_string()),
    }

    git_ops::remove_review_note(&repo, &commit_sha)?;
    Ok(())
}

#[tauri::command]
pub fn update_session_status(
    commit_sha: String,
    status: String,
) -> Result<ReviewSession, String> {
    let repo = git_ops::open_repo()?;

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
) -> Result<ReviewComment, String> {
    let repo = git_ops::open_repo()?;

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
) -> Result<ReviewComment, String> {
    let repo = git_ops::open_repo()?;

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

// ---------------------------------------------------------------------------
// Viewed files
// ---------------------------------------------------------------------------

#[tauri::command]
pub fn mark_file_viewed(commit_sha: String, path: String) -> Result<ViewedFile, String> {
    let repo = git_ops::open_repo()?;

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
pub fn unmark_file_viewed(commit_sha: String, path: String) -> Result<(), String> {
    let repo = git_ops::open_repo()?;

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
) -> Result<AutoMarkRulesResponse, String> {
    let repo = git_ops::open_repo()?;

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
pub fn apply_auto_mark_rules(commit_sha: String) -> Result<AutoMarkApplyResponse, String> {
    let repo = git_ops::open_repo()?;

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
pub fn fetch_commits(commit_sha: String) -> Result<CommitsResponse, String> {
    let repo = git_ops::open_repo()?;

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
pub fn fetch_commit_diff(commit_hash: String) -> Result<DiffResponse, String> {
    let repo = git_ops::open_repo()?;
    let diff = git_ops::get_commit_diff_text(&repo, &commit_hash)?;
    Ok(DiffResponse { diff })
}

#[tauri::command]
pub fn fetch_commit_files(commit_hash: String) -> Result<FilesResponse, String> {
    let repo = git_ops::open_repo()?;
    let files = git_ops::get_commit_changed_files(&repo, &commit_hash)?;
    let diff_text = git_ops::get_commit_diff_text(&repo, &commit_hash)?;
    let diff_hashes = git_ops::get_file_diff_hashes(&diff_text);

    Ok(FilesResponse {
        files,
        diff_hashes: Some(diff_hashes),
    })
}

// ---------------------------------------------------------------------------
// CLI support
// ---------------------------------------------------------------------------

/// Create a review session from CLI arguments (called during app setup, not a Tauri command).
pub fn create_session_from_cli(base_ref: &str, head_ref: &str) -> Result<String, String> {
    let repo = git_ops::open_repo()?;

    let base_commit = git_ops::resolve_ref(&repo, base_ref)?;
    let head_commit = git_ops::resolve_ref(&repo, head_ref)?;

    let title = format!("{} -> {}", base_ref, head_ref);
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
            status: ReviewStatus::Pending,
            created_at: now.clone(),
            updated_at: now,
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
