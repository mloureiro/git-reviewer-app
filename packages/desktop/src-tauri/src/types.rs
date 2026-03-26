use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum ReviewStatus {
    #[serde(rename = "pending")]
    Pending,
    #[serde(rename = "approved")]
    Approved,
    #[serde(rename = "changes_requested")]
    ChangesRequested,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum FileStatus {
    #[serde(rename = "added")]
    Added,
    #[serde(rename = "modified")]
    Modified,
    #[serde(rename = "deleted")]
    Deleted,
    #[serde(rename = "renamed")]
    Renamed,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum CommentSide {
    #[serde(rename = "left")]
    Left,
    #[serde(rename = "right")]
    Right,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum AutoMarkRule {
    #[serde(rename = "rename-only")]
    RenameOnly,
    #[serde(rename = "import-only")]
    ImportOnly,
    #[serde(rename = "whitespace-only")]
    WhitespaceOnly,
    #[serde(rename = "lockfile")]
    Lockfile,
    #[serde(rename = "generated")]
    Generated,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReviewComment {
    pub id: String,
    pub file: String,
    pub line: i64,
    pub side: CommentSide,
    pub body: String,
    pub author: String,
    pub created_at: String,
    pub resolved: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReviewSession {
    pub id: String,
    pub title: String,
    pub base_ref: String,
    pub head_ref: String,
    pub base_commit: String,
    pub head_commit: String,
    pub status: ReviewStatus,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ViewedFile {
    pub path: String,
    pub viewed_at: String,
    pub diff_hash: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub auto_marked_by: Option<AutoMarkRule>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReviewData {
    pub version: u32,
    pub session: ReviewSession,
    pub comments: Vec<ReviewComment>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub viewed_files: Option<Vec<ViewedFile>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub auto_mark_rules: Option<Vec<AutoMarkRule>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiffFile {
    pub path: String,
    pub status: FileStatus,
    pub additions: i64,
    pub deletions: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub old_path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CommitInfo {
    pub hash: String,
    pub short_hash: String,
    pub message: String,
    pub author: String,
    pub date: String,
}

// --- Response types ---

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FilesResponse {
    pub files: Vec<DiffFile>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub diff_hashes: Option<HashMap<String, String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiffResponse {
    pub diff: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionListResponse {
    pub sessions: Vec<ReviewData>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AutoMarkRulesResponse {
    pub rules: Vec<AutoMarkRule>,
    pub auto_marked: Vec<ViewedFile>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AutoMarkApplyResponse {
    pub auto_marked: Vec<ViewedFile>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommitsResponse {
    pub commits: Vec<CommitInfo>,
}
