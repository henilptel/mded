use tauri::State;
use crate::filesystem::FileSystem;
use crate::models::{ApiResult, NoteInfo};

/// Lists all notes, optionally filtered by folder.
/// 
/// Returns all .md files with metadata including id, title, modified date,
/// created date, folder, and pinned status.
/// 
/// # Arguments
/// * `folder` - Optional folder name to filter notes. If None or "All Notes", returns all notes.
/// 
/// # Requirements
/// Validates: Requirements 11.1, 11.2
#[tauri::command]
pub async fn list_notes(
    folder: Option<String>,
    filesystem: State<'_, FileSystem>,
) -> Result<Vec<NoteInfo>, String> {
    filesystem.list_notes(folder.as_deref())
}

/// Reads the content of a note.
/// 
/// # Arguments
/// * `note_id` - The ID of the note (filename without extension)
/// * `folder` - Optional folder containing the note
/// 
/// # Requirements
/// Validates: Requirements 11.3
#[tauri::command]
pub async fn read_note(
    note_id: String,
    folder: Option<String>,
    filesystem: State<'_, FileSystem>,
) -> Result<ApiResult, String> {
    match filesystem.read_note(&note_id, folder.as_deref()) {
        Ok(content) => Ok(ApiResult::with_content(content)),
        Err(e) => Ok(ApiResult::error(e)),
    }
}

/// Saves content to a note.
/// 
/// # Arguments
/// * `note_id` - The ID of the note (filename without extension)
/// * `content` - The content to save
/// * `folder` - Optional folder containing the note
/// 
/// # Requirements
/// Validates: Requirements 11.4
#[tauri::command]
pub async fn save_note(
    note_id: String,
    content: String,
    folder: Option<String>,
    filesystem: State<'_, FileSystem>,
) -> Result<ApiResult, String> {
    match filesystem.save_note(&note_id, &content, folder.as_deref()) {
        Ok(()) => Ok(ApiResult::success()),
        Err(e) => Ok(ApiResult::error(e)),
    }
}

/// Creates a new note with a UUID-based filename.
/// 
/// # Arguments
/// * `folder` - Optional folder to create the note in
/// 
/// # Requirements
/// Validates: Requirements 11.5
#[tauri::command]
pub async fn create_note(
    folder: Option<String>,
    filesystem: State<'_, FileSystem>,
) -> Result<ApiResult, String> {
    match filesystem.create_note(folder.as_deref()) {
        Ok((note_id, _path)) => Ok(ApiResult::with_note_id_and_folder(note_id, folder)),
        Err(e) => Ok(ApiResult::error(e)),
    }
}

/// Deletes a note.
/// 
/// # Arguments
/// * `note_id` - The ID of the note to delete
/// * `folder` - Optional folder containing the note
/// 
/// # Requirements
/// Validates: Requirements 11.6
#[tauri::command]
pub async fn delete_note(
    note_id: String,
    folder: Option<String>,
    filesystem: State<'_, FileSystem>,
) -> Result<ApiResult, String> {
    match filesystem.delete_note(&note_id, folder.as_deref()) {
        Ok(()) => Ok(ApiResult::success()),
        Err(e) => Ok(ApiResult::error(e)),
    }
}

/// Renames a note.
/// 
/// # Arguments
/// * `note_id` - The current ID of the note
/// * `new_name` - The new name for the note (without .md extension)
/// * `folder` - Optional folder containing the note
/// 
/// # Requirements
/// Validates: Requirements 11.7
#[tauri::command]
pub async fn rename_note(
    note_id: String,
    new_name: String,
    folder: Option<String>,
    filesystem: State<'_, FileSystem>,
) -> Result<ApiResult, String> {
    match filesystem.rename_note(&note_id, &new_name, folder.as_deref()) {
        Ok(new_id) => Ok(ApiResult::with_note_id(new_id)),
        Err(e) => Ok(ApiResult::error(e)),
    }
}

/// Moves a note from one folder to another.
/// 
/// # Arguments
/// * `note_id` - The ID of the note to move
/// * `from_folder` - The source folder
/// * `to_folder` - The target folder
/// 
/// # Requirements
/// Validates: Requirements 11.8
#[tauri::command]
pub async fn move_note(
    note_id: String,
    from_folder: String,
    to_folder: String,
    filesystem: State<'_, FileSystem>,
) -> Result<ApiResult, String> {
    match filesystem.move_note(&note_id, &from_folder, &to_folder) {
        Ok(()) => Ok(ApiResult::success()),
        Err(e) => Ok(ApiResult::error(e)),
    }
}

/// Toggles the pin status of a note.
/// 
/// If the note is currently pinned, it will be unpinned.
/// If the note is currently unpinned, it will be pinned.
/// 
/// # Arguments
/// * `note_id` - The ID of the note to toggle
/// 
/// # Requirements
/// Validates: Requirements 12.1
#[tauri::command]
pub async fn toggle_pin_note(
    note_id: String,
    filesystem: State<'_, FileSystem>,
) -> Result<ApiResult, String> {
    match filesystem.toggle_pin_note(&note_id) {
        Ok(pinned) => Ok(ApiResult {
            success: true,
            pinned: Some(pinned),
            ..Default::default()
        }),
        Err(e) => Ok(ApiResult::error(e)),
    }
}

/// Gets the custom note ordering.
/// 
/// Returns a map of folder names to ordered note ID arrays.
/// Returns an empty map if no custom ordering exists.
/// 
/// # Requirements
/// Validates: Requirements 12.2
#[tauri::command]
pub async fn get_note_order(
    filesystem: State<'_, FileSystem>,
) -> Result<std::collections::HashMap<String, Vec<String>>, String> {
    filesystem.get_note_order()
}

/// Saves the custom note ordering.
/// 
/// # Arguments
/// * `order` - A map of folder names to ordered note ID arrays
/// 
/// # Requirements
/// Validates: Requirements 12.3
#[tauri::command]
pub async fn save_note_order(
    order: std::collections::HashMap<String, Vec<String>>,
    filesystem: State<'_, FileSystem>,
) -> Result<ApiResult, String> {
    match filesystem.save_note_order(order) {
        Ok(()) => Ok(ApiResult::success()),
        Err(e) => Ok(ApiResult::error(e)),
    }
}

/// Saves content from the quick note popup as a new note.
/// 
/// Creates a note with filename quick-{timestamp}.md, shows a notification,
/// emits refresh-notes event, and hides the quick note window.
/// 
/// # Arguments
/// * `content` - The content to save
/// 
/// # Requirements
/// Validates: Requirements 8.2
#[tauri::command]
pub async fn save_quick_note(
    content: String,
    filesystem: State<'_, FileSystem>,
    app: tauri::AppHandle,
) -> Result<ApiResult, String> {
    use chrono::Utc;
    use tauri::Emitter;
    use tauri::Manager;
    use tauri_plugin_notification::NotificationExt;
    
    // Validate content is not empty
    if content.trim().is_empty() {
        return Ok(ApiResult::error("Content cannot be empty"));
    }
    
    // Generate timestamp-based filename: quick-{timestamp}
    let timestamp = Utc::now().format("%Y%m%d%H%M%S").to_string();
    let note_id = format!("quick-{}", timestamp);
    
    // Format the content with a title
    let formatted_content = format!("# Quick Note\n\n{}", content);
    
    // Save the note to the root notes directory (no folder)
    match filesystem.save_note(&note_id, &formatted_content, None) {
        Ok(()) => {
            // Show notification
            let _ = app.notification()
                .builder()
                .title("Quick Note Saved")
                .body("Your quick note has been saved")
                .show();
            
            // Emit refresh-notes event to update the UI
            let _ = app.emit("refresh-notes", note_id.clone());
            
            // Hide the quick note window
            if let Some(window) = app.get_webview_window("quick-note") {
                let _ = window.hide();
            }
            
            Ok(ApiResult::with_note_id(note_id))
        }
        Err(e) => Ok(ApiResult::error(e)),
    }
}
