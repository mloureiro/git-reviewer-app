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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_cli::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(InitialSession(Mutex::new(None)))
        .manage(RepoPath(Mutex::new(None)))
        .setup(|app| {
            use tauri_plugin_cli::CliExt;

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

            // Store repo path in managed state
            if let Some(repo_path) = repo_arg {
                let state = app.state::<RepoPath>();
                *state.0.lock().unwrap() = Some(repo_path);
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
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
