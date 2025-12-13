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
        
        // "All Notes" virtual folder uses empty string as path identifier
        let mut folders = vec![
            FolderInfo {
                name: "All Notes".to_string(),
                path: String::new(),
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
                    let folder_name = name.to_string_lossy().to_string();
                    folders.push(FolderInfo {
                        name: folder_name.clone(),
                        path: folder_name, // Use folder name as path identifier
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
    /// Checks if a folder name is protected/reserved.
    pub fn is_protected_name(&self, name: &str) -> bool {
        matches!(name, "All Notes" | "Trash")
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
        // Validate the folder name
        if name.trim().is_empty() {
             return Err("Folder name cannot be empty or whitespace only".to_string());
        }
        
        if self.is_protected_name(name) {
            return Err(format!("'{}' is a protected folder name", name));
        }

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
        if name.trim().is_empty() {
             return Err("Folder name cannot be empty or whitespace only".to_string());
        }

        if self.is_protected_name(name) {
             return Err(format!("Cannot delete protected folder '{}'", name));
        }

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
        if old_name.trim().is_empty() || new_name.trim().is_empty() {
             return Err("Folder name cannot be empty or whitespace only".to_string());
        }

        if self.is_protected_name(old_name) {
             return Err(format!("Cannot rename protected folder '{}'", old_name));
        }
        
        if self.is_protected_name(new_name) {
             return Err(format!("Cannot rename to protected name '{}'", new_name));
        }

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

    // ==================== Note Operations ====================

    /// Lists all notes, optionally filtered by folder.
    /// 
    /// Returns all .md files with metadata including id, title, modified date,
    /// created date, folder, and pinned status.
    /// 
    /// # Arguments
    /// * `folder` - Optional folder name to filter notes. If None or "All Notes", returns all notes.
    /// 
    /// # Returns
    /// * `Ok(Vec<NoteInfo>)` - List of notes with metadata
    /// * `Err(String)` - If reading fails
    /// 
    /// # Requirements
    /// Validates: Requirements 11.1, 11.2
    pub fn list_notes(&self, folder: Option<&str>) -> Result<Vec<crate::models::NoteInfo>, String> {
        use crate::models::NoteInfo;
        use chrono::{DateTime, Utc};
        
        let mut notes = Vec::new();
        
        // Determine which directories to scan
        let dirs_to_scan: Vec<(PathBuf, String)> = if folder.is_none() || folder == Some("All Notes") || folder == Some("") {
            // Scan all directories including root
            let mut dirs = vec![(self.notes_dir.clone(), String::new())];
            
            // Add subdirectories
            if let Ok(entries) = fs::read_dir(&self.notes_dir) {
                for entry in entries.flatten() {
                    let path = entry.path();
                    if path.is_dir() {
                        if let Some(name) = path.file_name() {
                            let name_str = name.to_string_lossy().to_string();
                            dirs.push((path, name_str));
                        }
                    }
                }
            }
            dirs
        } else {
            // Scan only the specified folder
            let folder_name = folder.unwrap();
            let folder_path = self.get_folder_path(Some(folder_name));
            if !folder_path.exists() {
                return Err(format!("Folder '{}' does not exist", folder_name));
            }
            vec![(folder_path, folder_name.to_string())]
        };
        
        // Load pinned notes from config (placeholder - will be integrated with config module later)
        let pinned_notes: Vec<String> = self.load_pinned_notes().unwrap_or_default();
        
        // Scan each directory for .md files
        for (dir_path, folder_name) in dirs_to_scan {
            if let Ok(entries) = fs::read_dir(&dir_path) {
                for entry in entries.flatten() {
                    let path = entry.path();
                    
                    // Only process .md files
                    if path.is_file() && path.extension().map_or(false, |ext| ext == "md") {
                        if let Some(file_name) = path.file_name() {
                            let file_name_str = file_name.to_string_lossy();
                            let note_id = file_name_str.trim_end_matches(".md").to_string();
                            
                            // Get file metadata
                            let metadata = fs::metadata(&path)
                                .map_err(|e| format!("Failed to read metadata for '{}': {}", file_name_str, e))?;
                            
                            // Get modified time
                            let modified: DateTime<Utc> = metadata.modified()
                                .map(|t| t.into())
                                .unwrap_or_else(|_| Utc::now());
                            
                            // Get created time (use modified as fallback)
                            let created: DateTime<Utc> = metadata.created()
                                .map(|t| t.into())
                                .unwrap_or(modified);
                            
                            // Extract title from first line of file
                            let title = self.extract_note_title(&path).unwrap_or_else(|| note_id.clone());
                            
                            // Check if note is pinned
                            let pinned = pinned_notes.contains(&note_id);
                            
                            notes.push(NoteInfo {
                                id: note_id,
                                title,
                                modified,
                                created,
                                folder: folder_name.clone(),
                                pinned,
                            });
                        }
                    }
                }
            }
        }
        
        // Sort notes: pinned first, then by modified date (newest first)
        notes.sort_by(|a, b| {
            match (a.pinned, b.pinned) {
                (true, false) => std::cmp::Ordering::Less,
                (false, true) => std::cmp::Ordering::Greater,
                _ => b.modified.cmp(&a.modified),
            }
        });
        
        Ok(notes)
    }

    /// Extracts the title from a note file.
    /// 
    /// The title is the first line of the file, with leading '#' characters removed.
    fn extract_note_title(&self, path: &Path) -> Option<String> {
        let content = fs::read_to_string(path).ok()?;
        let first_line = content.lines().next()?;
        let title = first_line.trim_start_matches('#').trim();
        if title.is_empty() {
            None
        } else {
            Some(title.to_string())
        }
    }

    /// Loads pinned notes from config file.
    fn load_pinned_notes(&self) -> Result<Vec<String>, String> {
        use crate::models::Config;
        
        if !self.config_file.exists() {
            return Ok(Vec::new());
        }
        
        let content = fs::read_to_string(&self.config_file)
            .map_err(|e| format!("Failed to read config file: {}", e))?;
        
        let config: Config = serde_json::from_str(&content)
            .unwrap_or_default();
        
        Ok(config.pinned_notes)
    }

    /// Saves pinned notes to config file.
    pub fn save_pinned_notes(&self, pinned_notes: Vec<String>) -> Result<(), String> {
        use crate::models::Config;
        
        let mut config = if self.config_file.exists() {
            let content = fs::read_to_string(&self.config_file)
                .map_err(|e| format!("Failed to read config file: {}", e))?;
            serde_json::from_str(&content).unwrap_or_default()
        } else {
            Config::default()
        };
        
        config.pinned_notes = pinned_notes;
        
        let content = serde_json::to_string_pretty(&config)
            .map_err(|e| format!("Failed to serialize config: {}", e))?;
        
        fs::write(&self.config_file, content)
            .map_err(|e| format!("Failed to write config file: {}", e))
    }

    /// Toggles the pin status of a note.
    /// 
    /// If the note is currently pinned, it will be unpinned.
    /// If the note is currently unpinned, it will be pinned.
    /// 
    /// # Arguments
    /// * `note_id` - The ID of the note to toggle
    /// 
    /// # Returns
    /// * `Ok(bool)` - The new pinned status (true if now pinned, false if now unpinned)
    /// * `Err(String)` - If the operation fails
    /// 
    /// # Requirements
    /// Validates: Requirements 12.1
    pub fn toggle_pin_note(&self, note_id: &str) -> Result<bool, String> {
        let mut pinned_notes = self.load_pinned_notes()?;
        
        let new_pinned_status = if let Some(pos) = pinned_notes.iter().position(|id| id == note_id) {
            // Note is currently pinned, remove it
            pinned_notes.remove(pos);
            false
        } else {
            // Note is not pinned, add it
            pinned_notes.push(note_id.to_string());
            true
        };
        
        // Save the updated pinned notes list
        self.save_pinned_notes(pinned_notes)?;
        
        Ok(new_pinned_status)
    }

    /// Gets the custom note ordering from note-order.json.
    /// 
    /// Returns a map of folder names to ordered note ID arrays.
    /// Returns an empty map if the file doesn't exist.
    /// 
    /// # Returns
    /// * `Ok(HashMap<String, Vec<String>>)` - The note ordering map
    /// * `Err(String)` - If reading fails
    /// 
    /// # Requirements
    /// Validates: Requirements 12.2
    pub fn get_note_order(&self) -> Result<std::collections::HashMap<String, Vec<String>>, String> {
        use std::collections::HashMap;
        
        if !self.order_file.exists() {
            return Ok(HashMap::new());
        }
        
        let content = fs::read_to_string(&self.order_file)
            .map_err(|e| format!("Failed to read note order file: {}", e))?;
        
        let order: HashMap<String, Vec<String>> = serde_json::from_str(&content)
            .map_err(|e| format!("Failed to parse note order file: {}", e))?;
        
        Ok(order)
    }

    /// Saves the custom note ordering to note-order.json.
    /// 
    /// # Arguments
    /// * `order` - A map of folder names to ordered note ID arrays
    /// 
    /// # Returns
    /// * `Ok(())` - If save was successful
    /// * `Err(String)` - If saving fails
    /// 
    /// # Requirements
    /// Validates: Requirements 12.3
    pub fn save_note_order(&self, order: std::collections::HashMap<String, Vec<String>>) -> Result<(), String> {
        let content = serde_json::to_string_pretty(&order)
            .map_err(|e| format!("Failed to serialize note order: {}", e))?;
        
        fs::write(&self.order_file, content)
            .map_err(|e| format!("Failed to write note order file: {}", e))
    }

    /// Reads the content of a note.
    /// 
    /// # Arguments
    /// * `note_id` - The ID of the note (filename without extension)
    /// * `folder` - Optional folder containing the note
    /// 
    /// # Returns
    /// * `Ok(String)` - The note content
    /// * `Err(String)` - If reading fails
    /// 
    /// # Requirements
    /// Validates: Requirements 11.3
    pub fn read_note(&self, note_id: &str, folder: Option<&str>) -> Result<String, String> {
        let file_name = format!("{}.md", note_id);
        
        // Validate the note_id
        validate_path(&self.notes_dir, &file_name)?;
        
        // Get the folder path
        let folder_path = self.get_folder_path(folder);
        
        // Validate folder if specified
        if let Some(f) = folder {
            if !f.is_empty() {
                validate_path(&self.notes_dir, f)?;
            }
        }
        
        let note_path = folder_path.join(&file_name);
        
        if !note_path.exists() {
            return Err(format!("Note '{}' does not exist", note_id));
        }
        
        fs::read_to_string(&note_path)
            .map_err(|e| format!("Failed to read note '{}': {}", note_id, e))
    }

    /// Saves content to a note.
    /// 
    /// # Arguments
    /// * `note_id` - The ID of the note (filename without extension)
    /// * `content` - The content to save
    /// * `folder` - Optional folder containing the note
    /// 
    /// # Returns
    /// * `Ok(())` - If save was successful
    /// * `Err(String)` - If saving fails
    /// 
    /// # Requirements
    /// Validates: Requirements 11.4
    pub fn save_note(&self, note_id: &str, content: &str, folder: Option<&str>) -> Result<(), String> {
        let file_name = format!("{}.md", note_id);
        
        // Validate the note_id
        validate_path(&self.notes_dir, &file_name)?;
        
        // Get the folder path
        let folder_path = self.get_folder_path(folder);
        
        // Validate folder if specified
        if let Some(f) = folder {
            if !f.is_empty() {
                validate_path(&self.notes_dir, f)?;
            }
        }
        
        // Ensure folder exists
        if !folder_path.exists() {
            fs::create_dir_all(&folder_path)
                .map_err(|e| format!("Failed to create folder: {}", e))?;
        }
        
        let note_path = folder_path.join(&file_name);
        
        fs::write(&note_path, content)
            .map_err(|e| format!("Failed to save note '{}': {}", note_id, e))
    }

    /// Creates a new note with a UUID-based filename.
    /// 
    /// # Arguments
    /// * `folder` - Optional folder to create the note in
    /// 
    /// # Returns
    /// * `Ok((String, String))` - Tuple of (note_id, full_path)
    /// * `Err(String)` - If creation fails
    /// 
    /// # Requirements
    /// Validates: Requirements 11.5
    pub fn create_note(&self, folder: Option<&str>) -> Result<(String, String), String> {
        use uuid::Uuid;
        
        // Generate UUID-based filename
        let uuid = Uuid::new_v4();
        let note_id = format!("note-{}", uuid);
        let file_name = format!("{}.md", note_id);
        
        // Get the folder path
        let folder_path = self.get_folder_path(folder);
        
        // Validate folder if specified
        if let Some(f) = folder {
            if !f.is_empty() {
                validate_path(&self.notes_dir, f)?;
            }
        }
        
        // Ensure folder exists
        if !folder_path.exists() {
            fs::create_dir_all(&folder_path)
                .map_err(|e| format!("Failed to create folder: {}", e))?;
        }
        
        let note_path = folder_path.join(&file_name);
        
        // Create file with default content
        let default_content = "# New Note\n\n";
        fs::write(&note_path, default_content)
            .map_err(|e| format!("Failed to create note: {}", e))?;
        
        Ok((note_id, note_path.to_string_lossy().to_string()))
    }

    /// Deletes a note.
    /// 
    /// # Arguments
    /// * `note_id` - The ID of the note to delete
    /// * `folder` - Optional folder containing the note
    /// 
    /// # Returns
    /// * `Ok(())` - If deletion was successful
    /// * `Err(String)` - If deletion fails
    /// 
    /// # Requirements
    /// Validates: Requirements 11.6
    pub fn delete_note(&self, note_id: &str, folder: Option<&str>) -> Result<(), String> {
        let file_name = format!("{}.md", note_id);
        
        // Validate the note_id
        validate_path(&self.notes_dir, &file_name)?;
        
        // Get the folder path
        let folder_path = self.get_folder_path(folder);
        
        // Validate folder if specified
        if let Some(f) = folder {
            if !f.is_empty() {
                validate_path(&self.notes_dir, f)?;
            }
        }
        
        let note_path = folder_path.join(&file_name);
        
        if !note_path.exists() {
            return Err(format!("Note '{}' does not exist", note_id));
        }
        
        fs::remove_file(&note_path)
            .map_err(|e| format!("Failed to delete note '{}': {}", note_id, e))
    }

    /// Renames a note.
    /// 
    /// # Arguments
    /// * `note_id` - The current ID of the note
    /// * `new_name` - The new name for the note (without .md extension)
    /// * `folder` - Optional folder containing the note
    /// 
    /// # Returns
    /// * `Ok(String)` - The new note ID
    /// * `Err(String)` - If renaming fails
    /// 
    /// # Requirements
    /// Validates: Requirements 11.7
    pub fn rename_note(&self, note_id: &str, new_name: &str, folder: Option<&str>) -> Result<String, String> {
        let old_file_name = format!("{}.md", note_id);
        let new_file_name = format!("{}.md", new_name);
        
        // Validate both names
        validate_path(&self.notes_dir, &old_file_name)?;
        validate_path(&self.notes_dir, &new_file_name)?;
        
        // Get the folder path
        let folder_path = self.get_folder_path(folder);
        
        // Validate folder if specified
        if let Some(f) = folder {
            if !f.is_empty() {
                validate_path(&self.notes_dir, f)?;
            }
        }
        
        let old_path = folder_path.join(&old_file_name);
        let new_path = folder_path.join(&new_file_name);
        
        if !old_path.exists() {
            return Err(format!("Note '{}' does not exist", note_id));
        }
        
        if new_path.exists() {
            return Err(format!("Note '{}' already exists", new_name));
        }
        
        fs::rename(&old_path, &new_path)
            .map_err(|e| format!("Failed to rename note '{}' to '{}': {}", note_id, new_name, e))?;
        
        Ok(new_name.to_string())
    }

    /// Moves a note from one folder to another.
    /// 
    /// # Arguments
    /// * `note_id` - The ID of the note to move
    /// * `from_folder` - The source folder
    /// * `to_folder` - The target folder
    /// 
    /// # Returns
    /// * `Ok(())` - If move was successful
    /// * `Err(String)` - If moving fails
    /// 
    /// # Requirements
    /// Validates: Requirements 11.8
    pub fn move_note(&self, note_id: &str, from_folder: &str, to_folder: &str) -> Result<(), String> {
        let file_name = format!("{}.md", note_id);
        
        // Validate the note_id
        validate_path(&self.notes_dir, &file_name)?;
        
        // Validate folders
        let from_path = if from_folder.is_empty() || from_folder == "All Notes" {
            self.notes_dir.clone()
        } else {
            validate_path(&self.notes_dir, from_folder)?;
            self.notes_dir.join(from_folder)
        };
        
        let to_path = if to_folder.is_empty() || to_folder == "All Notes" {
            self.notes_dir.clone()
        } else {
            validate_path(&self.notes_dir, to_folder)?;
            self.notes_dir.join(to_folder)
        };
        
        let source_file = from_path.join(&file_name);
        let target_file = to_path.join(&file_name);
        
        if !source_file.exists() {
            return Err(format!("Note '{}' does not exist in folder '{}'", note_id, from_folder));
        }
        
        // Ensure target folder exists
        if !to_path.exists() {
            fs::create_dir_all(&to_path)
                .map_err(|e| format!("Failed to create target folder: {}", e))?;
        }
        
        if target_file.exists() {
            return Err(format!("Note '{}' already exists in folder '{}'", note_id, to_folder));
        }
        
        fs::rename(&source_file, &target_file)
            .map_err(|e| format!("Failed to move note '{}': {}", note_id, e))
    }

    // ==================== Screenshot Operations ====================

    /// Saves a screenshot from base64 PNG data.
    /// 
    /// Decodes the base64 data and saves it to the assets directory with a unique
    /// timestamp-based filename.
    /// 
    /// # Arguments
    /// * `base64_data` - The base64-encoded PNG image data (may include data URL prefix)
    /// 
    /// # Returns
    /// * `Ok((String, String))` - Tuple of (image_id, absolute_path)
    /// * `Err(String)` - If decoding or saving fails
    /// 
    /// # Requirements
    /// Validates: Requirements 14.1, 14.2
    pub fn save_screenshot(&self, base64_data: &str) -> Result<(String, String), String> {
        use base64::Engine;
        use chrono::Utc;
        
        // Strip data URL prefix if present (e.g., "data:image/png;base64,")
        let base64_content = if let Some(pos) = base64_data.find(",") {
            &base64_data[pos + 1..]
        } else {
            base64_data
        };
        
        // Decode base64 data
        let image_data = base64::engine::general_purpose::STANDARD
            .decode(base64_content)
            .map_err(|e| format!("Failed to decode base64 image data: {}", e))?;
        
        // Validate that we have some data
        if image_data.is_empty() {
            return Err("Image data is empty".to_string());
        }
        
        // Generate unique filename with timestamp
        let timestamp = Utc::now().format("%Y%m%d%H%M%S%3f").to_string();
        let image_id = format!("screenshot-{}", timestamp);
        let file_name = format!("{}.png", image_id);
        
        // Ensure assets directory exists
        if !self.assets_dir.exists() {
            fs::create_dir_all(&self.assets_dir)
                .map_err(|e| format!("Failed to create assets directory: {}", e))?;
        }
        
        // Construct the full path
        let file_path = self.assets_dir.join(&file_name);
        
        // Write the image data
        fs::write(&file_path, &image_data)
            .map_err(|e| format!("Failed to save screenshot: {}", e))?;
        
        Ok((image_id, file_path.to_string_lossy().to_string()))
    }

    /// Returns the absolute path to the assets directory.
    /// 
    /// # Returns
    /// The absolute path to the assets directory as a string
    /// 
    /// # Requirements
    /// Validates: Requirements 14.3
    pub fn get_assets_path(&self) -> String {
        self.assets_dir.to_string_lossy().to_string()
    }

    // ==================== External File Operations ====================

    /// Reads an external markdown file.
    /// 
    /// Validates that the file has a .md extension and reads its content.
    /// 
    /// # Arguments
    /// * `file_path` - The absolute path to the file
    /// 
    /// # Returns
    /// * `Ok((String, String, String))` - Tuple of (content, file_name, absolute_path)
    /// * `Err(String)` - If validation fails or reading fails
    /// 
    /// # Requirements
    /// Validates: Requirements 15.1, 15.2, 15.3
    pub fn read_external_file(&self, file_path: &str) -> Result<(String, String, String), String> {
        let path = std::path::Path::new(file_path);
        
        // Validate .md extension
        match path.extension() {
            Some(ext) if ext == "md" => {}
            _ => return Err("File must have .md extension".to_string()),
        }
        
        // Check if file exists
        if !path.exists() {
            return Err(format!("File does not exist: {}", file_path));
        }
        
        // Check if it's a file (not a directory)
        if !path.is_file() {
            return Err(format!("Path is not a file: {}", file_path));
        }
        
        // Read the file content
        let content = fs::read_to_string(path)
            .map_err(|e| format!("Failed to read file: {}", e))?;
        
        // Get the file name
        let file_name = path
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_else(|| "unknown.md".to_string());
        
        // Get the absolute path
        let absolute_path = path
            .canonicalize()
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_else(|_| file_path.to_string());
        
        Ok((content, file_name, absolute_path))
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

        /// **Feature: mded-tauri-migration, Property 8: Pinned Notes Ordering**
        /// **Validates: Requirements 12.4**
        /// 
        /// For any list of notes with mixed pinned/unpinned status, listing notes
        /// should return all pinned notes before any unpinned notes.
        #[test]
        fn prop_pinned_notes_ordering(
            note_count in 1usize..20,
            pinned_indices in proptest::collection::vec(0usize..20, 0..10),
        ) {
            let temp_dir = tempdir().unwrap();
            let fs = FileSystem::new_with_base(temp_dir.path()).unwrap();
            fs.ensure_directories().unwrap();
            
            // Create notes
            let mut note_ids = Vec::new();
            for i in 0..note_count {
                let note_id = format!("note-{}", i);
                let file_path = fs.notes_dir.join(format!("{}.md", note_id));
                std::fs::write(&file_path, format!("# Note {}\n\nContent", i)).unwrap();
                note_ids.push(note_id);
            }
            
            // Determine which notes should be pinned (filter to valid indices)
            let pinned_notes: Vec<String> = pinned_indices
                .iter()
                .filter(|&&idx| idx < note_count)
                .map(|&idx| note_ids[idx].clone())
                .collect::<std::collections::HashSet<_>>()
                .into_iter()
                .collect();
            
            // Save pinned notes to config
            fs.save_pinned_notes(pinned_notes.clone()).unwrap();
            
            // List notes
            let notes = fs.list_notes(None).unwrap();
            
            // Verify all pinned notes come before unpinned notes
            let mut seen_unpinned = false;
            for note in &notes {
                if note.pinned {
                    prop_assert!(
                        !seen_unpinned,
                        "Pinned note '{}' appears after unpinned notes",
                        note.id
                    );
                } else {
                    seen_unpinned = true;
                }
            }
            
            // Verify pinned status is correct
            for note in &notes {
                let should_be_pinned = pinned_notes.contains(&note.id);
                prop_assert_eq!(
                    note.pinned,
                    should_be_pinned,
                    "Note '{}' pinned status mismatch: expected {}, got {}",
                    note.id,
                    should_be_pinned,
                    note.pinned
                );
            }
        }

        /// **Feature: mded-tauri-migration, Property 1: Note Content Round-Trip**
        /// **Validates: Requirements 11.3, 11.4**
        /// 
        /// For any valid note content string, saving the content to a note and then
        /// reading it back should return the exact same content.
        #[test]
        fn prop_note_content_round_trip(content in ".*") {
            let temp_dir = tempdir().unwrap();
            let fs = FileSystem::new_with_base(temp_dir.path()).unwrap();
            fs.ensure_directories().unwrap();
            
            // Create a note
            let (note_id, _) = fs.create_note(None).unwrap();
            
            // Save content
            fs.save_note(&note_id, &content, None).unwrap();
            
            // Read content back
            let read_content = fs.read_note(&note_id, None).unwrap();
            
            // Verify content matches
            prop_assert_eq!(
                &content,
                &read_content,
                "Content mismatch: saved '{}' but read '{}'",
                &content,
                &read_content
            );
        }

        /// **Feature: mded-tauri-migration, Property 10: Note Creation Generates UUID**
        /// **Validates: Requirements 11.5**
        /// 
        /// For any note creation operation, the generated note ID should match
        /// the UUID format pattern `note-{uuid}.md`.
        #[test]
        fn prop_note_creation_generates_uuid(folder in proptest::option::of(valid_folder_name())) {
            let temp_dir = tempdir().unwrap();
            let fs = FileSystem::new_with_base(temp_dir.path()).unwrap();
            fs.ensure_directories().unwrap();
            
            // Create folder if specified
            if let Some(ref f) = folder {
                fs.create_folder(f).unwrap();
            }
            
            // Create a note
            let (note_id, path) = fs.create_note(folder.as_deref()).unwrap();
            
            // Verify note_id matches UUID pattern: note-{uuid}
            // UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
            let uuid_pattern = regex::Regex::new(
                r"^note-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$"
            ).unwrap();
            
            prop_assert!(
                uuid_pattern.is_match(&note_id),
                "Note ID '{}' does not match UUID pattern 'note-{{uuid}}'",
                note_id
            );
            
            // Verify file was created
            prop_assert!(
                std::path::Path::new(&path).exists(),
                "Note file was not created at '{}'",
                path
            );
            
            // Verify file has default content
            let content = std::fs::read_to_string(&path).unwrap();
            prop_assert_eq!(
                &content,
                "# New Note\n\n",
                "Note content mismatch: expected '# New Note\\n\\n' but got '{}'",
                &content
            );
        }

        /// **Feature: mded-tauri-migration, Property 12: Note Move Preserves Content**
        /// **Validates: Requirements 11.8**
        /// 
        /// For any note with content, moving it from one folder to another should
        /// preserve the exact content.
        #[test]
        fn prop_note_move_preserves_content(
            content in ".*",
            from_folder in valid_folder_name(),
            to_folder in valid_folder_name(),
        ) {
            // Skip if folders are the same
            prop_assume!(from_folder != to_folder);
            
            let temp_dir = tempdir().unwrap();
            let fs = FileSystem::new_with_base(temp_dir.path()).unwrap();
            fs.ensure_directories().unwrap();
            
            // Create both folders
            fs.create_folder(&from_folder).unwrap();
            fs.create_folder(&to_folder).unwrap();
            
            // Create a note in the source folder
            let (note_id, _) = fs.create_note(Some(&from_folder)).unwrap();
            
            // Save content to the note
            fs.save_note(&note_id, &content, Some(&from_folder)).unwrap();
            
            // Move the note
            fs.move_note(&note_id, &from_folder, &to_folder).unwrap();
            
            // Read content from new location
            let read_content = fs.read_note(&note_id, Some(&to_folder)).unwrap();
            
            // Verify content is preserved
            prop_assert_eq!(
                &content,
                &read_content,
                "Content mismatch after move: expected '{}' but got '{}'",
                &content,
                &read_content
            );
            
            // Verify note no longer exists in source folder
            let source_path = fs.notes_dir.join(&from_folder).join(format!("{}.md", note_id));
            prop_assert!(
                !source_path.exists(),
                "Note still exists in source folder after move"
            );
        }

        /// **Feature: mded-tauri-migration, Property 13: Pin Toggle Idempotence**
        /// **Validates: Requirements 12.1**
        /// 
        /// For any note, toggling pin status twice should return the note to its
        /// original pinned state.
        #[test]
        fn prop_pin_toggle_idempotence(
            initial_pinned in any::<bool>(),
        ) {
            let temp_dir = tempdir().unwrap();
            let fs = FileSystem::new_with_base(temp_dir.path()).unwrap();
            fs.ensure_directories().unwrap();
            
            // Create a note
            let (note_id, _) = fs.create_note(None).unwrap();
            
            // Set initial pinned state
            if initial_pinned {
                fs.toggle_pin_note(&note_id).unwrap();
            }
            
            // Verify initial state
            let pinned_before = fs.load_pinned_notes().unwrap().contains(&note_id);
            prop_assert_eq!(
                pinned_before,
                initial_pinned,
                "Initial pinned state mismatch: expected {}, got {}",
                initial_pinned,
                pinned_before
            );
            
            // Toggle pin status twice
            let after_first_toggle = fs.toggle_pin_note(&note_id).unwrap();
            let after_second_toggle = fs.toggle_pin_note(&note_id).unwrap();
            
            // Verify first toggle changed the state
            prop_assert_eq!(
                after_first_toggle,
                !initial_pinned,
                "First toggle should flip state from {} to {}",
                initial_pinned,
                !initial_pinned
            );
            
            // Verify second toggle restored the original state
            prop_assert_eq!(
                after_second_toggle,
                initial_pinned,
                "Second toggle should restore original state: expected {}, got {}",
                initial_pinned,
                after_second_toggle
            );
            
            // Verify final state in config matches
            let final_pinned = fs.load_pinned_notes().unwrap().contains(&note_id);
            prop_assert_eq!(
                final_pinned,
                initial_pinned,
                "Final pinned state in config mismatch: expected {}, got {}",
                initial_pinned,
                final_pinned
            );
        }

        /// **Feature: mded-tauri-migration, Property 2: Note Order Round-Trip**
        /// **Validates: Requirements 12.2, 12.3**
        /// 
        /// For any valid note ordering (map of folder to note ID arrays), saving
        /// the order and then retrieving it should return the exact same ordering.
        #[test]
        fn prop_note_order_round_trip(
            folder_count in 0usize..5,
            notes_per_folder in 0usize..10,
        ) {
            use std::collections::HashMap;
            
            let temp_dir = tempdir().unwrap();
            let fs = FileSystem::new_with_base(temp_dir.path()).unwrap();
            fs.ensure_directories().unwrap();
            
            // Generate a note order map
            let mut order: HashMap<String, Vec<String>> = HashMap::new();
            
            for i in 0..folder_count {
                let folder_name = format!("folder-{}", i);
                let mut note_ids: Vec<String> = Vec::new();
                
                for j in 0..notes_per_folder {
                    note_ids.push(format!("note-{}-{}", i, j));
                }
                
                order.insert(folder_name, note_ids);
            }
            
            // Save the order
            fs.save_note_order(order.clone()).unwrap();
            
            // Read it back
            let read_order = fs.get_note_order().unwrap();
            
            // Verify the order matches
            prop_assert_eq!(
                order.len(),
                read_order.len(),
                "Order map size mismatch: expected {}, got {}",
                order.len(),
                read_order.len()
            );
            
            for (folder, notes) in &order {
                prop_assert!(
                    read_order.contains_key(folder),
                    "Folder '{}' missing from read order",
                    folder
                );
                
                let read_notes = read_order.get(folder).unwrap();
                prop_assert_eq!(
                    notes,
                    read_notes,
                    "Notes mismatch for folder '{}': expected {:?}, got {:?}",
                    folder,
                    notes,
                    read_notes
                );
            }
        }

        /// **Feature: mded-tauri-migration, Property 15: Screenshot Save Returns Valid Path**
        /// **Validates: Requirements 14.1, 14.2**
        /// 
        /// For any valid base64 PNG image data, saving it should return a path
        /// that exists in the assets directory.
        #[test]
        fn prop_screenshot_save_returns_valid_path(
            // Generate random bytes for image data (simulating PNG content)
            image_bytes in proptest::collection::vec(any::<u8>(), 10..1000),
        ) {
            use base64::Engine;
            
            let temp_dir = tempdir().unwrap();
            let fs = FileSystem::new_with_base(temp_dir.path()).unwrap();
            fs.ensure_directories().unwrap();
            
            // Encode the bytes as base64
            let base64_data = base64::engine::general_purpose::STANDARD.encode(&image_bytes);
            
            // Save the screenshot
            let result = fs.save_screenshot(&base64_data);
            prop_assert!(result.is_ok(), "save_screenshot failed: {:?}", result.err());
            
            let (image_id, image_path) = result.unwrap();
            
            // Verify the image_id matches the expected pattern: screenshot-{timestamp}
            let id_pattern = regex::Regex::new(r"^screenshot-\d{17}$").unwrap();
            prop_assert!(
                id_pattern.is_match(&image_id),
                "Image ID '{}' does not match pattern 'screenshot-{{timestamp}}'",
                image_id
            );
            
            // Verify the file exists
            let path = std::path::Path::new(&image_path);
            prop_assert!(
                path.exists(),
                "Screenshot file does not exist at '{}'",
                image_path
            );
            
            // Verify the file is in the assets directory
            prop_assert!(
                path.starts_with(&fs.assets_dir),
                "Screenshot path '{}' is not in assets directory '{}'",
                image_path,
                fs.assets_dir.display()
            );
            
            // Verify the file has .png extension
            prop_assert!(
                image_path.ends_with(".png"),
                "Screenshot path '{}' does not have .png extension",
                image_path
            );
            
            // Verify the file content matches the original bytes
            let saved_content = std::fs::read(&path).unwrap();
            prop_assert_eq!(
                &image_bytes,
                &saved_content,
                "Saved content does not match original bytes"
            );
        }
    }

    // Additional unit tests for screenshot functionality
    #[test]
    fn test_save_screenshot_with_data_url_prefix() {
        use base64::Engine;
        
        let temp_dir = tempdir().unwrap();
        let fs = FileSystem::new_with_base(temp_dir.path()).unwrap();
        fs.ensure_directories().unwrap();
        
        let image_bytes = vec![0x89, 0x50, 0x4E, 0x47]; // PNG magic bytes
        let base64_data = base64::engine::general_purpose::STANDARD.encode(&image_bytes);
        let data_url = format!("data:image/png;base64,{}", base64_data);
        
        let result = fs.save_screenshot(&data_url);
        assert!(result.is_ok());
        
        let (_, image_path) = result.unwrap();
        let saved_content = std::fs::read(&image_path).unwrap();
        assert_eq!(image_bytes, saved_content);
    }

    #[test]
    fn test_save_screenshot_empty_data() {
        let temp_dir = tempdir().unwrap();
        let fs = FileSystem::new_with_base(temp_dir.path()).unwrap();
        fs.ensure_directories().unwrap();
        
        // Empty base64 decodes to empty bytes
        let result = fs.save_screenshot("");
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("empty"));
    }

    #[test]
    fn test_save_screenshot_invalid_base64() {
        let temp_dir = tempdir().unwrap();
        let fs = FileSystem::new_with_base(temp_dir.path()).unwrap();
        fs.ensure_directories().unwrap();
        
        let result = fs.save_screenshot("not-valid-base64!!!");
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("decode"));
    }

    #[test]
    fn test_get_assets_path() {
        let temp_dir = tempdir().unwrap();
        let fs = FileSystem::new_with_base(temp_dir.path()).unwrap();
        
        let assets_path = fs.get_assets_path();
        assert!(assets_path.contains("assets"));
        assert_eq!(assets_path, fs.assets_dir.to_string_lossy().to_string());
    }

    // Strategy for generating non-.md file extensions
    fn non_md_extension() -> impl Strategy<Value = String> {
        prop_oneof![
            Just("txt".to_string()),
            Just("doc".to_string()),
            Just("pdf".to_string()),
            Just("html".to_string()),
            Just("json".to_string()),
            Just("xml".to_string()),
            Just("rs".to_string()),
            Just("py".to_string()),
            Just("js".to_string()),
            Just("css".to_string()),
            Just("".to_string()),  // No extension
            "[a-zA-Z]{1,5}".prop_filter("Must not be md", |s| s.to_lowercase() != "md"),
        ]
    }

    proptest! {
        #![proptest_config(ProptestConfig::with_cases(100))]

        /// **Feature: mded-tauri-migration, Property 14: External File Extension Validation**
        /// **Validates: Requirements 15.1**
        /// 
        /// For any file path not ending in ".md", the external file reader should
        /// reject it with an error.
        #[test]
        fn prop_external_file_extension_validation(
            file_name in "[a-zA-Z][a-zA-Z0-9_-]{0,20}",
            extension in non_md_extension(),
        ) {
            let temp_dir = tempdir().unwrap();
            let fs = FileSystem::new_with_base(temp_dir.path()).unwrap();
            fs.ensure_directories().unwrap();
            
            // Create a file with the non-.md extension
            let full_name = if extension.is_empty() {
                file_name.clone()
            } else {
                format!("{}.{}", file_name, extension)
            };
            let file_path = temp_dir.path().join(&full_name);
            std::fs::write(&file_path, "test content").unwrap();
            
            // Try to read the file
            let result = fs.read_external_file(file_path.to_str().unwrap());
            
            // Should fail with extension error
            prop_assert!(
                result.is_err(),
                "read_external_file should reject file '{}' without .md extension",
                full_name
            );
            prop_assert!(
                result.as_ref().unwrap_err().contains(".md"),
                "Error message should mention .md extension requirement, got: {}",
                result.unwrap_err()
            );
        }

        /// Test that .md files are accepted
        #[test]
        fn prop_external_file_accepts_md_extension(
            file_name in "[a-zA-Z][a-zA-Z0-9_-]{0,20}",
            content in ".*",
        ) {
            let temp_dir = tempdir().unwrap();
            let fs = FileSystem::new_with_base(temp_dir.path()).unwrap();
            fs.ensure_directories().unwrap();
            
            // Create a .md file
            let full_name = format!("{}.md", file_name);
            let file_path = temp_dir.path().join(&full_name);
            std::fs::write(&file_path, &content).unwrap();
            
            // Try to read the file
            let result = fs.read_external_file(file_path.to_str().unwrap());
            
            // Should succeed
            prop_assert!(
                result.is_ok(),
                "read_external_file should accept .md file '{}', got error: {:?}",
                full_name,
                result.err()
            );
            
            let (read_content, read_name, read_path) = result.unwrap();
            
            // Verify content matches
            prop_assert_eq!(
                &content,
                &read_content,
                "Content mismatch: expected '{}', got '{}'",
                &content,
                &read_content
            );
            
            // Verify file name matches
            prop_assert_eq!(
                &full_name,
                &read_name,
                "File name mismatch: expected '{}', got '{}'",
                &full_name,
                &read_name
            );
            
            // Verify path is absolute
            prop_assert!(
                std::path::Path::new(&read_path).is_absolute(),
                "Returned path '{}' should be absolute",
                read_path
            );
        }
    }

    // Unit tests for external file reading
    #[test]
    fn test_read_external_file_not_exists() {
        let temp_dir = tempdir().unwrap();
        let fs = FileSystem::new_with_base(temp_dir.path()).unwrap();
        
        let file_path = temp_dir.path().join("nonexistent.md");
        let result = fs.read_external_file(file_path.to_str().unwrap());
        
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("does not exist"));
    }

    #[test]
    fn test_read_external_file_is_directory() {
        let temp_dir = tempdir().unwrap();
        let fs = FileSystem::new_with_base(temp_dir.path()).unwrap();
        
        // Create a directory with .md name (unusual but possible)
        let dir_path = temp_dir.path().join("folder.md");
        std::fs::create_dir(&dir_path).unwrap();
        
        let result = fs.read_external_file(dir_path.to_str().unwrap());
        
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("not a file"));
    }
}
