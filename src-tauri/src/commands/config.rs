use tauri::State;
use crate::config::ConfigManager;
use crate::models::{ApiResult, LastNote};

/// Gets the last opened note information.
/// 
/// Returns the note ID and folder of the last opened note.
/// 
/// # Requirements
/// Validates: Requirements 17.3
#[tauri::command]
pub async fn get_last_note(config: State<'_, ConfigManager>) -> Result<LastNote, String> {
    Ok(config.get_last_note())
}

/// Saves the last opened note information.
/// 
/// # Arguments
/// * `note_id` - The note ID (or None to clear)
/// * `folder` - The folder (or None to clear)
/// 
/// # Requirements
/// Validates: Requirements 17.4
#[tauri::command]
pub async fn save_last_note(
    note_id: Option<String>,
    folder: Option<String>,
    config: State<'_, ConfigManager>,
) -> Result<ApiResult, String> {
    config.save_last_note(note_id, folder);
    config.schedule_save().await;
    Ok(ApiResult::success())
}

/// Gets the global shortcut configuration.
/// 
/// Returns the current global shortcut string.
/// 
/// # Requirements
/// Validates: Requirements 7.4
#[tauri::command]
pub async fn get_global_shortcut(config: State<'_, ConfigManager>) -> Result<String, String> {
    Ok(config.get_global_shortcut())
}

/// Sets the global shortcut configuration.
/// 
/// # Arguments
/// * `key` - The new shortcut string
/// 
/// # Requirements
/// Validates: Requirements 7.4
#[tauri::command]
pub async fn set_global_shortcut(
    key: String,
    config: State<'_, ConfigManager>,
) -> Result<ApiResult, String> {
    config.set_global_shortcut(key);
    config.schedule_save().await;
    Ok(ApiResult::success())
}
