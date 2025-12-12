use tauri::{Emitter, Manager};

pub mod commands;
pub mod config;
pub mod filesystem;
pub mod models;
pub mod shortcuts;
pub mod tray;
pub mod window;

use config::ConfigManager;
use filesystem::FileSystem;
use shortcuts::ShortcutManager;
use window::WindowManager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec!["--hidden"]),
        ))
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_single_instance::init(|app, args, _cwd| {
            // Focus the main window when a second instance is launched
            // Requirements: 3.1, 3.3
            if let Some(window) = app.get_webview_window("main") {
                // First show the window if it's hidden
                let _ = window.show();
                // Restore if minimized (Requirement 3.3)
                let _ = window.unminimize();
                // Then focus it (Requirement 3.1)
                let _ = window.set_focus();
            }
            
            // Handle file argument from second instance (Requirement 3.2)
            // args[0] is typically the executable path, so we check args[1] onwards
            if args.len() > 1 {
                let file_path = &args[1];
                // Only emit if it looks like a file path (not a flag)
                if !file_path.starts_with('-') && file_path.ends_with(".md") {
                    let _ = app.emit("open-file", file_path.clone());
                }
            }
        }))
        .setup(|app| {
            // Initialize filesystem and ensure directories exist
            let filesystem = FileSystem::new()
                .expect("Failed to initialize filesystem");
            filesystem.ensure_directories()
                .expect("Failed to create application directories");
            
            // Initialize config manager
            let config_manager = ConfigManager::new(filesystem.config_file.clone())
                .expect("Failed to initialize config manager");
            
            // Initialize window manager
            let window_manager = WindowManager::new();
            
            // Initialize shortcut manager
            let shortcut_manager = ShortcutManager::new();
            
            app.manage(filesystem);
            app.manage(config_manager);
            app.manage(window_manager);
            app.manage(shortcut_manager);
            
            // Set up system tray
            tray::setup_tray(app.handle())
                .expect("Failed to setup system tray");
            
            // Register global shortcuts
            let shortcut_mgr = app.state::<ShortcutManager>();
            if let Err(e) = shortcut_mgr.register_all(app.handle()) {
                log::warn!("Failed to register some shortcuts: {}", e);
            }
            
            // Handle file argument on initial startup (Requirement 3.2)
            // This handles the case when the app is launched with a file argument
            let args: Vec<String> = std::env::args().collect();
            if args.len() > 1 {
                let file_path = &args[1];
                // Only emit if it looks like a file path (not a flag)
                if !file_path.starts_with('-') && file_path.ends_with(".md") {
                    let handle = app.handle().clone();
                    let path = file_path.clone();
                    // Emit after a short delay to ensure frontend is ready
                    std::thread::spawn(move || {
                        std::thread::sleep(std::time::Duration::from_millis(500));
                        let _ = handle.emit("open-file", path);
                    });
                }
            }
            
            #[cfg(debug_assertions)]
            {
                let window = app.get_webview_window("main").unwrap();
                window.open_devtools();
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::list_folders,
            commands::create_folder,
            commands::delete_folder,
            commands::rename_folder,
            commands::list_notes,
            commands::read_note,
            commands::save_note,
            commands::create_note,
            commands::delete_note,
            commands::rename_note,
            commands::move_note,
            commands::toggle_pin_note,
            commands::get_note_order,
            commands::save_note_order,
            commands::save_quick_note,
            commands::get_last_note,
            commands::save_last_note,
            commands::get_global_shortcut,
            commands::set_global_shortcut,
            // Window commands
            commands::minimize_window,
            commands::maximize_window,
            commands::close_window,
            commands::set_always_on_top,
            commands::enter_minimal_mode,
            commands::exit_minimal_mode,
            commands::save_minimal_bounds,
            commands::get_window_opacity,
            commands::set_window_opacity,
            commands::get_display_info,
            commands::save_window_bounds,
            // System integration commands
            commands::save_screenshot,
            commands::get_assets_path,
            commands::read_external_file,
            commands::get_auto_start,
            commands::set_auto_start,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
