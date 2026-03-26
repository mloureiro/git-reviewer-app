mod auto_mark;
mod commands;
mod git_ops;
mod types;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
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
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
