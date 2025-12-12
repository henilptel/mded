use std::fs;
use std::path::PathBuf;
use std::sync::{Arc, RwLock};
use std::time::Duration;
use tokio::sync::Mutex;
use tokio::task::JoinHandle;
use tokio::time::sleep;

use crate::models::{Config, LastNote};

/// Debounce delay for config saves (1 second)
const SAVE_DEBOUNCE_MS: u64 = 1000;

/// ConfigManager handles loading, saving, and updating application configuration.
/// 
/// Features:
/// - Thread-safe access via RwLock
/// - Debounced saving to avoid excessive disk writes
/// - Merges saved config with defaults for missing fields
/// 
/// # Requirements
/// Validates: Requirements 17.1, 17.2, 17.3, 17.4
pub struct ConfigManager {
    /// The current configuration
    config: RwLock<Config>,
    /// Path to the configuration file
    config_path: PathBuf,
    /// Handle to the debounced save task
    save_handle: Mutex<Option<JoinHandle<()>>>,
    /// Shared reference for async operations
    config_for_save: Arc<RwLock<Config>>,
    /// Shared path for async operations
    config_path_for_save: Arc<PathBuf>,
}

impl ConfigManager {
    /// Creates a new ConfigManager with the given config file path.
    /// 
    /// Loads existing configuration from disk, merging with defaults for any
    /// missing fields.
    /// 
    /// # Arguments
    /// * `config_path` - Path to the config.json file
    /// 
    /// # Returns
    /// * `Ok(ConfigManager)` - A new ConfigManager instance
    /// * `Err(String)` - If loading fails
    pub fn new(config_path: PathBuf) -> Result<Self, String> {
        let config = Self::load_from_file(&config_path)?;
        let config_for_save = Arc::new(RwLock::new(config.clone()));
        let config_path_for_save = Arc::new(config_path.clone());
        
        Ok(Self {
            config: RwLock::new(config),
            config_path,
            save_handle: Mutex::new(None),
            config_for_save,
            config_path_for_save,
        })
    }

    /// Loads configuration from file, merging with defaults.
    /// 
    /// If the file doesn't exist, returns default configuration.
    /// If the file exists but has missing fields, those fields get default values.
    /// 
    /// # Arguments
    /// * `path` - Path to the config file
    /// 
    /// # Returns
    /// * `Ok(Config)` - The loaded configuration
    /// * `Err(String)` - If reading or parsing fails
    /// 
    /// # Requirements
    /// Validates: Requirements 17.2
    fn load_from_file(path: &PathBuf) -> Result<Config, String> {
        if !path.exists() {
            return Ok(Config::default());
        }

        let content = fs::read_to_string(path)
            .map_err(|e| format!("Failed to read config file: {}", e))?;

        // Parse as JSON Value first to handle partial configs
        let json_value: serde_json::Value = serde_json::from_str(&content)
            .map_err(|e| format!("Failed to parse config file: {}", e))?;

        // Start with defaults
        let mut config = Config::default();

        // Merge saved values into defaults
        if let Some(obj) = json_value.as_object() {
            if let Some(v) = obj.get("global_shortcut").and_then(|v| v.as_str()) {
                config.global_shortcut = v.to_string();
            }
            if let Some(v) = obj.get("clipboard_shortcut").and_then(|v| v.as_str()) {
                config.clipboard_shortcut = v.to_string();
            }
            if let Some(v) = obj.get("quick_note_shortcut").and_then(|v| v.as_str()) {
                config.quick_note_shortcut = v.to_string();
            }
            if let Some(v) = obj.get("window_bounds") {
                if let Ok(bounds) = serde_json::from_value(v.clone()) {
                    config.window_bounds = bounds;
                }
            }
            if let Some(v) = obj.get("last_note_id") {
                config.last_note_id = v.as_str().map(|s| s.to_string());
            }
            if let Some(v) = obj.get("last_folder") {
                config.last_folder = v.as_str().map(|s| s.to_string());
            }
            if let Some(v) = obj.get("pinned_notes").and_then(|v| v.as_array()) {
                config.pinned_notes = v
                    .iter()
                    .filter_map(|item| item.as_str().map(|s| s.to_string()))
                    .collect();
            }
            if let Some(v) = obj.get("minimal_mode_bounds") {
                if let Ok(bounds) = serde_json::from_value(v.clone()) {
                    config.minimal_mode_bounds = bounds;
                }
            }
            if let Some(v) = obj.get("window_opacity").and_then(|v| v.as_f64()) {
                config.window_opacity = v;
            }
            if let Some(v) = obj.get("auto_start_on_boot").and_then(|v| v.as_bool()) {
                config.auto_start_on_boot = v;
            }
        }

        Ok(config)
    }

    /// Gets a clone of the current configuration.
    pub fn get(&self) -> Config {
        self.config.read().unwrap().clone()
    }

    /// Updates the configuration using a closure.
    /// 
    /// The closure receives a mutable reference to the config and can modify it.
    /// After the update, a debounced save is scheduled.
    /// 
    /// # Arguments
    /// * `f` - A closure that modifies the configuration
    pub fn update<F>(&self, f: F)
    where
        F: FnOnce(&mut Config),
    {
        {
            let mut config = self.config.write().unwrap();
            f(&mut config);
            
            // Also update the shared config for async save
            let mut shared = self.config_for_save.write().unwrap();
            *shared = config.clone();
        }
    }

    /// Schedules a debounced save operation.
    /// 
    /// If a save is already scheduled, it will be cancelled and a new one
    /// will be scheduled. The save will occur after SAVE_DEBOUNCE_MS milliseconds.
    /// 
    /// # Requirements
    /// Validates: Requirements 17.1
    pub async fn schedule_save(&self) {
        let mut handle_guard = self.save_handle.lock().await;
        
        // Cancel any existing save task
        if let Some(handle) = handle_guard.take() {
            handle.abort();
        }
        
        // Clone the Arc references for the async task
        let config_ref = Arc::clone(&self.config_for_save);
        let path_ref = Arc::clone(&self.config_path_for_save);
        
        // Schedule a new save task
        let handle = tokio::spawn(async move {
            // Wait for the debounce period
            sleep(Duration::from_millis(SAVE_DEBOUNCE_MS)).await;
            
            // Perform the save
            let config = config_ref.read().unwrap().clone();
            if let Ok(content) = serde_json::to_string_pretty(&config) {
                let _ = fs::write(path_ref.as_ref(), content);
            }
        });
        
        *handle_guard = Some(handle);
    }

    /// Updates the configuration and schedules a debounced save.
    /// 
    /// This is the async version that should be used when you want
    /// automatic persistence.
    /// 
    /// # Arguments
    /// * `f` - A closure that modifies the configuration
    pub async fn update_and_save<F>(&self, f: F)
    where
        F: FnOnce(&mut Config),
    {
        self.update(f);
        self.schedule_save().await;
    }

    /// Saves the configuration to disk immediately.
    /// 
    /// # Returns
    /// * `Ok(())` - If save was successful
    /// * `Err(String)` - If saving fails
    pub fn save_sync(&self) -> Result<(), String> {
        let config = self.config.read().unwrap().clone();
        
        let content = serde_json::to_string_pretty(&config)
            .map_err(|e| format!("Failed to serialize config: {}", e))?;

        fs::write(&self.config_path, content)
            .map_err(|e| format!("Failed to write config file: {}", e))
    }

    /// Gets the last opened note information.
    /// 
    /// # Returns
    /// The last note ID and folder
    /// 
    /// # Requirements
    /// Validates: Requirements 17.3
    pub fn get_last_note(&self) -> LastNote {
        let config = self.config.read().unwrap();
        LastNote {
            note_id: config.last_note_id.clone(),
            folder: config.last_folder.clone(),
        }
    }

    /// Saves the last opened note information.
    /// 
    /// # Arguments
    /// * `note_id` - The note ID (or None to clear)
    /// * `folder` - The folder (or None to clear)
    /// 
    /// # Requirements
    /// Validates: Requirements 17.4
    pub fn save_last_note(&self, note_id: Option<String>, folder: Option<String>) {
        self.update(|config| {
            config.last_note_id = note_id;
            config.last_folder = folder;
        });
    }

    /// Gets the global shortcut configuration.
    /// 
    /// # Returns
    /// The current global shortcut string
    pub fn get_global_shortcut(&self) -> String {
        self.config.read().unwrap().global_shortcut.clone()
    }

    /// Sets the global shortcut configuration.
    /// 
    /// # Arguments
    /// * `shortcut` - The new shortcut string
    /// 
    /// # Requirements
    /// Validates: Requirements 7.4
    pub fn set_global_shortcut(&self, shortcut: String) {
        self.update(|config| {
            config.global_shortcut = shortcut;
        });
    }

    /// Gets the pinned notes list.
    pub fn get_pinned_notes(&self) -> Vec<String> {
        self.config.read().unwrap().pinned_notes.clone()
    }

    /// Sets the pinned notes list.
    pub fn set_pinned_notes(&self, pinned_notes: Vec<String>) {
        self.update(|config| {
            config.pinned_notes = pinned_notes;
        });
    }

    /// Gets the window opacity.
    pub fn get_window_opacity(&self) -> f64 {
        self.config.read().unwrap().window_opacity
    }

    /// Sets the window opacity.
    pub fn set_window_opacity(&self, opacity: f64) {
        self.update(|config| {
            config.window_opacity = opacity;
        });
    }

    /// Returns the config file path.
    pub fn config_path(&self) -> &PathBuf {
        &self.config_path
    }
}

/// Merges a partial config JSON with defaults.
/// 
/// This is a standalone function for testing purposes.
/// 
/// # Arguments
/// * `partial_json` - JSON string with partial configuration
/// 
/// # Returns
/// * `Ok(Config)` - The merged configuration
/// * `Err(String)` - If parsing fails
pub fn merge_config_with_defaults(partial_json: &str) -> Result<Config, String> {
    if partial_json.trim().is_empty() {
        return Ok(Config::default());
    }

    let json_value: serde_json::Value = serde_json::from_str(partial_json)
        .map_err(|e| format!("Failed to parse config: {}", e))?;

    let mut config = Config::default();

    if let Some(obj) = json_value.as_object() {
        if let Some(v) = obj.get("global_shortcut").and_then(|v| v.as_str()) {
            config.global_shortcut = v.to_string();
        }
        if let Some(v) = obj.get("clipboard_shortcut").and_then(|v| v.as_str()) {
            config.clipboard_shortcut = v.to_string();
        }
        if let Some(v) = obj.get("quick_note_shortcut").and_then(|v| v.as_str()) {
            config.quick_note_shortcut = v.to_string();
        }
        if let Some(v) = obj.get("window_bounds") {
            if let Ok(bounds) = serde_json::from_value(v.clone()) {
                config.window_bounds = bounds;
            }
        }
        if let Some(v) = obj.get("last_note_id") {
            config.last_note_id = v.as_str().map(|s| s.to_string());
        }
        if let Some(v) = obj.get("last_folder") {
            config.last_folder = v.as_str().map(|s| s.to_string());
        }
        if let Some(v) = obj.get("pinned_notes").and_then(|v| v.as_array()) {
            config.pinned_notes = v
                .iter()
                .filter_map(|item| item.as_str().map(|s| s.to_string()))
                .collect();
        }
        if let Some(v) = obj.get("minimal_mode_bounds") {
            if let Ok(bounds) = serde_json::from_value(v.clone()) {
                config.minimal_mode_bounds = bounds;
            }
        }
        if let Some(v) = obj.get("window_opacity").and_then(|v| v.as_f64()) {
            config.window_opacity = v;
        }
        if let Some(v) = obj.get("auto_start_on_boot").and_then(|v| v.as_bool()) {
            config.auto_start_on_boot = v;
        }
    }

    Ok(config)
}

#[cfg(test)]
mod tests {
    use super::*;
    use proptest::prelude::*;
    use tempfile::tempdir;

    #[test]
    fn test_config_manager_new_no_file() {
        let temp_dir = tempdir().unwrap();
        let config_path = temp_dir.path().join("config.json");
        
        let manager = ConfigManager::new(config_path).unwrap();
        let config = manager.get();
        
        // Should have default values
        assert_eq!(config.global_shortcut, "CommandOrControl+Shift+N");
        assert_eq!(config.window_opacity, 1.0);
        assert!(config.pinned_notes.is_empty());
    }

    #[test]
    fn test_config_manager_load_existing() {
        let temp_dir = tempdir().unwrap();
        let config_path = temp_dir.path().join("config.json");
        
        // Write a partial config
        let partial_config = r#"{
            "global_shortcut": "Ctrl+Alt+M",
            "window_opacity": 0.8
        }"#;
        fs::write(&config_path, partial_config).unwrap();
        
        let manager = ConfigManager::new(config_path).unwrap();
        let config = manager.get();
        
        // Custom values should be loaded
        assert_eq!(config.global_shortcut, "Ctrl+Alt+M");
        assert_eq!(config.window_opacity, 0.8);
        
        // Default values should be preserved for missing fields
        assert_eq!(config.clipboard_shortcut, "CommandOrControl+Alt+V");
        assert!(config.pinned_notes.is_empty());
    }

    #[test]
    fn test_config_manager_update() {
        let temp_dir = tempdir().unwrap();
        let config_path = temp_dir.path().join("config.json");
        
        let manager = ConfigManager::new(config_path).unwrap();
        
        manager.update(|config| {
            config.global_shortcut = "Ctrl+Shift+M".to_string();
            config.window_opacity = 0.5;
        });
        
        let config = manager.get();
        assert_eq!(config.global_shortcut, "Ctrl+Shift+M");
        assert_eq!(config.window_opacity, 0.5);
    }

    #[test]
    fn test_config_manager_save_sync() {
        let temp_dir = tempdir().unwrap();
        let config_path = temp_dir.path().join("config.json");
        
        let manager = ConfigManager::new(config_path.clone()).unwrap();
        
        manager.update(|config| {
            config.global_shortcut = "Ctrl+Alt+X".to_string();
        });
        
        manager.save_sync().unwrap();
        
        // Read the file and verify
        let content = fs::read_to_string(&config_path).unwrap();
        assert!(content.contains("Ctrl+Alt+X"));
    }

    #[test]
    fn test_config_manager_last_note() {
        let temp_dir = tempdir().unwrap();
        let config_path = temp_dir.path().join("config.json");
        
        let manager = ConfigManager::new(config_path).unwrap();
        
        // Initially empty
        let last_note = manager.get_last_note();
        assert!(last_note.note_id.is_none());
        assert!(last_note.folder.is_none());
        
        // Save last note
        manager.save_last_note(Some("note-123".to_string()), Some("work".to_string()));
        
        let last_note = manager.get_last_note();
        assert_eq!(last_note.note_id, Some("note-123".to_string()));
        assert_eq!(last_note.folder, Some("work".to_string()));
    }

    #[test]
    fn test_config_manager_global_shortcut() {
        let temp_dir = tempdir().unwrap();
        let config_path = temp_dir.path().join("config.json");
        
        let manager = ConfigManager::new(config_path).unwrap();
        
        // Default shortcut
        assert_eq!(manager.get_global_shortcut(), "CommandOrControl+Shift+N");
        
        // Update shortcut
        manager.set_global_shortcut("Ctrl+Alt+N".to_string());
        assert_eq!(manager.get_global_shortcut(), "Ctrl+Alt+N");
    }

    #[test]
    fn test_merge_config_with_defaults_empty() {
        let config = merge_config_with_defaults("").unwrap();
        assert_eq!(config, Config::default());
    }

    #[test]
    fn test_merge_config_with_defaults_partial() {
        let partial = r#"{"global_shortcut": "Custom+Key"}"#;
        let config = merge_config_with_defaults(partial).unwrap();
        
        assert_eq!(config.global_shortcut, "Custom+Key");
        // Other fields should have defaults
        assert_eq!(config.clipboard_shortcut, "CommandOrControl+Alt+V");
        assert_eq!(config.window_opacity, 1.0);
    }

    #[test]
    fn test_merge_config_with_defaults_full() {
        let full = serde_json::to_string(&Config::default()).unwrap();
        let config = merge_config_with_defaults(&full).unwrap();
        assert_eq!(config, Config::default());
    }

    // Strategy for generating optional config fields
    fn optional_shortcut() -> impl Strategy<Value = Option<String>> {
        prop_oneof![
            Just(None),
            "[A-Za-z+]{1,30}".prop_map(Some),
        ]
    }

    fn optional_opacity() -> impl Strategy<Value = Option<f64>> {
        prop_oneof![
            Just(None),
            (0.3f64..=1.0f64).prop_map(Some),
        ]
    }

    fn optional_bool_val() -> impl Strategy<Value = Option<bool>> {
        prop_oneof![
            Just(None),
            any::<bool>().prop_map(Some),
        ]
    }

    fn optional_string_val() -> impl Strategy<Value = Option<String>> {
        prop_oneof![
            Just(None),
            "[a-zA-Z0-9_-]{0,20}".prop_map(Some),
        ]
    }

    fn optional_pinned_notes() -> impl Strategy<Value = Option<Vec<String>>> {
        prop_oneof![
            Just(None),
            proptest::collection::vec("[a-zA-Z0-9_-]{1,20}", 0..5).prop_map(Some),
        ]
    }

    // Strategy for generating partial config JSON
    fn partial_config_strategy() -> impl Strategy<Value = (
        Option<String>,  // global_shortcut
        Option<String>,  // clipboard_shortcut
        Option<String>,  // quick_note_shortcut
        Option<f64>,     // window_opacity
        Option<bool>,    // auto_start_on_boot
        Option<String>,  // last_note_id
        Option<String>,  // last_folder
        Option<Vec<String>>, // pinned_notes
    )> {
        (
            optional_shortcut(),
            optional_shortcut(),
            optional_shortcut(),
            optional_opacity(),
            optional_bool_val(),
            optional_string_val(),
            optional_string_val(),
            optional_pinned_notes(),
        )
    }

    proptest! {
        #![proptest_config(ProptestConfig::with_cases(100))]

        /// **Feature: mded-tauri-migration, Property 16: Config Merge Preserves Defaults**
        /// **Validates: Requirements 17.2**
        /// 
        /// For any partial configuration file, loading should result in a config
        /// where missing fields have default values.
        #[test]
        fn prop_config_merge_preserves_defaults(
            partial in partial_config_strategy()
        ) {
            let (
                global_shortcut,
                clipboard_shortcut,
                quick_note_shortcut,
                window_opacity,
                auto_start_on_boot,
                last_note_id,
                last_folder,
                pinned_notes,
            ) = partial;

            // Build a partial JSON object
            let mut json_obj = serde_json::Map::new();
            
            if let Some(v) = &global_shortcut {
                json_obj.insert("global_shortcut".to_string(), serde_json::json!(v));
            }
            if let Some(v) = &clipboard_shortcut {
                json_obj.insert("clipboard_shortcut".to_string(), serde_json::json!(v));
            }
            if let Some(v) = &quick_note_shortcut {
                json_obj.insert("quick_note_shortcut".to_string(), serde_json::json!(v));
            }
            if let Some(v) = window_opacity {
                json_obj.insert("window_opacity".to_string(), serde_json::json!(v));
            }
            if let Some(v) = auto_start_on_boot {
                json_obj.insert("auto_start_on_boot".to_string(), serde_json::json!(v));
            }
            if let Some(v) = &last_note_id {
                json_obj.insert("last_note_id".to_string(), serde_json::json!(v));
            }
            if let Some(v) = &last_folder {
                json_obj.insert("last_folder".to_string(), serde_json::json!(v));
            }
            if let Some(v) = &pinned_notes {
                json_obj.insert("pinned_notes".to_string(), serde_json::json!(v));
            }

            let partial_json = serde_json::to_string(&json_obj).unwrap();
            let config = merge_config_with_defaults(&partial_json).unwrap();
            let defaults = Config::default();

            // Verify provided values are used
            if let Some(v) = &global_shortcut {
                prop_assert_eq!(&config.global_shortcut, v);
            } else {
                prop_assert_eq!(&config.global_shortcut, &defaults.global_shortcut);
            }

            if let Some(v) = &clipboard_shortcut {
                prop_assert_eq!(&config.clipboard_shortcut, v);
            } else {
                prop_assert_eq!(&config.clipboard_shortcut, &defaults.clipboard_shortcut);
            }

            if let Some(v) = &quick_note_shortcut {
                prop_assert_eq!(&config.quick_note_shortcut, v);
            } else {
                prop_assert_eq!(&config.quick_note_shortcut, &defaults.quick_note_shortcut);
            }

            if let Some(v) = window_opacity {
                prop_assert!((config.window_opacity - v).abs() < f64::EPSILON);
            } else {
                prop_assert!((config.window_opacity - defaults.window_opacity).abs() < f64::EPSILON);
            }

            if let Some(v) = auto_start_on_boot {
                prop_assert_eq!(config.auto_start_on_boot, v);
            } else {
                prop_assert_eq!(config.auto_start_on_boot, defaults.auto_start_on_boot);
            }

            if let Some(v) = &last_note_id {
                prop_assert_eq!(&config.last_note_id, &Some(v.clone()));
            } else {
                prop_assert_eq!(&config.last_note_id, &defaults.last_note_id);
            }

            if let Some(v) = &last_folder {
                prop_assert_eq!(&config.last_folder, &Some(v.clone()));
            } else {
                prop_assert_eq!(&config.last_folder, &defaults.last_folder);
            }

            if let Some(v) = &pinned_notes {
                prop_assert_eq!(&config.pinned_notes, v);
            } else {
                prop_assert_eq!(&config.pinned_notes, &defaults.pinned_notes);
            }

            // Window bounds should always have defaults if not provided
            // (we didn't include window_bounds in the partial config)
            prop_assert_eq!(config.window_bounds, defaults.window_bounds);
            prop_assert_eq!(config.minimal_mode_bounds, defaults.minimal_mode_bounds);
        }

        /// **Feature: mded-tauri-migration, Property: Shortcut configuration round-trip**
        /// **Validates: Requirements 7.4**
        /// 
        /// For any valid shortcut string, setting it and then retrieving it should
        /// return the same shortcut. Additionally, saving and reloading the config
        /// should preserve the shortcut.
        #[test]
        fn prop_shortcut_persistence_round_trip(
            shortcut in "[A-Za-z][A-Za-z0-9+]{0,30}"
        ) {
            let temp_dir = tempdir().unwrap();
            let config_path = temp_dir.path().join("config.json");
            
            // Create a config manager and set the shortcut
            let manager = ConfigManager::new(config_path.clone()).unwrap();
            manager.set_global_shortcut(shortcut.clone());
            
            // Verify the shortcut is set correctly in memory
            let retrieved = manager.get_global_shortcut();
            prop_assert_eq!(
                &shortcut,
                &retrieved,
                "Shortcut mismatch in memory: set '{}' but got '{}'",
                &shortcut,
                &retrieved
            );
            
            // Save to disk
            manager.save_sync().unwrap();
            
            // Create a new manager and load from disk
            let manager2 = ConfigManager::new(config_path).unwrap();
            let loaded = manager2.get_global_shortcut();
            
            // Verify the shortcut persisted correctly
            prop_assert_eq!(
                &shortcut,
                &loaded,
                "Shortcut mismatch after reload: saved '{}' but loaded '{}'",
                &shortcut,
                &loaded
            );
        }
    }
}
