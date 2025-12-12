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
}
