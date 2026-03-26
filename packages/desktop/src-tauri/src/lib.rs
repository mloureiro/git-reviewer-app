use std::process::{Child, Command};
use std::sync::Mutex;
use std::time::Duration;

/// Holds the Node.js server child process so we can kill it on exit.
struct ServerProcess(Mutex<Option<Child>>);

/// Spawn the Node.js Express server as a child process.
/// Uses the server's index.ts via tsx for dev, or dist/index.js for production.
fn spawn_server() -> std::io::Result<Child> {
    let server_dir = std::env::current_dir()?
        .join("..")
        .join("server");

    // Try tsx first (dev mode), fall back to node (production).
    let child = Command::new("npx")
        .arg("tsx")
        .arg("src/index.ts")
        .current_dir(&server_dir)
        .env("PORT", "3847")
        .env(
            "REPO_PATH",
            std::env::var("REPO_PATH").unwrap_or_else(|_| {
                std::env::current_dir()
                    .unwrap_or_default()
                    .to_string_lossy()
                    .to_string()
            }),
        )
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .spawn()?;

    Ok(child)
}

/// Poll the server until it responds to the health endpoint.
fn wait_for_server(port: u16, timeout: Duration) -> bool {
    let start = std::time::Instant::now();
    let url = format!("http://localhost:{}/api/health", port);

    while start.elapsed() < timeout {
        if let Ok(resp) = reqwest::blocking::get(&url) {
            if resp.status().is_success() {
                return true;
            }
        }
        std::thread::sleep(Duration::from_millis(250));
    }

    false
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Spawn the Express server before starting Tauri.
    let server_child = spawn_server().expect("Failed to spawn Node.js server");
    let pid = server_child.id();
    eprintln!("Started Node.js server (pid: {})", pid);

    // Wait for the server to become ready (up to 15 seconds).
    if !wait_for_server(3847, Duration::from_secs(15)) {
        eprintln!("Warning: server did not become ready within 15 seconds, opening window anyway");
    }

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(ServerProcess(Mutex::new(Some(server_child))))
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::Destroyed = event {
                let state = window.state::<ServerProcess>();
                if let Ok(mut guard) = state.0.lock() {
                    if let Some(mut child) = guard.take() {
                        eprintln!("Shutting down Node.js server...");
                        let _ = child.kill();
                        let _ = child.wait();
                    }
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
