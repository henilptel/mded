use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

/// Information about a folder in the notes directory
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct FolderInfo {
    pub name: String,
    pub path: String,
}

/// Information about a note file
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct NoteInfo {
    pub id: String,
    pub title: String,
    pub modified: DateTime<Utc>,
    pub created: DateTime<Utc>,
    pub folder: String,
    pub pinned: bool,
}

/// Generic API result for IPC commands
#[derive(Serialize, Deserialize, Clone, Debug, Default, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ApiResult {
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub content: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub note_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub folder: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub image_path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub image_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub file_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub file_path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pinned: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub opacity: Option<f64>,
}


impl ApiResult {
    /// Create a successful result
    pub fn success() -> Self {
        Self {
            success: true,
            ..Default::default()
        }
    }

    /// Create an error result
    pub fn error(message: impl Into<String>) -> Self {
        Self {
            success: false,
            error: Some(message.into()),
            ..Default::default()
        }
    }

    /// Create a success result with content
    pub fn with_content(content: impl Into<String>) -> Self {
        Self {
            success: true,
            content: Some(content.into()),
            ..Default::default()
        }
    }

    /// Create a success result with note_id
    pub fn with_note_id(note_id: impl Into<String>) -> Self {
        Self {
            success: true,
            note_id: Some(note_id.into()),
            ..Default::default()
        }
    }

    /// Create a success result with note_id and folder
    pub fn with_note_id_and_folder(note_id: impl Into<String>, folder: Option<String>) -> Self {
        Self {
            success: true,
            note_id: Some(note_id.into()),
            folder,
            ..Default::default()
        }
    }
}

/// Window bounds for position and size persistence
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct WindowBounds {
    pub width: u32,
    pub height: u32,
    pub x: Option<i32>,
    pub y: Option<i32>,
}

impl Default for WindowBounds {
    fn default() -> Self {
        Self {
            width: 1200,
            height: 800,
            x: None,
            y: None,
        }
    }
}

/// Display information for screen dimensions
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct DisplayInfo {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
}

/// Last opened note information
#[derive(Serialize, Deserialize, Clone, Debug, Default, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct LastNote {
    pub note_id: Option<String>,
    pub folder: Option<String>,
}

/// Application configuration
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct Config {
    pub global_shortcut: String,
    pub clipboard_shortcut: String,
    pub quick_note_shortcut: String,
    pub window_bounds: WindowBounds,
    pub last_note_id: Option<String>,
    pub last_folder: Option<String>,
    pub pinned_notes: Vec<String>,
    pub minimal_mode_bounds: WindowBounds,
    pub window_opacity: f64,
    pub auto_start_on_boot: bool,
}

impl Default for Config {
    fn default() -> Self {
        Self {
            global_shortcut: "CommandOrControl+Shift+N".to_string(),
            clipboard_shortcut: "CommandOrControl+Alt+V".to_string(),
            quick_note_shortcut: "CommandOrControl+Alt+N".to_string(),
            window_bounds: WindowBounds::default(),
            last_note_id: None,
            last_folder: None,
            pinned_notes: vec![],
            minimal_mode_bounds: WindowBounds {
                width: 400,
                height: 300,
                x: None,
                y: None,
            },
            window_opacity: 1.0,
            auto_start_on_boot: false,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use proptest::prelude::*;

    #[test]
    fn test_api_result_success() {
        let result = ApiResult::success();
        assert!(result.success);
        assert!(result.error.is_none());
    }

    #[test]
    fn test_api_result_error() {
        let result = ApiResult::error("test error");
        assert!(!result.success);
        assert_eq!(result.error, Some("test error".to_string()));
    }

    #[test]
    fn test_config_default() {
        let config = Config::default();
        assert_eq!(config.global_shortcut, "CommandOrControl+Shift+N");
        assert_eq!(config.window_opacity, 1.0);
        assert!(config.pinned_notes.is_empty());
    }

    #[test]
    fn test_window_bounds_default() {
        let bounds = WindowBounds::default();
        assert_eq!(bounds.width, 1200);
        assert_eq!(bounds.height, 800);
        assert!(bounds.x.is_none());
        assert!(bounds.y.is_none());
    }

    // Strategy for generating optional strings
    fn optional_string() -> impl Strategy<Value = Option<String>> {
        prop_oneof![
            Just(None),
            ".*".prop_map(Some),
        ]
    }

    // Strategy for generating optional f64 values
    fn optional_f64() -> impl Strategy<Value = Option<f64>> {
        prop_oneof![
            Just(None),
            (0.0f64..=1.0f64).prop_map(Some),
        ]
    }

    // Strategy for generating optional bool values
    fn optional_bool() -> impl Strategy<Value = Option<bool>> {
        prop_oneof![
            Just(None),
            any::<bool>().prop_map(Some),
        ]
    }

    // Strategy for generating ApiResult
    fn api_result_strategy() -> impl Strategy<Value = ApiResult> {
        (
            any::<bool>(),
            optional_string(),
            optional_string(),
            optional_string(),
            optional_string(),
            optional_string(),
            optional_string(),
            optional_string(),
            optional_string(),
            optional_bool(),
            optional_f64(),
        )
            .prop_map(
                |(
                    success,
                    error,
                    content,
                    note_id,
                    folder,
                    image_path,
                    image_id,
                    file_name,
                    file_path,
                    pinned,
                    opacity,
                )| {
                    ApiResult {
                        success,
                        error,
                        content,
                        note_id,
                        folder,
                        image_path,
                        image_id,
                        file_name,
                        file_path,
                        pinned,
                        opacity,
                    }
                },
            )
    }

    proptest! {
        #![proptest_config(ProptestConfig::with_cases(100))]

        /// **Feature: mded-tauri-migration, Property: ApiResult serialization round-trip**
        /// **Validates: Requirements 19.2, 19.3**
        /// 
        /// For any valid ApiResult, serializing to JSON and deserializing back
        /// should produce an equivalent ApiResult.
        #[test]
        fn prop_api_result_serialization_round_trip(result in api_result_strategy()) {
            let serialized = serde_json::to_string(&result).expect("Failed to serialize ApiResult");
            let deserialized: ApiResult = serde_json::from_str(&serialized).expect("Failed to deserialize ApiResult");
            
            prop_assert_eq!(result.success, deserialized.success);
            prop_assert_eq!(result.error, deserialized.error);
            prop_assert_eq!(result.content, deserialized.content);
            prop_assert_eq!(result.note_id, deserialized.note_id);
            prop_assert_eq!(result.folder, deserialized.folder);
            prop_assert_eq!(result.image_path, deserialized.image_path);
            prop_assert_eq!(result.image_id, deserialized.image_id);
            prop_assert_eq!(result.file_name, deserialized.file_name);
            prop_assert_eq!(result.file_path, deserialized.file_path);
            prop_assert_eq!(result.pinned, deserialized.pinned);
            // For f64, we need to handle potential floating point comparison issues
            match (result.opacity, deserialized.opacity) {
                (Some(a), Some(b)) => prop_assert!((a - b).abs() < f64::EPSILON),
                (None, None) => {},
                _ => prop_assert!(false, "opacity mismatch"),
            }
        }
    }
}
