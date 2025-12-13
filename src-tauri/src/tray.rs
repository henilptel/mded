use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager, Runtime, WebviewWindow,
};

/// Sets up the system tray with icon, tooltip, and context menu.
/// 
/// Requirements: 4.1, 4.2, 4.3, 4.4
pub fn setup_tray<R: Runtime>(app: &AppHandle<R>) -> Result<(), String> {
    // Load the tray icon - include_bytes! embeds the icon at compile time
    let icon_bytes = include_bytes!("../icons/icon.png");
    let icon = tauri::image::Image::from_bytes(icon_bytes)
        .map_err(|e| format!("Failed to load tray icon: {}", e))?;

    // Create menu items for the context menu
    let show_item = MenuItem::with_id(app, "show", "Show", true, None::<&str>)
        .map_err(|e| format!("Failed to create Show menu item: {}", e))?;
    let quit_item = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)
        .map_err(|e| format!("Failed to create Quit menu item: {}", e))?;

    // Build the context menu
    let menu = Menu::with_items(app, &[&show_item, &quit_item])
        .map_err(|e| format!("Failed to create tray menu: {}", e))?;

    // Build and configure the tray icon
    TrayIconBuilder::new()
        .icon(icon)
        .tooltip("MDed - Markdown Editor")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| {
            handle_menu_event(app, &event.id.0);
        })
        .on_tray_icon_event(|tray, event| {
            handle_tray_event(tray.app_handle(), event);
        })
        .build(app)
        .map_err(|e| format!("Failed to build tray icon: {}", e))?;

    Ok(())
}


/// Handles tray icon click events.
/// 
/// Requirements: 4.2 - Toggle main window visibility on click
fn handle_tray_event<R: Runtime>(app: &AppHandle<R>, event: TrayIconEvent) {
    match event {
        TrayIconEvent::Click {
            button: MouseButton::Left,
            button_state: MouseButtonState::Up,
            ..
        } => {
            // Toggle main window visibility on left click
            if let Some(window) = app.get_webview_window("main") {
                match window.is_visible() {
                    Ok(true) => {
                         if let Err(e) = window.hide() {
                             log::error!("Failed to hide window: {}", e);
                         }
                    }
                    Ok(false) => {
                        show_and_focus_window(&window);
                    }
                    Err(e) => {
                        log::error!("Failed to check window visibility: {}", e);
                    }
                }
            }
        }
        _ => {}
    }
}

/// Handles context menu item clicks.
/// 
/// Requirements: 4.3, 4.4 - Show and Quit menu items
fn handle_menu_event<R: Runtime>(app: &AppHandle<R>, menu_id: &str) {
    match menu_id {
        "show" => {
            // Show and focus the main window
            if let Some(window) = app.get_webview_window("main") {
                show_and_focus_window(&window);
            }
        }
        "quit" => {
            // Terminate the application completely
            app.exit(0);
        }
        _ => {}
    }
}

/// Helper function to show, focus and unminimize a window with error logging
fn show_and_focus_window<R: Runtime>(window: &WebviewWindow<R>) {
    if let Err(e) = window.show() {
        log::error!("Failed to show window: {}", e);
    }
    if let Err(e) = window.set_focus() {
        log::error!("Failed to focus window: {}", e);
    }
    if let Err(e) = window.unminimize() {
        log::error!("Failed to unminimize window: {}", e);
    }
}
