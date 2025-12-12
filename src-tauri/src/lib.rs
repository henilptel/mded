use tauri::Manager;

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
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            // Focus the main window when a second instance is launched
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_focus();
                let _ = window.unminimize();
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
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
