mod auto_mark;
mod commands;
mod git_ops;
mod types;

use std::sync::Mutex;
use tauri::Manager;

/// Holds the optional initial session commit SHA created from CLI args.
pub struct InitialSession(pub Mutex<Option<String>>);

/// Holds the optional repo path provided via `--repo`.
pub struct RepoPath(pub Mutex<Option<String>>);

/// Registry of all known repository paths, persisted to disk.
pub struct RepoRegistry {
    pub paths: Mutex<Vec<String>>,
    pub storage_path: Mutex<Option<std::path::PathBuf>>,
}

impl RepoRegistry {
    /// Load repo paths from disk. Call once during setup after resolving the app data dir.
    pub fn load_from(&self, path: &std::path::Path) {
        *self.storage_path.lock().unwrap() = Some(path.to_path_buf());

        if path.exists() {
            if let Ok(contents) = std::fs::read_to_string(path) {
                if let Ok(saved) = serde_json::from_str::<Vec<String>>(&contents) {
                    let mut paths = self.paths.lock().unwrap();
                    for p in saved {
                        // Only keep repos that still exist on disk
                        if std::path::Path::new(&p).is_dir() && !paths.contains(&p) {
                            paths.push(p);
                        }
                    }
                }
            }
        }
    }

    /// Persist the current repo list to disk.
    pub fn save(&self) {
        let storage = self.storage_path.lock().unwrap();
        if let Some(ref path) = *storage {
            let paths = self.paths.lock().unwrap();
            if let Ok(json) = serde_json::to_string_pretty(&*paths) {
                if let Some(parent) = path.parent() {
                    std::fs::create_dir_all(parent).ok();
                }
                std::fs::write(path, json).ok();
            }
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_cli::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(InitialSession(Mutex::new(None)))
        .manage(RepoPath(Mutex::new(None)))
        .manage(RepoRegistry {
            paths: Mutex::new(Vec::new()),
            storage_path: Mutex::new(None),
        })
        .setup(|app| {
            use tauri_plugin_cli::CliExt;

            // Load persisted repos from disk
            let registry = app.state::<RepoRegistry>();
            let data_dir = app.path().app_data_dir().unwrap_or_default();
            let repos_file = data_dir.join("repos.json");
            registry.load_from(&repos_file);

            let matches = app.cli().matches()?;

            // Extract --repo and set working directory / state
            let repo_arg = matches
                .args
                .get("repo")
                .and_then(|v| v.value.as_str().map(|s| s.to_string()));

            if let Some(ref repo_path) = repo_arg {
                let path = std::path::Path::new(repo_path);
                if path.exists() && path.is_dir() {
                    std::env::set_current_dir(path).ok();
                }
            }

            // Store repo path in managed state and register in RepoRegistry
            if let Some(repo_path) = repo_arg {
                let state = app.state::<RepoPath>();
                *state.0.lock().unwrap() = Some(repo_path.clone());

                let registry = app.state::<RepoRegistry>();
                let mut paths = registry.paths.lock().unwrap();
                if !paths.contains(&repo_path) {
                    paths.push(repo_path);
                }
                drop(paths);
                registry.save();
            }

            // Extract --base and --head
            let base_arg = matches
                .args
                .get("base")
                .and_then(|v| v.value.as_str().map(|s| s.to_string()));
            let head_arg = matches
                .args
                .get("head")
                .and_then(|v| v.value.as_str().map(|s| s.to_string()));

            // Auto-create session if both base and head are provided
            if let (Some(base_ref), Some(head_ref)) = (base_arg, head_arg) {
                match commands::create_session_from_cli(&base_ref, &head_ref) {
                    Ok(commit_sha) => {
                        let state = app.state::<InitialSession>();
                        *state.0.lock().unwrap() = Some(commit_sha);
                    }
                    Err(e) => {
                        eprintln!("Failed to auto-create session from CLI args: {}", e);
                    }
                }
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::fetch_refs,
            commands::fetch_files,
            commands::fetch_diff,
            commands::fetch_sessions,
            commands::fetch_session,
            commands::create_session,
            commands::delete_session,
            commands::update_session_status,
            commands::post_comment,
            commands::patch_comment,
            commands::mark_file_viewed,
            commands::unmark_file_viewed,
            commands::update_auto_mark_rules,
            commands::apply_auto_mark_rules,
            commands::fetch_commits,
            commands::fetch_commit_diff,
            commands::fetch_commit_files,
            commands::get_initial_session,
            commands::install_cli,
            commands::get_current_repo,
            commands::select_repository,
            commands::list_repos,
            commands::register_repo,
            commands::unregister_repo,
            commands::resolve_refs,
            commands::open_session_window,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
