use tauri::{State, Window};
use crate::config::ConfigManager;
use crate::models::{ApiResult, DisplayInfo, WindowBounds};
use crate::window::WindowManager;

/// Minimizes the window.
/// 
/// # Requirements
/// Validates: Requirements 2.5
#[tauri::command]
pub async fn minimize_window(window: Window) -> Result<(), String> {
    window.minimize().map_err(|e| format!("Failed to minimize window: {}", e))
}

/// Toggles the window maximize state.
/// 
/// If the window is maximized, it will be unmaximized.
/// If the window is not maximized, it will be maximized.
/// 
/// # Requirements
/// Validates: Requirements 2.5
#[tauri::command]
pub async fn maximize_window(window: Window) -> Result<(), String> {
    let is_maximized = window.is_maximized()
        .map_err(|e| format!("Failed to check maximize state: {}", e))?;
    
    if is_maximized {
        window.unmaximize().map_err(|e| format!("Failed to unmaximize window: {}", e))
    } else {
        window.maximize().map_err(|e| format!("Failed to maximize window: {}", e))
    }
}

/// Closes (hides) the window instead of terminating the application.
/// 
/// The window is hidden to the system tray rather than being destroyed.
/// 
/// # Requirements
/// Validates: Requirements 2.5
#[tauri::command]
pub async fn close_window(window: Window) -> Result<(), String> {
    window.hide().map_err(|e| format!("Failed to hide window: {}", e))
}

/// Sets the window always-on-top flag.
/// 
/// # Arguments
/// * `flag` - Whether the window should be always on top
/// 
/// # Requirements
/// Validates: Requirements 5.1
#[tauri::command]
pub async fn set_always_on_top(flag: bool, window: Window) -> Result<ApiResult, String> {
    window.set_always_on_top(flag)
        .map_err(|e| format!("Failed to set always on top: {}", e))?;
    Ok(ApiResult::success())
}

/// Enters minimal mode.
/// 
/// Saves the current window bounds, sets always-on-top, and resizes
/// to the saved minimal mode bounds.
/// 
/// # Requirements
/// Validates: Requirements 5.1
#[tauri::command]
pub async fn enter_minimal_mode(
    window: Window,
    window_manager: State<'_, WindowManager>,
    config: State<'_, ConfigManager>,
) -> Result<ApiResult, String> {
    // Get current bounds to save
    let position = window.outer_position()
        .map_err(|e| format!("Failed to get window position: {}", e))?;
    let size = window.outer_size()
        .map_err(|e| format!("Failed to get window size: {}", e))?;
    
    let current_bounds = WindowBounds {
        width: size.width,
        height: size.height,
        x: Some(position.x),
        y: Some(position.y),
    };
    
    // Save normal bounds
    window_manager.save_normal_bounds(current_bounds);
    
    // Get minimal mode bounds from config
    let cfg = config.get();
    let minimal_bounds = cfg.minimal_mode_bounds;
    
    // Set always on top
    window.set_always_on_top(true)
        .map_err(|e| format!("Failed to set always on top: {}", e))?;
    
    // Resize to minimal bounds
    window.set_size(tauri::Size::Physical(tauri::PhysicalSize {
        width: minimal_bounds.width,
        height: minimal_bounds.height,
    })).map_err(|e| format!("Failed to resize window: {}", e))?;
    
    // Position if specified
    if let (Some(x), Some(y)) = (minimal_bounds.x, minimal_bounds.y) {
        window.set_position(tauri::Position::Physical(tauri::PhysicalPosition { x, y }))
            .map_err(|e| format!("Failed to position window: {}", e))?;
    }
    
    // Set minimal mode state
    window_manager.set_minimal_mode(true);
    
    Ok(ApiResult::success())
}

/// Exits minimal mode.
/// 
/// Saves the current minimal bounds, restores normal bounds,
/// and disables always-on-top.
/// 
/// # Requirements
/// Validates: Requirements 5.2
#[tauri::command]
pub async fn exit_minimal_mode(
    window: Window,
    window_manager: State<'_, WindowManager>,
    config: State<'_, ConfigManager>,
) -> Result<ApiResult, String> {
    // Get current bounds to save as minimal bounds
    let position = window.outer_position()
        .map_err(|e| format!("Failed to get window position: {}", e))?;
    let size = window.outer_size()
        .map_err(|e| format!("Failed to get window size: {}", e))?;
    
    let current_bounds = WindowBounds {
        width: size.width,
        height: size.height,
        x: Some(position.x),
        y: Some(position.y),
    };
    
    // Save current bounds as minimal mode bounds
    config.update(|cfg| {
        cfg.minimal_mode_bounds = current_bounds;
    });
    config.schedule_save().await;
    
    // Disable always on top
    window.set_always_on_top(false)
        .map_err(|e| format!("Failed to disable always on top: {}", e))?;
    
    // Restore normal bounds if available
    if let Some(normal_bounds) = window_manager.get_normal_bounds() {
        window.set_size(tauri::Size::Physical(tauri::PhysicalSize {
            width: normal_bounds.width,
            height: normal_bounds.height,
        })).map_err(|e| format!("Failed to resize window: {}", e))?;
        
        if let (Some(x), Some(y)) = (normal_bounds.x, normal_bounds.y) {
            window.set_position(tauri::Position::Physical(tauri::PhysicalPosition { x, y }))
                .map_err(|e| format!("Failed to position window: {}", e))?;
        }
    }
    
    // Clear saved normal bounds and set minimal mode state
    window_manager.clear_normal_bounds();
    window_manager.set_minimal_mode(false);
    
    Ok(ApiResult::success())
}

/// Saves the current window bounds as minimal mode bounds.
/// 
/// # Requirements
/// Validates: Requirements 5.3
#[tauri::command]
pub async fn save_minimal_bounds(
    window: Window,
    config: State<'_, ConfigManager>,
) -> Result<ApiResult, String> {
    let position = window.outer_position()
        .map_err(|e| format!("Failed to get window position: {}", e))?;
    let size = window.outer_size()
        .map_err(|e| format!("Failed to get window size: {}", e))?;
    
    let bounds = WindowBounds {
        width: size.width,
        height: size.height,
        x: Some(position.x),
        y: Some(position.y),
    };
    
    config.update(|cfg| {
        cfg.minimal_mode_bounds = bounds;
    });
    config.schedule_save().await;
    
    Ok(ApiResult::success())
}

/// Gets the current window opacity.
/// 
/// # Requirements
/// Validates: Requirements 6.2
#[tauri::command]
pub async fn get_window_opacity(config: State<'_, ConfigManager>) -> Result<f64, String> {
    Ok(config.get_window_opacity())
}

/// Sets the window opacity.
/// 
/// The opacity is clamped between 0.3 and 1.0.
/// 
/// # Arguments
/// * `opacity` - The desired opacity value
/// 
/// # Requirements
/// Validates: Requirements 6.1, 6.2, 6.3
#[tauri::command]
pub async fn set_window_opacity(
    opacity: f64,
    config: State<'_, ConfigManager>,
) -> Result<ApiResult, String> {
    let clamped = WindowManager::clamp_opacity(opacity);
    
    config.set_window_opacity(clamped);
    config.schedule_save().await;
    
    Ok(ApiResult {
        success: true,
        opacity: Some(clamped),
        ..Default::default()
    })
}

/// Gets display information for the primary monitor.
/// 
/// Returns the work area dimensions and position.
/// 
/// # Requirements
/// Validates: Requirements 18.1
#[tauri::command]
pub async fn get_display_info(window: Window) -> Result<DisplayInfo, String> {
    let monitor = window.primary_monitor()
        .map_err(|e| format!("Failed to get primary monitor: {}", e))?
        .ok_or_else(|| "No primary monitor found".to_string())?;
    
    let position = monitor.position();
    let size = monitor.size();
    
    Ok(DisplayInfo {
        x: position.x,
        y: position.y,
        width: size.width,
        height: size.height,
    })
}

/// Saves the current window bounds to configuration.
/// 
/// This is called when the window is moved or resized.
/// 
/// # Requirements
/// Validates: Requirements 2.3, 2.4
#[tauri::command]
pub async fn save_window_bounds(
    window: Window,
    window_manager: State<'_, WindowManager>,
    config: State<'_, ConfigManager>,
) -> Result<ApiResult, String> {
    // Don't save bounds if in minimal mode
    if window_manager.is_in_minimal_mode() {
        return Ok(ApiResult::success());
    }
    
    let position = window.outer_position()
        .map_err(|e| format!("Failed to get window position: {}", e))?;
    let size = window.outer_size()
        .map_err(|e| format!("Failed to get window size: {}", e))?;
    
    let bounds = WindowBounds {
        width: size.width,
        height: size.height,
        x: Some(position.x),
        y: Some(position.y),
    };
    
    // Clamp bounds to minimum dimensions
    let clamped_bounds = WindowManager::clamp_bounds(bounds);
    
    config.update(|cfg| {
        cfg.window_bounds = clamped_bounds;
    });
    config.schedule_save().await;
    
    Ok(ApiResult::success())
}
