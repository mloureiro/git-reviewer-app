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

// ---------------------------------------------------------------------------
// Serialization tests — verify JSON keys match the TypeScript frontend contract
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    // Helpers to build sample data

    fn sample_review_session() -> ReviewSession {
        ReviewSession {
            id: "session-uuid-1".into(),
            title: "Test Review".into(),
            base_ref: "main".into(),
            head_ref: "feature-branch".into(),
            base_commit: "aaaa1111".into(),
            head_commit: "bbbb2222".into(),
            status: ReviewStatus::Pending,
            created_at: "2026-03-19T10:00:00.000Z".into(),
            updated_at: "2026-03-19T10:00:00.000Z".into(),
        }
    }

    fn sample_review_comment() -> ReviewComment {
        ReviewComment {
            id: "comment-uuid-1".into(),
            file: "src/foo.ts".into(),
            line: 42,
            side: CommentSide::Right,
            body: "This needs fixing".into(),
            author: "reviewer".into(),
            created_at: "2026-03-19T10:05:00.000Z".into(),
            resolved: false,
        }
    }

    fn sample_viewed_file() -> ViewedFile {
        ViewedFile {
            path: "src/bar.ts".into(),
            viewed_at: "2026-03-19T10:10:00.000Z".into(),
            diff_hash: "abc123hash".into(),
            auto_marked_by: None,
        }
    }

    fn sample_diff_file() -> DiffFile {
        DiffFile {
            path: "src/foo.ts".into(),
            status: FileStatus::Modified,
            additions: 5,
            deletions: 2,
            old_path: None,
        }
    }

    fn sample_commit_info() -> CommitInfo {
        CommitInfo {
            hash: "aaa111bbb222ccc333ddd444eee555fff666aaa1".into(),
            short_hash: "aaa111b".into(),
            message: "feat: add new feature".into(),
            author: "Dev".into(),
            date: "2026-03-18T09:00:00.000Z".into(),
        }
    }

    // -----------------------------------------------------------------------
    // Enum serialization
    // -----------------------------------------------------------------------

    #[test]
    fn review_status_serializes_as_lowercase_string() {
        assert_eq!(serde_json::to_value(&ReviewStatus::Pending).unwrap(), "pending");
        assert_eq!(serde_json::to_value(&ReviewStatus::Approved).unwrap(), "approved");
        assert_eq!(
            serde_json::to_value(&ReviewStatus::ChangesRequested).unwrap(),
            "changes_requested"
        );
    }

    #[test]
    fn file_status_serializes_as_lowercase_string() {
        assert_eq!(serde_json::to_value(&FileStatus::Added).unwrap(), "added");
        assert_eq!(serde_json::to_value(&FileStatus::Modified).unwrap(), "modified");
        assert_eq!(serde_json::to_value(&FileStatus::Deleted).unwrap(), "deleted");
        assert_eq!(serde_json::to_value(&FileStatus::Renamed).unwrap(), "renamed");
    }

    #[test]
    fn comment_side_serializes_as_lowercase_string() {
        assert_eq!(serde_json::to_value(&CommentSide::Left).unwrap(), "left");
        assert_eq!(serde_json::to_value(&CommentSide::Right).unwrap(), "right");
    }

    #[test]
    fn auto_mark_rule_serializes_with_hyphens() {
        assert_eq!(serde_json::to_value(&AutoMarkRule::RenameOnly).unwrap(), "rename-only");
        assert_eq!(serde_json::to_value(&AutoMarkRule::ImportOnly).unwrap(), "import-only");
        assert_eq!(
            serde_json::to_value(&AutoMarkRule::WhitespaceOnly).unwrap(),
            "whitespace-only"
        );
        assert_eq!(serde_json::to_value(&AutoMarkRule::Lockfile).unwrap(), "lockfile");
        assert_eq!(serde_json::to_value(&AutoMarkRule::Generated).unwrap(), "generated");
    }

    // -----------------------------------------------------------------------
    // Struct serialization — camelCase keys
    // -----------------------------------------------------------------------

    #[test]
    fn review_session_uses_camel_case_keys() {
        let json = serde_json::to_value(&sample_review_session()).unwrap();
        let obj = json.as_object().unwrap();

        assert!(obj.contains_key("id"));
        assert!(obj.contains_key("title"));
        assert!(obj.contains_key("baseRef"));
        assert!(obj.contains_key("headRef"));
        assert!(obj.contains_key("baseCommit"));
        assert!(obj.contains_key("headCommit"));
        assert!(obj.contains_key("status"));
        assert!(obj.contains_key("createdAt"));
        assert!(obj.contains_key("updatedAt"));

        // Must NOT contain snake_case keys
        assert!(!obj.contains_key("base_ref"));
        assert!(!obj.contains_key("head_ref"));
        assert!(!obj.contains_key("base_commit"));
        assert!(!obj.contains_key("head_commit"));
        assert!(!obj.contains_key("created_at"));
        assert!(!obj.contains_key("updated_at"));
    }

    #[test]
    fn review_comment_uses_camel_case_keys() {
        let json = serde_json::to_value(&sample_review_comment()).unwrap();
        let obj = json.as_object().unwrap();

        assert!(obj.contains_key("id"));
        assert!(obj.contains_key("file"));
        assert!(obj.contains_key("line"));
        assert!(obj.contains_key("side"));
        assert!(obj.contains_key("body"));
        assert!(obj.contains_key("author"));
        assert!(obj.contains_key("createdAt"));
        assert!(obj.contains_key("resolved"));
        assert!(!obj.contains_key("created_at"));
    }

    #[test]
    fn viewed_file_uses_camel_case_and_skips_none_optional() {
        let vf = sample_viewed_file();
        let json = serde_json::to_value(&vf).unwrap();
        let obj = json.as_object().unwrap();

        assert!(obj.contains_key("path"));
        assert!(obj.contains_key("viewedAt"));
        assert!(obj.contains_key("diffHash"));
        assert!(!obj.contains_key("viewed_at"));
        assert!(!obj.contains_key("diff_hash"));

        // auto_marked_by is None, so it must be absent
        assert!(!obj.contains_key("autoMarkedBy"));
        assert!(!obj.contains_key("auto_marked_by"));
    }

    #[test]
    fn viewed_file_includes_auto_marked_by_when_some() {
        let vf = ViewedFile {
            auto_marked_by: Some(AutoMarkRule::Lockfile),
            ..sample_viewed_file()
        };
        let json = serde_json::to_value(&vf).unwrap();
        let obj = json.as_object().unwrap();

        assert!(obj.contains_key("autoMarkedBy"));
        assert_eq!(obj["autoMarkedBy"], "lockfile");
    }

    #[test]
    fn diff_file_uses_camel_case_and_skips_none_old_path() {
        let df = sample_diff_file();
        let json = serde_json::to_value(&df).unwrap();
        let obj = json.as_object().unwrap();

        assert!(obj.contains_key("path"));
        assert!(obj.contains_key("status"));
        assert!(obj.contains_key("additions"));
        assert!(obj.contains_key("deletions"));
        assert!(!obj.contains_key("old_path"));
        assert!(!obj.contains_key("oldPath")); // None => absent
    }

    #[test]
    fn diff_file_includes_old_path_when_some() {
        let df = DiffFile {
            status: FileStatus::Renamed,
            old_path: Some("src/legacy.ts".into()),
            ..sample_diff_file()
        };
        let json = serde_json::to_value(&df).unwrap();
        let obj = json.as_object().unwrap();

        assert!(obj.contains_key("oldPath"));
        assert_eq!(obj["oldPath"], "src/legacy.ts");
    }

    #[test]
    fn commit_info_uses_camel_case_keys() {
        let json = serde_json::to_value(&sample_commit_info()).unwrap();
        let obj = json.as_object().unwrap();

        assert!(obj.contains_key("hash"));
        assert!(obj.contains_key("shortHash"));
        assert!(obj.contains_key("message"));
        assert!(obj.contains_key("author"));
        assert!(obj.contains_key("date"));
        assert!(!obj.contains_key("short_hash"));
    }

    // -----------------------------------------------------------------------
    // ReviewData — optional fields skipped when None
    // -----------------------------------------------------------------------

    #[test]
    fn review_data_skips_optional_fields_when_none() {
        let data = ReviewData {
            version: 1,
            session: sample_review_session(),
            comments: vec![],
            viewed_files: None,
            auto_mark_rules: None,
        };
        let json = serde_json::to_value(&data).unwrap();
        let obj = json.as_object().unwrap();

        assert!(obj.contains_key("version"));
        assert!(obj.contains_key("session"));
        assert!(obj.contains_key("comments"));
        assert!(!obj.contains_key("viewedFiles"));
        assert!(!obj.contains_key("autoMarkRules"));
        assert!(!obj.contains_key("viewed_files"));
        assert!(!obj.contains_key("auto_mark_rules"));
    }

    #[test]
    fn review_data_includes_optional_fields_when_some() {
        let data = ReviewData {
            version: 1,
            session: sample_review_session(),
            comments: vec![sample_review_comment()],
            viewed_files: Some(vec![sample_viewed_file()]),
            auto_mark_rules: Some(vec![AutoMarkRule::Lockfile]),
        };
        let json = serde_json::to_value(&data).unwrap();
        let obj = json.as_object().unwrap();

        assert!(obj.contains_key("viewedFiles"));
        assert!(obj.contains_key("autoMarkRules"));
        assert_eq!(obj["version"], 1);
    }

    // -----------------------------------------------------------------------
    // Response types
    // -----------------------------------------------------------------------

    #[test]
    fn files_response_uses_camel_case_and_handles_optional_diff_hashes() {
        let resp = FilesResponse {
            files: vec![sample_diff_file()],
            diff_hashes: None,
        };
        let json = serde_json::to_value(&resp).unwrap();
        let obj = json.as_object().unwrap();

        assert!(obj.contains_key("files"));
        assert!(!obj.contains_key("diffHashes"));
        assert!(!obj.contains_key("diff_hashes"));

        // With diff_hashes present
        let mut hashes = HashMap::new();
        hashes.insert("src/foo.ts".to_string(), "hash123".to_string());
        let resp2 = FilesResponse {
            files: vec![sample_diff_file()],
            diff_hashes: Some(hashes),
        };
        let json2 = serde_json::to_value(&resp2).unwrap();
        let obj2 = json2.as_object().unwrap();
        assert!(obj2.contains_key("diffHashes"));
    }

    #[test]
    fn diff_response_has_diff_key() {
        let resp = DiffResponse {
            diff: "diff text".into(),
        };
        let json = serde_json::to_value(&resp).unwrap();
        let obj = json.as_object().unwrap();
        assert!(obj.contains_key("diff"));
        assert_eq!(obj["diff"], "diff text");
    }

    #[test]
    fn session_list_response_has_sessions_key() {
        let resp = SessionListResponse {
            sessions: vec![],
        };
        let json = serde_json::to_value(&resp).unwrap();
        let obj = json.as_object().unwrap();
        assert!(obj.contains_key("sessions"));
        assert!(obj["sessions"].as_array().unwrap().is_empty());
    }

    #[test]
    fn auto_mark_rules_response_uses_camel_case() {
        let resp = AutoMarkRulesResponse {
            rules: vec![AutoMarkRule::Lockfile],
            auto_marked: vec![],
        };
        let json = serde_json::to_value(&resp).unwrap();
        let obj = json.as_object().unwrap();

        assert!(obj.contains_key("rules"));
        assert!(obj.contains_key("autoMarked"));
        assert!(!obj.contains_key("auto_marked"));
    }

    #[test]
    fn auto_mark_apply_response_uses_camel_case() {
        let resp = AutoMarkApplyResponse {
            auto_marked: vec![],
        };
        let json = serde_json::to_value(&resp).unwrap();
        let obj = json.as_object().unwrap();

        assert!(obj.contains_key("autoMarked"));
        assert!(!obj.contains_key("auto_marked"));
    }

    #[test]
    fn commits_response_has_commits_key() {
        let resp = CommitsResponse {
            commits: vec![sample_commit_info()],
        };
        let json = serde_json::to_value(&resp).unwrap();
        let obj = json.as_object().unwrap();
        assert!(obj.contains_key("commits"));
        assert_eq!(obj["commits"].as_array().unwrap().len(), 1);
    }
}
