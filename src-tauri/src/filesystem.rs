use std::fs;
use std::path::{Path, PathBuf};

/// Validates a path component to prevent directory traversal attacks.
/// 
/// This function rejects paths that contain:
/// - ".." (parent directory traversal)
/// - "/" (forward slash path separator)
/// - "\\" (backslash path separator)
/// 
/// After validation, it verifies that the resolved path stays within the base directory.
/// 
/// # Arguments
/// * `base_dir` - The base directory that the path must stay within
/// * `relative_path` - The relative path component to validate
/// 
/// # Returns
/// * `Ok(PathBuf)` - The resolved absolute path if validation passes
/// * `Err(String)` - An error message if validation fails
/// 
/// # Requirements
/// Validates: Requirements 13.1, 13.2, 13.3, 13.4
pub fn validate_path(base_dir: &Path, relative_path: &str) -> Result<PathBuf, String> {
    // Check for directory traversal patterns
    if relative_path.contains("..") {
        return Err("Path contains invalid traversal pattern '..'".to_string());
    }
    
    // Check for path separators (both forward and back slashes)
    if relative_path.contains('/') {
        return Err("Path contains invalid separator '/'".to_string());
    }
    
    if relative_path.contains('\\') {
        return Err("Path contains invalid separator '\\'".to_string());
    }
    
    // Construct the full path
    let full_path = base_dir.join(relative_path);
    
    // Canonicalize both paths to resolve any symlinks and get absolute paths
    // Note: For the full_path, we need to handle the case where it doesn't exist yet
    let canonical_base = base_dir.canonicalize()
        .map_err(|e| format!("Failed to canonicalize base directory: {}", e))?;
    
    // For the full path, if it doesn't exist, we verify the parent exists and is within base
    let resolved_path = if full_path.exists() {
        full_path.canonicalize()
            .map_err(|e| format!("Failed to canonicalize path: {}", e))?
    } else {
        // If the file doesn't exist, verify the parent directory is valid
        // and return the constructed path
        full_path.clone()
    };

    // Verify the resolved path is within the base directory
    // For existing paths, use the canonical path
    // For non-existing paths, verify the path starts with the base
    if resolved_path.exists() {
        if !resolved_path.starts_with(&canonical_base) {
            return Err("Path resolves outside of base directory".to_string());
        }
    } else {
        // For non-existing paths, ensure the constructed path would be within base
        // by checking that the path starts with the base directory
        if !full_path.starts_with(base_dir) {
            return Err("Path resolves outside of base directory".to_string());
        }
    }
    
    Ok(resolved_path)
}

/// FileSystem manages the application's data directory structure.
/// 
/// The structure is:
/// - `{data_dir}/notes/` - Markdown note files organized in folders
/// - `{data_dir}/assets/` - Screenshot and image files
/// - `{data_dir}/config.json` - User configuration
/// - `{data_dir}/note-order.json` - Custom note ordering
/// 
/// # Requirements
/// Validates: Requirements 9.1, 9.2, 9.3, 9.4, 9.5
#[derive(Debug, Clone)]
pub struct FileSystem {
    /// Base data directory for the application
    pub base_dir: PathBuf,
    /// Directory for storing notes (notes/)
    pub notes_dir: PathBuf,
    /// Directory for storing assets like screenshots (assets/)
    pub assets_dir: PathBuf,
    /// Path to the configuration file (config.json)
    pub config_file: PathBuf,
    /// Path to the note ordering file (note-order.json)
    pub order_file: PathBuf,
}

impl FileSystem {
    /// Creates a new FileSystem instance using the platform-appropriate data directory.
    /// 
    /// On Linux: ~/.local/share/mded/
    /// On macOS: ~/Library/Application Support/mded/
    /// On Windows: C:\Users\{user}\AppData\Roaming\mded\
    /// 
    /// # Returns
    /// * `Ok(FileSystem)` - A new FileSystem instance
    /// * `Err(String)` - If the data directory cannot be determined
    pub fn new() -> Result<Self, String> {
        let base_dir = dirs::data_dir()
            .ok_or_else(|| "Could not determine data directory".to_string())?
            .join("mded");
        
        Self::new_with_base(&base_dir)
    }

    /// Creates a new FileSystem instance with a custom base directory.
    /// Useful for testing.
    /// 
    /// # Arguments
    /// * `base_dir` - The base directory for all application data
    /// 
    /// # Returns
    /// * `Ok(FileSystem)` - A new FileSystem instance
    /// * `Err(String)` - If the paths cannot be constructed
    pub fn new_with_base(base_dir: &Path) -> Result<Self, String> {
        let base_dir = base_dir.to_path_buf();
        let notes_dir = base_dir.join("notes");
        let assets_dir = base_dir.join("assets");
        let config_file = base_dir.join("config.json");
        let order_file = base_dir.join("note-order.json");

        Ok(Self {
            base_dir,
            notes_dir,
            assets_dir,
            config_file,
            order_file,
        })
    }

    /// Ensures all required directories exist, creating them if necessary.
    /// 
    /// Creates:
    /// - Base data directory
    /// - Notes directory
    /// - Assets directory
    /// 
    /// # Returns
    /// * `Ok(())` - If all directories exist or were created successfully
    /// * `Err(String)` - If directory creation fails
    pub fn ensure_directories(&self) -> Result<(), String> {
        // Create base directory
        fs::create_dir_all(&self.base_dir)
            .map_err(|e| format!("Failed to create base directory: {}", e))?;
        
        // Create notes directory
        fs::create_dir_all(&self.notes_dir)
            .map_err(|e| format!("Failed to create notes directory: {}", e))?;
        
        // Create assets directory
        fs::create_dir_all(&self.assets_dir)
            .map_err(|e| format!("Failed to create assets directory: {}", e))?;
        
        Ok(())
    }

    /// Validates a path relative to the notes directory.
    /// 
    /// # Arguments
    /// * `relative_path` - The relative path to validate
    /// 
    /// # Returns
    /// * `Ok(PathBuf)` - The resolved absolute path
    /// * `Err(String)` - If validation fails
    pub fn validate_notes_path(&self, relative_path: &str) -> Result<PathBuf, String> {
        validate_path(&self.notes_dir, relative_path)
    }

    /// Validates a path relative to the assets directory.
    /// 
    /// # Arguments
    /// * `relative_path` - The relative path to validate
    /// 
    /// # Returns
    /// * `Ok(PathBuf)` - The resolved absolute path
    /// * `Err(String)` - If validation fails
    pub fn validate_assets_path(&self, relative_path: &str) -> Result<PathBuf, String> {
        validate_path(&self.assets_dir, relative_path)
    }

    /// Returns the path to a folder within the notes directory.
    /// 
    /// # Arguments
    /// * `folder_name` - The name of the folder (or None for root notes directory)
    /// 
    /// # Returns
    /// The path to the folder
    pub fn get_folder_path(&self, folder_name: Option<&str>) -> PathBuf {
        match folder_name {
            Some(name) if !name.is_empty() => self.notes_dir.join(name),
            _ => self.notes_dir.clone(),
        }
    }

    /// Lists all folders in the notes directory.
    /// 
    /// Returns all directories in the notes directory, with "All Notes" virtual folder
    /// as the first entry.
    /// 
    /// # Returns
    /// * `Ok(Vec<FolderInfo>)` - List of folders with "All Notes" first
    /// * `Err(String)` - If reading the directory fails
    /// 
    /// # Requirements
    /// Validates: Requirements 10.1
    pub fn list_folders(&self) -> Result<Vec<crate::models::FolderInfo>, String> {
        use crate::models::FolderInfo;
        
        let mut folders = vec![
            FolderInfo {
                name: "All Notes".to_string(),
                path: self.notes_dir.to_string_lossy().to_string(),
            }
        ];

        // Read directories from notes_dir
        let entries = fs::read_dir(&self.notes_dir)
            .map_err(|e| format!("Failed to read notes directory: {}", e))?;

        for entry in entries {
            let entry = entry.map_err(|e| format!("Failed to read directory entry: {}", e))?;
            let path = entry.path();
            
            if path.is_dir() {
                if let Some(name) = path.file_name() {
                    folders.push(FolderInfo {
                        name: name.to_string_lossy().to_string(),
                        path: path.to_string_lossy().to_string(),
                    });
                }
            }
        }

        Ok(folders)
    }

    /// Creates a new folder in the notes directory.
    /// 
    /// # Arguments
    /// * `name` - The name of the folder to create
    /// 
    /// # Returns
    /// * `Ok(())` - If the folder was created successfully
    /// * `Err(String)` - If validation fails or creation fails
    /// 
    /// # Requirements
    /// Validates: Requirements 10.2
    pub fn create_folder(&self, name: &str) -> Result<(), String> {
        // Validate the folder name
        let folder_path = self.validate_notes_path(name)?;
        
        // Check if folder already exists
        if folder_path.exists() {
            return Err(format!("Folder '{}' already exists", name));
        }
        
        // Create the folder
        fs::create_dir(&folder_path)
            .map_err(|e| format!("Failed to create folder '{}': {}", name, e))?;
        
        Ok(())
    }

    /// Deletes a folder and all its contents from the notes directory.
    /// 
    /// # Arguments
    /// * `name` - The name of the folder to delete
    /// 
    /// # Returns
    /// * `Ok(())` - If the folder was deleted successfully
    /// * `Err(String)` - If validation fails or deletion fails
    /// 
    /// # Requirements
    /// Validates: Requirements 10.3
    pub fn delete_folder(&self, name: &str) -> Result<(), String> {
        // Validate the folder name
        let folder_path = self.validate_notes_path(name)?;
        
        // Check if folder exists
        if !folder_path.exists() {
            return Err(format!("Folder '{}' does not exist", name));
        }
        
        // Check if it's actually a directory
        if !folder_path.is_dir() {
            return Err(format!("'{}' is not a folder", name));
        }
        
        // Recursively remove the folder and all contents
        fs::remove_dir_all(&folder_path)
            .map_err(|e| format!("Failed to delete folder '{}': {}", name, e))?;
        
        Ok(())
    }

    /// Renames a folder in the notes directory.
    /// 
    /// # Arguments
    /// * `old_name` - The current name of the folder
    /// * `new_name` - The new name for the folder
    /// 
    /// # Returns
    /// * `Ok(())` - If the folder was renamed successfully
    /// * `Err(String)` - If validation fails or renaming fails
    /// 
    /// # Requirements
    /// Validates: Requirements 10.4
    pub fn rename_folder(&self, old_name: &str, new_name: &str) -> Result<(), String> {
        // Validate both folder names
        let old_path = self.validate_notes_path(old_name)?;
        let new_path = self.validate_notes_path(new_name)?;
        
        // Check if old folder exists
        if !old_path.exists() {
            return Err(format!("Folder '{}' does not exist", old_name));
        }
        
        // Check if it's actually a directory
        if !old_path.is_dir() {
            return Err(format!("'{}' is not a folder", old_name));
        }
        
        // Check if new folder already exists
        if new_path.exists() {
            return Err(format!("Folder '{}' already exists", new_name));
        }
        
        // Rename the folder
        fs::rename(&old_path, &new_path)
            .map_err(|e| format!("Failed to rename folder '{}' to '{}': {}", old_name, new_name, e))?;
        
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use proptest::prelude::*;
    use tempfile::tempdir;

    #[test]
    fn test_validate_path_rejects_double_dot() {
        let temp_dir = tempdir().unwrap();
        let base = temp_dir.path();
        
        let result = validate_path(base, "..");
        assert!(result.is_err());
        assert!(result.unwrap_err().contains(".."));
    }

    #[test]
    fn test_validate_path_rejects_embedded_double_dot() {
        let temp_dir = tempdir().unwrap();
        let base = temp_dir.path();
        
        let result = validate_path(base, "foo..bar");
        assert!(result.is_err());
    }

    #[test]
    fn test_validate_path_rejects_forward_slash() {
        let temp_dir = tempdir().unwrap();
        let base = temp_dir.path();
        
        let result = validate_path(base, "foo/bar");
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("/"));
    }

    #[test]
    fn test_validate_path_rejects_backslash() {
        let temp_dir = tempdir().unwrap();
        let base = temp_dir.path();
        
        let result = validate_path(base, "foo\\bar");
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("\\"));
    }

    #[test]
    fn test_validate_path_accepts_valid_filename() {
        let temp_dir = tempdir().unwrap();
        let base = temp_dir.path();
        
        let result = validate_path(base, "valid-filename.md");
        assert!(result.is_ok());
    }

    #[test]
    fn test_validate_path_accepts_filename_with_dots() {
        let temp_dir = tempdir().unwrap();
        let base = temp_dir.path();
        
        // Single dots in filenames should be allowed (e.g., "file.name.md")
        let result = validate_path(base, "file.name.md");
        assert!(result.is_ok());
    }

    #[test]
    fn test_validate_path_returns_correct_path() {
        let temp_dir = tempdir().unwrap();
        let base = temp_dir.path();
        
        let result = validate_path(base, "test.md").unwrap();
        assert!(result.ends_with("test.md"));
    }

    // Strategy for generating paths containing ".."
    fn path_with_double_dot() -> impl Strategy<Value = String> {
        prop_oneof![
            Just("..".to_string()),
            "[a-zA-Z0-9_-]{0,10}".prop_map(|prefix| format!("{}..{}", prefix, prefix)),
            "[a-zA-Z0-9_-]{0,10}".prop_map(|s| format!("..{}", s)),
            "[a-zA-Z0-9_-]{0,10}".prop_map(|s| format!("{}..", s)),
        ]
    }

    // Strategy for generating paths containing "/"
    fn path_with_forward_slash() -> impl Strategy<Value = String> {
        prop_oneof![
            "[a-zA-Z0-9_-]{1,10}".prop_map(|s| format!("{}/{}", s, s)),
            "[a-zA-Z0-9_-]{1,10}".prop_map(|s| format!("/{}", s)),
            "[a-zA-Z0-9_-]{1,10}".prop_map(|s| format!("{}/", s)),
        ]
    }

    // Strategy for generating paths containing "\\"
    fn path_with_backslash() -> impl Strategy<Value = String> {
        prop_oneof![
            "[a-zA-Z0-9_-]{1,10}".prop_map(|s| format!("{}\\{}", s, s)),
            "[a-zA-Z0-9_-]{1,10}".prop_map(|s| format!("\\{}", s)),
            "[a-zA-Z0-9_-]{1,10}".prop_map(|s| format!("{}\\", s)),
        ]
    }

    proptest! {
        #![proptest_config(ProptestConfig::with_cases(100))]

        /// **Feature: mded-tauri-migration, Property 5: Path Traversal Rejection**
        /// **Validates: Requirements 13.1, 13.2, 13.3**
        /// 
        /// For any path string containing "..", "/" or "\\" characters,
        /// the path validator should reject it with an error.
        #[test]
        fn prop_path_traversal_rejection_double_dot(path in path_with_double_dot()) {
            let temp_dir = tempdir().unwrap();
            let base = temp_dir.path();
            
            let result = validate_path(base, &path);
            prop_assert!(result.is_err(), "Path '{}' should be rejected but was accepted", path);
            prop_assert!(
                result.as_ref().unwrap_err().contains(".."),
                "Error message should mention '..' for path '{}'",
                path
            );
        }

        /// **Feature: mded-tauri-migration, Property 5: Path Traversal Rejection**
        /// **Validates: Requirements 13.1, 13.2, 13.3**
        #[test]
        fn prop_path_traversal_rejection_forward_slash(path in path_with_forward_slash()) {
            let temp_dir = tempdir().unwrap();
            let base = temp_dir.path();
            
            let result = validate_path(base, &path);
            prop_assert!(result.is_err(), "Path '{}' should be rejected but was accepted", path);
            prop_assert!(
                result.as_ref().unwrap_err().contains("/"),
                "Error message should mention '/' for path '{}'",
                path
            );
        }

        /// **Feature: mded-tauri-migration, Property 5: Path Traversal Rejection**
        /// **Validates: Requirements 13.1, 13.2, 13.3**
        #[test]
        fn prop_path_traversal_rejection_backslash(path in path_with_backslash()) {
            let temp_dir = tempdir().unwrap();
            let base = temp_dir.path();
            
            let result = validate_path(base, &path);
            prop_assert!(result.is_err(), "Path '{}' should be rejected but was accepted", path);
            prop_assert!(
                result.as_ref().unwrap_err().contains("\\"),
                "Error message should mention '\\' for path '{}'",
                path
            );
        }
    }

    // FileSystem tests
    #[test]
    fn test_filesystem_new_with_base() {
        let temp_dir = tempdir().unwrap();
        let fs = FileSystem::new_with_base(temp_dir.path()).unwrap();
        
        assert_eq!(fs.base_dir, temp_dir.path());
        assert_eq!(fs.notes_dir, temp_dir.path().join("notes"));
        assert_eq!(fs.assets_dir, temp_dir.path().join("assets"));
        assert_eq!(fs.config_file, temp_dir.path().join("config.json"));
        assert_eq!(fs.order_file, temp_dir.path().join("note-order.json"));
    }

    #[test]
    fn test_filesystem_ensure_directories() {
        let temp_dir = tempdir().unwrap();
        let fs = FileSystem::new_with_base(temp_dir.path()).unwrap();
        
        // Directories should not exist yet
        assert!(!fs.notes_dir.exists());
        assert!(!fs.assets_dir.exists());
        
        // Create directories
        fs.ensure_directories().unwrap();
        
        // Directories should now exist
        assert!(fs.notes_dir.exists());
        assert!(fs.assets_dir.exists());
        assert!(fs.notes_dir.is_dir());
        assert!(fs.assets_dir.is_dir());
    }

    #[test]
    fn test_filesystem_ensure_directories_idempotent() {
        let temp_dir = tempdir().unwrap();
        let fs = FileSystem::new_with_base(temp_dir.path()).unwrap();
        
        // Call ensure_directories multiple times
        fs.ensure_directories().unwrap();
        fs.ensure_directories().unwrap();
        
        // Should still work
        assert!(fs.notes_dir.exists());
        assert!(fs.assets_dir.exists());
    }

    #[test]
    fn test_filesystem_validate_notes_path() {
        let temp_dir = tempdir().unwrap();
        let fs = FileSystem::new_with_base(temp_dir.path()).unwrap();
        fs.ensure_directories().unwrap();
        
        // Valid path should work
        let result = fs.validate_notes_path("test.md");
        assert!(result.is_ok());
        
        // Invalid path should fail
        let result = fs.validate_notes_path("../test.md");
        assert!(result.is_err());
    }

    #[test]
    fn test_filesystem_validate_assets_path() {
        let temp_dir = tempdir().unwrap();
        let fs = FileSystem::new_with_base(temp_dir.path()).unwrap();
        fs.ensure_directories().unwrap();
        
        // Valid path should work
        let result = fs.validate_assets_path("screenshot.png");
        assert!(result.is_ok());
        
        // Invalid path should fail
        let result = fs.validate_assets_path("../screenshot.png");
        assert!(result.is_err());
    }

    #[test]
    fn test_filesystem_get_folder_path() {
        let temp_dir = tempdir().unwrap();
        let fs = FileSystem::new_with_base(temp_dir.path()).unwrap();
        
        // None should return notes_dir
        assert_eq!(fs.get_folder_path(None), fs.notes_dir);
        
        // Empty string should return notes_dir
        assert_eq!(fs.get_folder_path(Some("")), fs.notes_dir);
        
        // Folder name should return subfolder
        assert_eq!(fs.get_folder_path(Some("work")), fs.notes_dir.join("work"));
    }

    // Folder operations tests
    #[test]
    fn test_list_folders_empty() {
        let temp_dir = tempdir().unwrap();
        let fs = FileSystem::new_with_base(temp_dir.path()).unwrap();
        fs.ensure_directories().unwrap();
        
        let folders = fs.list_folders().unwrap();
        
        // Should have exactly one folder: "All Notes"
        assert_eq!(folders.len(), 1);
        assert_eq!(folders[0].name, "All Notes");
    }

    #[test]
    fn test_list_folders_with_subfolders() {
        let temp_dir = tempdir().unwrap();
        let fs = FileSystem::new_with_base(temp_dir.path()).unwrap();
        fs.ensure_directories().unwrap();
        
        // Create some folders
        std::fs::create_dir(fs.notes_dir.join("work")).unwrap();
        std::fs::create_dir(fs.notes_dir.join("personal")).unwrap();
        
        let folders = fs.list_folders().unwrap();
        
        // Should have 3 folders: "All Notes" + 2 created
        assert_eq!(folders.len(), 3);
        assert_eq!(folders[0].name, "All Notes");
        
        // Other folders should be present (order may vary)
        let folder_names: Vec<&str> = folders.iter().map(|f| f.name.as_str()).collect();
        assert!(folder_names.contains(&"work"));
        assert!(folder_names.contains(&"personal"));
    }

    #[test]
    fn test_create_folder() {
        let temp_dir = tempdir().unwrap();
        let fs = FileSystem::new_with_base(temp_dir.path()).unwrap();
        fs.ensure_directories().unwrap();
        
        fs.create_folder("test-folder").unwrap();
        
        assert!(fs.notes_dir.join("test-folder").exists());
        assert!(fs.notes_dir.join("test-folder").is_dir());
    }

    #[test]
    fn test_create_folder_already_exists() {
        let temp_dir = tempdir().unwrap();
        let fs = FileSystem::new_with_base(temp_dir.path()).unwrap();
        fs.ensure_directories().unwrap();
        
        fs.create_folder("test-folder").unwrap();
        let result = fs.create_folder("test-folder");
        
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("already exists"));
    }

    #[test]
    fn test_delete_folder() {
        let temp_dir = tempdir().unwrap();
        let fs = FileSystem::new_with_base(temp_dir.path()).unwrap();
        fs.ensure_directories().unwrap();
        
        fs.create_folder("to-delete").unwrap();
        assert!(fs.notes_dir.join("to-delete").exists());
        
        fs.delete_folder("to-delete").unwrap();
        assert!(!fs.notes_dir.join("to-delete").exists());
    }

    #[test]
    fn test_delete_folder_not_exists() {
        let temp_dir = tempdir().unwrap();
        let fs = FileSystem::new_with_base(temp_dir.path()).unwrap();
        fs.ensure_directories().unwrap();
        
        let result = fs.delete_folder("nonexistent");
        
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("does not exist"));
    }

    #[test]
    fn test_rename_folder() {
        let temp_dir = tempdir().unwrap();
        let fs = FileSystem::new_with_base(temp_dir.path()).unwrap();
        fs.ensure_directories().unwrap();
        
        fs.create_folder("old-name").unwrap();
        fs.rename_folder("old-name", "new-name").unwrap();
        
        assert!(!fs.notes_dir.join("old-name").exists());
        assert!(fs.notes_dir.join("new-name").exists());
    }

    #[test]
    fn test_rename_folder_preserves_contents() {
        let temp_dir = tempdir().unwrap();
        let fs = FileSystem::new_with_base(temp_dir.path()).unwrap();
        fs.ensure_directories().unwrap();
        
        fs.create_folder("old-name").unwrap();
        
        // Create a file inside the folder
        let file_path = fs.notes_dir.join("old-name").join("test.md");
        std::fs::write(&file_path, "test content").unwrap();
        
        fs.rename_folder("old-name", "new-name").unwrap();
        
        // File should exist in new location
        let new_file_path = fs.notes_dir.join("new-name").join("test.md");
        assert!(new_file_path.exists());
        assert_eq!(std::fs::read_to_string(new_file_path).unwrap(), "test content");
    }

    // Strategy for generating valid folder names (no path separators or traversal)
    fn valid_folder_name() -> impl Strategy<Value = String> {
        "[a-zA-Z][a-zA-Z0-9_-]{0,20}".prop_filter("Must not be empty", |s| !s.is_empty())
    }

    // Strategy for generating a list of unique valid folder names
    fn unique_folder_names(max_count: usize) -> impl Strategy<Value = Vec<String>> {
        proptest::collection::vec(valid_folder_name(), 0..=max_count)
            .prop_map(|names| {
                // Deduplicate names
                let mut unique: Vec<String> = Vec::new();
                for name in names {
                    if !unique.contains(&name) {
                        unique.push(name);
                    }
                }
                unique
            })
    }

    proptest! {
        #![proptest_config(ProptestConfig::with_cases(100))]

        /// **Feature: mded-tauri-migration, Property 9: Folder Listing Includes Virtual Folder**
        /// **Validates: Requirements 10.1**
        /// 
        /// For any state of the notes directory, listing folders should always
        /// include "All Notes" as the first entry.
        #[test]
        fn prop_folder_listing_includes_virtual_folder(folder_names in unique_folder_names(10)) {
            let temp_dir = tempdir().unwrap();
            let fs = FileSystem::new_with_base(temp_dir.path()).unwrap();
            fs.ensure_directories().unwrap();
            
            // Create the folders
            for name in &folder_names {
                fs.create_folder(name).unwrap();
            }
            
            // List folders
            let folders = fs.list_folders().unwrap();
            
            // First folder should always be "All Notes"
            prop_assert!(!folders.is_empty(), "Folder list should never be empty");
            prop_assert_eq!(
                &folders[0].name, 
                "All Notes", 
                "First folder should be 'All Notes', got '{}'", 
                &folders[0].name
            );
            
            // Total count should be 1 (All Notes) + number of created folders
            prop_assert_eq!(
                folders.len(), 
                1 + folder_names.len(),
                "Expected {} folders, got {}", 
                1 + folder_names.len(), 
                folders.len()
            );
            
            // All created folders should be present
            let folder_name_set: std::collections::HashSet<&str> = 
                folders.iter().map(|f| f.name.as_str()).collect();
            for name in &folder_names {
                prop_assert!(
                    folder_name_set.contains(name.as_str()),
                    "Folder '{}' should be in the list",
                    name
                );
            }
        }

        /// **Feature: mded-tauri-migration, Property 11: Folder Deletion Removes All Contents**
        /// **Validates: Requirements 10.3**
        /// 
        /// For any folder containing notes, deleting the folder should result in
        /// all contained notes being removed.
        #[test]
        fn prop_folder_deletion_removes_all_contents(
            folder_name in valid_folder_name(),
            file_count in 0usize..10,
        ) {
            let temp_dir = tempdir().unwrap();
            let fs = FileSystem::new_with_base(temp_dir.path()).unwrap();
            fs.ensure_directories().unwrap();
            
            // Create the folder
            fs.create_folder(&folder_name).unwrap();
            let folder_path = fs.notes_dir.join(&folder_name);
            
            // Create some files inside the folder
            let mut created_files = Vec::new();
            for i in 0..file_count {
                let file_name = format!("note-{}.md", i);
                let file_path = folder_path.join(&file_name);
                std::fs::write(&file_path, format!("Content of note {}", i)).unwrap();
                created_files.push(file_path);
            }
            
            // Verify files were created
            for file_path in &created_files {
                prop_assert!(file_path.exists(), "File should exist before deletion: {:?}", file_path);
            }
            
            // Delete the folder
            fs.delete_folder(&folder_name).unwrap();
            
            // Verify folder no longer exists
            prop_assert!(!folder_path.exists(), "Folder should not exist after deletion");
            
            // Verify all files are gone
            for file_path in &created_files {
                prop_assert!(!file_path.exists(), "File should not exist after folder deletion: {:?}", file_path);
            }
        }
    }
}
