use tauri::State;
use crate::filesystem::FileSystem;
use crate::models::{ApiResult, FolderInfo};

/// Lists all folders in the notes directory.
/// 
/// Returns all directories with "All Notes" virtual folder as the first entry.
/// 
/// # Requirements
/// Validates: Requirements 10.1
#[tauri::command]
pub async fn list_folders(filesystem: State<'_, FileSystem>) -> Result<Vec<FolderInfo>, String> {
    filesystem.list_folders()
}

/// Creates a new folder in the notes directory.
/// 
/// # Arguments
/// * `name` - The name of the folder to create
/// 
/// # Requirements
/// Validates: Requirements 10.2
#[tauri::command]
pub async fn create_folder(name: String, filesystem: State<'_, FileSystem>) -> Result<ApiResult, String> {
    if name.trim().is_empty() {
        return Ok(ApiResult::error("Folder name cannot be empty or whitespace only".to_string()));
    }

    if name.contains("..") || name.contains('/') || name.contains('\\') {
        return Ok(ApiResult::error("Folder name cannot contain path traversal or separators".to_string()));
    }

    if filesystem.is_protected_name(&name) {
        return Ok(ApiResult::error(format!("'{}' is a protected folder name", name)));
    }

    match filesystem.create_folder(&name) {
        Ok(()) => Ok(ApiResult::success()),
        Err(e) => Ok(ApiResult::error(e)),
    }
}

/// Deletes a folder and all its contents from the notes directory.
/// 
/// # Arguments
/// * `name` - The name of the folder to delete
/// 
/// # Requirements
/// Validates: Requirements 10.3
#[tauri::command]
pub async fn delete_folder(name: String, filesystem: State<'_, FileSystem>) -> Result<ApiResult, String> {
    if name.trim().is_empty() {
        return Ok(ApiResult::error("Folder name cannot be empty or whitespace only".to_string()));
    }

    if name.contains("..") || name.contains('/') || name.contains('\\') {
        return Ok(ApiResult::error("Folder name cannot contain path traversal or separators".to_string()));
    }

    if filesystem.is_protected_name(&name) {
        return Ok(ApiResult::error(format!("Cannot delete protected folder '{}'", name)));
    }

    match filesystem.delete_folder(&name) {
        Ok(()) => Ok(ApiResult::success()),
        Err(e) => Ok(ApiResult::error(e)),
    }
}

/// Renames a folder in the notes directory.
/// 
/// # Arguments
/// * `old_name` - The current name of the folder
/// * `new_name` - The new name for the folder
/// 
/// # Requirements
/// Validates: Requirements 10.4
#[tauri::command]
pub async fn rename_folder(
    old_name: String,
    new_name: String,
    filesystem: State<'_, FileSystem>,
) -> Result<ApiResult, String> {
    if old_name.trim().is_empty() || new_name.trim().is_empty() {
        return Ok(ApiResult::error("Folder names cannot be empty or whitespace only".to_string()));
    }

    if old_name.contains("..") || old_name.contains('/') || old_name.contains('\\') ||
       new_name.contains("..") || new_name.contains('/') || new_name.contains('\\') {
        return Ok(ApiResult::error("Folder names cannot contain path traversal or separators".to_string()));
    }

    if filesystem.is_protected_name(&old_name) {
        return Ok(ApiResult::error(format!("Cannot rename protected folder '{}'", old_name)));
    }
    
    if filesystem.is_protected_name(&new_name) {
        return Ok(ApiResult::error(format!("Cannot rename to protected name '{}'", new_name)));
    }
    
    // Check specific conflict for new_name
    match filesystem.validate_notes_path(&new_name) {
        Ok(path) => {
            if path.exists() {
                return Ok(ApiResult::error(format!("Folder '{}' already exists", new_name)));
            }
        },
        Err(e) => return Ok(ApiResult::error(e)),
    }

    match filesystem.rename_folder(&old_name, &new_name) {
        Ok(()) => Ok(ApiResult::success()),
        Err(e) => Ok(ApiResult::error(e)),
    }
}
