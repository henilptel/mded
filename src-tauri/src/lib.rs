use tauri::Manager;

pub mod commands;
pub mod filesystem;
pub mod models;

use filesystem::FileSystem;

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
            
            app.manage(filesystem);
            
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
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
