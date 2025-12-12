use tauri::State;
use crate::filesystem::FileSystem;
use crate::models::ApiResult;

/// Saves a screenshot from base64 PNG data.
/// 
/// Decodes the base64 data and saves it to the assets directory with a unique
/// timestamp-based filename.
/// 
/// # Arguments
/// * `base64_data` - The base64-encoded PNG image data (may include data URL prefix)
/// 
/// # Returns
/// ApiResult with image_path and image_id on success
/// 
/// # Requirements
/// Validates: Requirements 14.1, 14.2
#[tauri::command]
pub async fn save_screenshot(
    base64_data: String,
    filesystem: State<'_, FileSystem>,
) -> Result<ApiResult, String> {
    match filesystem.save_screenshot(&base64_data) {
        Ok((image_id, image_path)) => Ok(ApiResult {
            success: true,
            image_id: Some(image_id),
            image_path: Some(image_path),
            ..Default::default()
        }),
        Err(e) => Ok(ApiResult::error(e)),
    }
}

/// Returns the absolute path to the assets directory.
/// 
/// # Returns
/// The absolute path to the assets directory
/// 
/// # Requirements
/// Validates: Requirements 14.3
#[tauri::command]
pub async fn get_assets_path(
    filesystem: State<'_, FileSystem>,
) -> Result<String, String> {
    Ok(filesystem.get_assets_path())
}

/// Reads an external markdown file.
/// 
/// Validates that the file has a .md extension and reads its content.
/// 
/// # Arguments
/// * `file_path` - The absolute path to the file
/// 
/// # Returns
/// ApiResult with content, file_name, and file_path on success
/// 
/// # Requirements
/// Validates: Requirements 15.1, 15.2, 15.3
#[tauri::command]
pub async fn read_external_file(
    file_path: String,
) -> Result<ApiResult, String> {
    let filesystem = FileSystem::new()
        .map_err(|e| format!("Failed to initialize filesystem: {}", e))?;
    
    match filesystem.read_external_file(&file_path) {
        Ok((content, file_name, absolute_path)) => Ok(ApiResult {
            success: true,
            content: Some(content),
            file_name: Some(file_name),
            file_path: Some(absolute_path),
            ..Default::default()
        }),
        Err(e) => Ok(ApiResult::error(e)),
    }
}

/// Gets the current auto-start status.
/// 
/// # Returns
/// true if auto-start is enabled, false otherwise
/// 
/// # Requirements
/// Validates: Requirements 16.3
#[tauri::command]
pub async fn get_auto_start(
    app: tauri::AppHandle,
) -> Result<bool, String> {
    use tauri_plugin_autostart::ManagerExt;
    
    app.autolaunch()
        .is_enabled()
        .map_err(|e| format!("Failed to get auto-start status: {}", e))
}

/// Sets the auto-start status.
/// 
/// # Arguments
/// * `enabled` - Whether to enable or disable auto-start
/// 
/// # Returns
/// ApiResult indicating success or failure
/// 
/// # Requirements
/// Validates: Requirements 16.1, 16.2
#[tauri::command]
pub async fn set_auto_start(
    enabled: bool,
    app: tauri::AppHandle,
) -> Result<ApiResult, String> {
    use tauri_plugin_autostart::ManagerExt;
    
    let autolaunch = app.autolaunch();
    
    let result = if enabled {
        autolaunch.enable()
    } else {
        autolaunch.disable()
    };
    
    match result {
        Ok(()) => Ok(ApiResult::success()),
        Err(e) => Ok(ApiResult::error(format!("Failed to set auto-start: {}", e))),
    }
}
