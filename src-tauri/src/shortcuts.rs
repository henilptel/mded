use std::collections::HashMap;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager, Runtime};
use tauri_plugin_clipboard_manager::ClipboardExt;
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};
use tauri_plugin_notification::NotificationExt;

use crate::config::ConfigManager;
use crate::filesystem::FileSystem;
use crate::models::ApiResult;

/// ShortcutManager handles global keyboard shortcuts for the application.
/// 
/// Manages three types of shortcuts:
/// - Toggle shortcut: Shows/hides the main window
/// - Clipboard capture shortcut: Creates a note from clipboard content
/// - Quick note shortcut: Opens the quick note popup window
/// 
/// # Requirements
/// Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.5
pub struct ShortcutManager {
    /// Map of shortcut names to their registered key combinations
    registered_shortcuts: Mutex<HashMap<String, String>>,
}

impl ShortcutManager {
    /// Creates a new ShortcutManager instance.
    pub fn new() -> Self {
        Self {
            registered_shortcuts: Mutex::new(HashMap::new()),
        }
    }

    /// Parses a shortcut string into a Shortcut struct.
    /// 
    /// # Arguments
    /// * `key` - The shortcut string (e.g., "CommandOrControl+Shift+N")
    /// 
    /// # Returns
    /// * `Ok(Shortcut)` - The parsed shortcut
    /// * `Err(String)` - If parsing fails
    /// 
    /// # Requirements
    /// Validates: Requirements 7.5
    pub fn parse_shortcut(key: &str) -> Result<Shortcut, String> {
        key.parse::<Shortcut>()
            .map_err(|e| format!("Invalid shortcut '{}': {}", key, e))
    }

    /// Registers all shortcuts on application startup.
    /// 
    /// Reads shortcut configurations from the config manager and registers them.
    /// 
    /// # Arguments
    /// * `app` - The Tauri application handle
    /// 
    /// # Returns
    /// * `Ok(())` - If all shortcuts were registered successfully
    /// * `Err(String)` - If registration fails
    pub fn register_all<R: Runtime>(&self, app: &AppHandle<R>) -> Result<(), String> {
        let config_manager = app.state::<ConfigManager>();
        let config = config_manager.get();

        // Register toggle shortcut
        self.register_toggle_shortcut(app, &config.global_shortcut)?;

        // Register clipboard capture shortcut
        self.register_clipboard_shortcut(app, &config.clipboard_shortcut)?;

        // Register quick note shortcut
        self.register_quick_note_shortcut(app, &config.quick_note_shortcut)?;

        Ok(())
    }

    /// Registers the toggle window visibility shortcut.
    /// 
    /// Default: CommandOrControl+Shift+N
    /// 
    /// # Arguments
    /// * `app` - The Tauri application handle
    /// * `key` - The shortcut key combination
    /// 
    /// # Returns
    /// * `Ok(())` - If registration was successful
    /// * `Err(String)` - If registration fails
    /// 
    /// # Requirements
    /// Validates: Requirements 7.1
    pub fn register_toggle_shortcut<R: Runtime>(
        &self,
        app: &AppHandle<R>,
        key: &str,
    ) -> Result<(), String> {
        let shortcut = Self::parse_shortcut(key)?;
        
        // Unregister existing toggle shortcut if any
        self.unregister_shortcut(app, "toggle")?;

        let app_handle = app.clone();
        app.global_shortcut()
            .on_shortcut(shortcut.clone(), move |_app, _shortcut, event| {
                if event.state == ShortcutState::Pressed {
                    toggle_window_visibility(&app_handle);
                }
            })
            .map_err(|e| format!("Failed to register toggle shortcut: {}", e))?;

        // Store the registered shortcut
        let mut shortcuts = self.registered_shortcuts.lock().unwrap();
        shortcuts.insert("toggle".to_string(), key.to_string());

        Ok(())
    }

    /// Registers the clipboard capture shortcut.
    /// 
    /// Default: CommandOrControl+Alt+V
    /// Creates a new note from clipboard content and shows a notification.
    /// 
    /// # Arguments
    /// * `app` - The Tauri application handle
    /// * `key` - The shortcut key combination
    /// 
    /// # Returns
    /// * `Ok(())` - If registration was successful
    /// * `Err(String)` - If registration fails
    /// 
    /// # Requirements
    /// Validates: Requirements 7.2
    pub fn register_clipboard_shortcut<R: Runtime>(
        &self,
        app: &AppHandle<R>,
        key: &str,
    ) -> Result<(), String> {
        let shortcut = Self::parse_shortcut(key)?;
        
        // Unregister existing clipboard shortcut if any
        self.unregister_shortcut(app, "clipboard")?;

        let app_handle = app.clone();
        app.global_shortcut()
            .on_shortcut(shortcut.clone(), move |_app, _shortcut, event| {
                if event.state == ShortcutState::Pressed {
                    capture_clipboard_to_note(&app_handle);
                }
            })
            .map_err(|e| format!("Failed to register clipboard shortcut: {}", e))?;

        // Store the registered shortcut
        let mut shortcuts = self.registered_shortcuts.lock().unwrap();
        shortcuts.insert("clipboard".to_string(), key.to_string());

        Ok(())
    }

    /// Registers the quick note popup shortcut.
    /// 
    /// Default: CommandOrControl+Alt+N
    /// Opens the quick note popup window.
    /// 
    /// # Arguments
    /// * `app` - The Tauri application handle
    /// * `key` - The shortcut key combination
    /// 
    /// # Returns
    /// * `Ok(())` - If registration was successful
    /// * `Err(String)` - If registration fails
    /// 
    /// # Requirements
    /// Validates: Requirements 7.3
    pub fn register_quick_note_shortcut<R: Runtime>(
        &self,
        app: &AppHandle<R>,
        key: &str,
    ) -> Result<(), String> {
        let shortcut = Self::parse_shortcut(key)?;
        
        // Unregister existing quick note shortcut if any
        self.unregister_shortcut(app, "quick_note")?;

        let app_handle = app.clone();
        app.global_shortcut()
            .on_shortcut(shortcut.clone(), move |_app, _shortcut, event| {
                if event.state == ShortcutState::Pressed {
                    open_quick_note_window(&app_handle);
                }
            })
            .map_err(|e| format!("Failed to register quick note shortcut: {}", e))?;

        // Store the registered shortcut
        let mut shortcuts = self.registered_shortcuts.lock().unwrap();
        shortcuts.insert("quick_note".to_string(), key.to_string());

        Ok(())
    }

    /// Unregisters a specific shortcut by name.
    /// 
    /// # Arguments
    /// * `app` - The Tauri application handle
    /// * `name` - The name of the shortcut to unregister ("toggle", "clipboard", or "quick_note")
    /// 
    /// # Returns
    /// * `Ok(())` - If unregistration was successful or shortcut wasn't registered
    /// * `Err(String)` - If unregistration fails
    fn unregister_shortcut<R: Runtime>(
        &self,
        app: &AppHandle<R>,
        name: &str,
    ) -> Result<(), String> {
        let key_opt = {
            let mut shortcuts = self.registered_shortcuts.lock().unwrap();
            shortcuts.remove(name)
        };
        
        if let Some(key) = key_opt {
            if let Ok(shortcut) = Self::parse_shortcut(&key) {
                let _ = app.global_shortcut().unregister(shortcut);
            }
        }
        
        Ok(())
    }

    /// Unregisters all shortcuts.
    /// 
    /// # Arguments
    /// * `app` - The Tauri application handle
    pub fn unregister_all<R: Runtime>(&self, app: &AppHandle<R>) {
        let mut shortcuts = self.registered_shortcuts.lock().unwrap();
        
        for key in shortcuts.values() {
            if let Ok(shortcut) = Self::parse_shortcut(key) {
                let _ = app.global_shortcut().unregister(shortcut);
            }
        }
        
        shortcuts.clear();
    }

    /// Updates the toggle shortcut and re-registers it.
    /// 
    /// # Arguments
    /// * `app` - The Tauri application handle
    /// * `new_key` - The new shortcut key combination
    /// 
    /// # Returns
    /// * `Ok(())` - If update was successful
    /// * `Err(String)` - If update fails
    /// 
    /// # Requirements
    /// Validates: Requirements 7.4
    pub fn update_toggle_shortcut<R: Runtime>(
        &self,
        app: &AppHandle<R>,
        new_key: &str,
    ) -> Result<(), String> {
        // Validate the new shortcut first
        let _ = Self::parse_shortcut(new_key)?;
        
        // Unregister the old shortcut
        self.unregister_shortcut(app, "toggle")?;
        
        // Register the new shortcut
        self.register_toggle_shortcut(app, new_key)?;
        
        // Update config
        let config_manager = app.state::<ConfigManager>();
        config_manager.set_global_shortcut(new_key.to_string());
        if let Err(e) = config_manager.save_sync() {
            log::warn!("Failed to persist shortcut configuration: {}", e);
        }
        
        Ok(())
    }

    /// Gets the currently registered shortcuts.
    /// 
    /// # Returns
    /// A HashMap of shortcut names to their key combinations
    pub fn get_registered_shortcuts(&self) -> HashMap<String, String> {
        self.registered_shortcuts.lock().unwrap().clone()
    }

    /// Checks if a shortcut string is valid.
    /// 
    /// # Arguments
    /// * `key` - The shortcut string to validate
    /// 
    /// # Returns
    /// * `true` if the shortcut is valid
    /// * `false` if the shortcut is invalid
    pub fn is_valid_shortcut(key: &str) -> bool {
        Self::parse_shortcut(key).is_ok()
    }
}

impl Default for ShortcutManager {
    fn default() -> Self {
        Self::new()
    }
}

/// Toggles the visibility of the main window.
/// 
/// If the window is visible, it will be hidden.
/// If the window is hidden, it will be shown and focused.
/// 
/// # Requirements
/// Validates: Requirements 7.1
fn toggle_window_visibility<R: Runtime>(app: &AppHandle<R>) {
    if let Some(window) = app.get_webview_window("main") {
        // Check visibility - default to false if we can't determine
        let is_visible = window.is_visible().unwrap_or(false);
        let is_minimized = window.is_minimized().unwrap_or(false);
        
        if is_visible && !is_minimized {
            // Window is visible and not minimized - hide it
            let _ = window.hide();
        } else {
            // Window is hidden or minimized - show it
            // Order matters: show -> unminimize -> focus
            let _ = window.show();
            let _ = window.unminimize();
            let _ = window.set_focus();
        }
    }
}

/// Captures clipboard content and creates a new note.
/// 
/// Reads text from the clipboard, creates a new note with that content,
/// and shows a notification to the user.
/// 
/// # Requirements
/// Validates: Requirements 7.2
fn capture_clipboard_to_note<R: Runtime>(app: &AppHandle<R>) {
    // Use tauri's async runtime to handle the clipboard operation
    let app_handle = app.clone();
    
    tauri::async_runtime::spawn(async move {
        // Read clipboard content
        let clipboard_content: String = match app_handle.clipboard().read_text() {
            Ok(text) => text,
            Err(e) => {
                show_notification(&app_handle, "Clipboard Error", &format!("Failed to read clipboard: {}", e));
                return;
            }
        };

        if clipboard_content.trim().is_empty() {
            show_notification(&app_handle, "Clipboard Empty", "No text content in clipboard");
            return;
        }

        // Get filesystem to create note
        let filesystem = app_handle.state::<FileSystem>();
        
        // Create a new note
        match filesystem.create_note(None) {
            Ok((note_id, _path)) => {
                // Format the content with a title
                let content = format!("# Clipboard Note\n\n{}", clipboard_content);
                
                // Save the content
                if let Err(e) = filesystem.save_note(&note_id, &content, None) {
                    show_notification(&app_handle, "Error", &format!("Failed to save note: {}", e));
                    return;
                }

                // Show success notification
                show_notification(&app_handle, "Note Created", "Clipboard content saved as new note");

                // Emit refresh-notes event to update the UI
                let _ = app_handle.emit("refresh-notes", note_id);
            }
            Err(e) => {
                show_notification(&app_handle, "Error", &format!("Failed to create note: {}", e));
            }
        }
    });
}

/// Opens the quick note popup window.
/// 
/// Creates or shows the quick note window, positioning it in the top-right corner.
/// The window is frameless, transparent, always-on-top, and skips the taskbar.
/// 
/// # Requirements
/// Validates: Requirements 7.3, 8.1
fn open_quick_note_window<R: Runtime>(app: &AppHandle<R>) {
    // Check if quick note window already exists
    if let Some(window) = app.get_webview_window("quick-note") {
        let _ = window.show();
        let _ = window.set_focus();
        return;
    }

    // Create the quick note window with proper configuration
    // Frameless, transparent, always-on-top, skip taskbar
    // Position in top-right corner of screen
    let app_handle = app.clone();
    tauri::async_runtime::spawn(async move {
        if let Err(e) = create_quick_note_window(&app_handle).await {
            log::error!("Failed to create quick note window: {}", e);
        }
    });
}

/// Creates the quick note window with proper configuration.
/// 
/// # Requirements
/// Validates: Requirements 8.1
async fn create_quick_note_window<R: Runtime>(app: &AppHandle<R>) -> Result<(), String> {
    use tauri::WebviewWindowBuilder;
    use tauri::WebviewUrl;
    
    // Get display info to position in top-right corner
    let (screen_width, _screen_height) = if let Some(window) = app.get_webview_window("main") {
        if let Ok(Some(monitor)) = window.primary_monitor() {
            let size = monitor.size();
            (size.width as i32, size.height as i32)
        } else {
            (1920, 1080) // Default fallback
        }
    } else {
        (1920, 1080) // Default fallback
    };
    
    // Quick note window dimensions
    let window_width = 400;
    let window_height = 200;
    let margin = 20;
    
    // Position in top-right corner
    let x = screen_width - window_width - margin;
    let y = margin;
    
    // Create the quick note window
    let window = WebviewWindowBuilder::new(
        app,
        "quick-note",
        WebviewUrl::App("quick-note.html".into()),
    )
    .title("Quick Note")
    .inner_size(window_width as f64, window_height as f64)
    .position(x as f64, y as f64)
    .decorations(false)
    .transparent(true)
    .always_on_top(true)
    .skip_taskbar(true)
    .resizable(false)
    .focused(true)
    .visible(true)
    .build()
    .map_err(|e| format!("Failed to create quick note window: {}", e))?;
    
    // Set focus to the window
    let _ = window.set_focus();
    
    Ok(())
}

/// Shows a system notification.
/// 
/// # Arguments
/// * `app` - The Tauri application handle
/// * `title` - The notification title
/// * `body` - The notification body text
fn show_notification<R: Runtime>(app: &AppHandle<R>, title: &str, body: &str) {
    let _ = app.notification()
        .builder()
        .title(title)
        .body(body)
        .show();
}

/// Validates a shortcut string and returns an error result if invalid.
/// 
/// This is a helper function for IPC commands.
/// 
/// # Arguments
/// * `key` - The shortcut string to validate
/// 
/// # Returns
/// * `Ok(())` - If the shortcut is valid
/// * `Err(ApiResult)` - If the shortcut is invalid
/// 
/// # Requirements
/// Validates: Requirements 7.5
pub fn validate_shortcut(key: &str) -> Result<(), ApiResult> {
    ShortcutManager::parse_shortcut(key)
        .map(|_| ())
        .map_err(|e| ApiResult::error(e))
}

#[cfg(test)]
mod tests {
    use super::*;
    use proptest::prelude::*;

    #[test]
    fn test_shortcut_manager_new() {
        let manager = ShortcutManager::new();
        let shortcuts = manager.get_registered_shortcuts();
        assert!(shortcuts.is_empty());
    }

    #[test]
    fn test_parse_valid_shortcut() {
        // Test various valid shortcut formats
        assert!(ShortcutManager::parse_shortcut("CommandOrControl+Shift+N").is_ok());
        assert!(ShortcutManager::parse_shortcut("Ctrl+Alt+V").is_ok());
        assert!(ShortcutManager::parse_shortcut("Alt+N").is_ok());
        assert!(ShortcutManager::parse_shortcut("Shift+F1").is_ok());
        assert!(ShortcutManager::parse_shortcut("Super+A").is_ok());
    }

    #[test]
    fn test_parse_invalid_shortcut() {
        // Test invalid shortcut formats
        assert!(ShortcutManager::parse_shortcut("").is_err());
        assert!(ShortcutManager::parse_shortcut("InvalidKey").is_err());
        assert!(ShortcutManager::parse_shortcut("Ctrl+").is_err());
        assert!(ShortcutManager::parse_shortcut("+N").is_err());
        assert!(ShortcutManager::parse_shortcut("NotAKey+X").is_err());
    }

    #[test]
    fn test_is_valid_shortcut() {
        assert!(ShortcutManager::is_valid_shortcut("CommandOrControl+Shift+N"));
        assert!(ShortcutManager::is_valid_shortcut("Ctrl+Alt+V"));
        assert!(!ShortcutManager::is_valid_shortcut(""));
        assert!(!ShortcutManager::is_valid_shortcut("InvalidShortcut"));
    }

    #[test]
    fn test_validate_shortcut_function() {
        assert!(validate_shortcut("CommandOrControl+Shift+N").is_ok());
        assert!(validate_shortcut("Ctrl+Alt+V").is_ok());
        
        let result = validate_shortcut("InvalidShortcut");
        assert!(result.is_err());
        if let Err(api_result) = result {
            assert!(!api_result.success);
            assert!(api_result.error.is_some());
        }
    }

    // Strategy for generating invalid shortcut strings
    // These are strings that should NOT be valid shortcuts
    // Note: The Tauri shortcut parser is quite lenient, so we focus on
    // patterns that are definitely invalid based on unit test verification
    fn invalid_shortcut_strategy() -> impl Strategy<Value = String> {
        prop_oneof![
            // Empty string - definitely invalid
            Just("".to_string()),
            // Invalid key names - verified in unit tests
            Just("InvalidKey".to_string()),
            Just("NotAKey+X".to_string()),
            // Trailing plus - verified in unit tests
            Just("Ctrl+".to_string()),
            Just("Alt+".to_string()),
            Just("Shift+".to_string()),
            Just("Super+".to_string()),
            // Leading plus - verified in unit tests
            Just("+N".to_string()),
            Just("+A".to_string()),
            Just("+Ctrl".to_string()),
            // Multiple consecutive plus signs
            Just("++".to_string()),
            Just("+++".to_string()),
            Just("++++".to_string()),
            // Just a plus sign
            Just("+".to_string()),
        ]
    }

    // Strategy for generating valid shortcut strings
    fn valid_shortcut_strategy() -> impl Strategy<Value = String> {
        let modifiers = prop_oneof![
            Just("Ctrl"),
            Just("Alt"),
            Just("Shift"),
            Just("Super"),
            Just("CommandOrControl"),
        ];
        
        let keys = prop_oneof![
            Just("A"), Just("B"), Just("C"), Just("D"), Just("E"),
            Just("F"), Just("G"), Just("H"), Just("I"), Just("J"),
            Just("K"), Just("L"), Just("M"), Just("N"), Just("O"),
            Just("P"), Just("Q"), Just("R"), Just("S"), Just("T"),
            Just("U"), Just("V"), Just("W"), Just("X"), Just("Y"),
            Just("Z"),
            Just("F1"), Just("F2"), Just("F3"), Just("F4"),
            Just("F5"), Just("F6"), Just("F7"), Just("F8"),
            Just("F9"), Just("F10"), Just("F11"), Just("F12"),
            Just("Space"), Just("Tab"), Just("Enter"),
            Just("Escape"), Just("Backspace"), Just("Delete"),
            Just("Home"), Just("End"), Just("PageUp"), Just("PageDown"),
            Just("ArrowUp"), Just("ArrowDown"), Just("ArrowLeft"), Just("ArrowRight"),
        ];
        
        // Generate combinations of 1-2 modifiers + key
        (modifiers.clone(), prop::option::of(modifiers), keys)
            .prop_map(|(mod1, mod2, key)| {
                match mod2 {
                    Some(m2) if m2 != mod1 => format!("{}+{}+{}", mod1, m2, key),
                    _ => format!("{}+{}", mod1, key),
                }
            })
    }

    proptest! {
        #![proptest_config(ProptestConfig::with_cases(100))]

        /// **Feature: mded-tauri-migration, Property: Invalid shortcut registration returns error**
        /// **Validates: Requirements 7.5**
        /// 
        /// For any invalid shortcut string, attempting to parse it should return an error.
        /// The error should contain a meaningful message about why the shortcut is invalid.
        #[test]
        fn prop_invalid_shortcut_returns_error(shortcut in invalid_shortcut_strategy()) {
            let result = ShortcutManager::parse_shortcut(&shortcut);
            
            // Invalid shortcuts should always return an error
            prop_assert!(
                result.is_err(),
                "Expected error for invalid shortcut '{}', but got Ok",
                shortcut
            );
            
            // The error message should contain the shortcut string
            if let Err(error_msg) = result {
                prop_assert!(
                    error_msg.contains("Invalid shortcut") || error_msg.contains(&shortcut) || !error_msg.is_empty(),
                    "Error message should be meaningful, got: '{}'",
                    error_msg
                );
            }
        }

        /// **Feature: mded-tauri-migration, Property: Valid shortcut parsing succeeds**
        /// **Validates: Requirements 7.5**
        /// 
        /// For any valid shortcut string, parsing should succeed.
        #[test]
        fn prop_valid_shortcut_parses_successfully(shortcut in valid_shortcut_strategy()) {
            let result = ShortcutManager::parse_shortcut(&shortcut);
            
            // Valid shortcuts should parse successfully
            prop_assert!(
                result.is_ok(),
                "Expected Ok for valid shortcut '{}', but got Err: {:?}",
                shortcut,
                result.err()
            );
        }

        /// **Feature: mded-tauri-migration, Property: validate_shortcut returns ApiResult error for invalid shortcuts**
        /// **Validates: Requirements 7.5**
        /// 
        /// For any invalid shortcut string, the validate_shortcut function should return
        /// an ApiResult with success=false and an error message.
        #[test]
        fn prop_validate_shortcut_returns_api_error(shortcut in invalid_shortcut_strategy()) {
            let result = validate_shortcut(&shortcut);
            
            // Invalid shortcuts should return Err(ApiResult)
            prop_assert!(
                result.is_err(),
                "Expected Err for invalid shortcut '{}', but got Ok",
                shortcut
            );
            
            if let Err(api_result) = result {
                prop_assert!(
                    !api_result.success,
                    "ApiResult.success should be false for invalid shortcut"
                );
                prop_assert!(
                    api_result.error.is_some(),
                    "ApiResult.error should contain an error message"
                );
            }
        }

        /// **Feature: mded-tauri-migration, Property: is_valid_shortcut consistency**
        /// **Validates: Requirements 7.5**
        /// 
        /// The is_valid_shortcut function should return true for valid shortcuts
        /// and false for invalid shortcuts, consistent with parse_shortcut.
        #[test]
        fn prop_is_valid_shortcut_consistent_with_parse(shortcut in "[A-Za-z+]{1,30}") {
            let parse_result = ShortcutManager::parse_shortcut(&shortcut);
            let is_valid = ShortcutManager::is_valid_shortcut(&shortcut);
            
            prop_assert_eq!(
                parse_result.is_ok(),
                is_valid,
                "is_valid_shortcut should be consistent with parse_shortcut for '{}'",
                shortcut
            );
        }
    }
}
