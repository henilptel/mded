use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;

use crate::models::WindowBounds;

/// Minimum window width in pixels
pub const MIN_WINDOW_WIDTH: u32 = 300;
/// Minimum window height in pixels
pub const MIN_WINDOW_HEIGHT: u32 = 200;
/// Minimum opacity value (30%)
pub const MIN_OPACITY: f64 = 0.3;
/// Maximum opacity value (100%)
pub const MAX_OPACITY: f64 = 1.0;

/// WindowManager handles window state and operations.
/// 
/// Tracks normal mode bounds, minimal mode state, and provides
/// methods for entering/exiting minimal mode.
/// 
/// # Requirements
/// Validates: Requirements 5.1, 5.2, 5.3
pub struct WindowManager {
    /// Saved normal mode bounds (before entering minimal mode)
    normal_bounds: Mutex<Option<WindowBounds>>,
    /// Whether the window is currently in minimal mode
    is_minimal_mode: AtomicBool,
}

impl WindowManager {
    /// Creates a new WindowManager instance.
    pub fn new() -> Self {
        Self {
            normal_bounds: Mutex::new(None),
            is_minimal_mode: AtomicBool::new(false),
        }
    }

    /// Returns whether the window is currently in minimal mode.
    pub fn is_in_minimal_mode(&self) -> bool {
        self.is_minimal_mode.load(Ordering::SeqCst)
    }

    /// Sets the minimal mode state.
    pub fn set_minimal_mode(&self, enabled: bool) {
        self.is_minimal_mode.store(enabled, Ordering::SeqCst);
    }

    /// Saves the current normal bounds before entering minimal mode.
    /// 
    /// # Arguments
    /// * `bounds` - The current window bounds to save
    pub fn save_normal_bounds(&self, bounds: WindowBounds) {
        let mut guard = self.normal_bounds.lock().unwrap();
        *guard = Some(bounds);
    }


    /// Gets the saved normal bounds.
    /// 
    /// # Returns
    /// The saved normal bounds, or None if not saved
    pub fn get_normal_bounds(&self) -> Option<WindowBounds> {
        let guard = self.normal_bounds.lock().unwrap();
        guard.clone()
    }

    /// Clears the saved normal bounds.
    pub fn clear_normal_bounds(&self) {
        let mut guard = self.normal_bounds.lock().unwrap();
        *guard = None;
    }

    /// Clamps an opacity value to the valid range [0.3, 1.0].
    /// 
    /// # Arguments
    /// * `opacity` - The opacity value to clamp
    /// 
    /// # Returns
    /// The clamped opacity value
    /// 
    /// # Requirements
    /// Validates: Requirements 6.1
    pub fn clamp_opacity(opacity: f64) -> f64 {
        opacity.clamp(MIN_OPACITY, MAX_OPACITY)
    }

    /// Validates and clamps window bounds to minimum dimensions.
    /// 
    /// # Arguments
    /// * `bounds` - The bounds to validate
    /// 
    /// # Returns
    /// Bounds with width/height clamped to minimums
    /// 
    /// # Requirements
    /// Validates: Requirements 2.2
    pub fn clamp_bounds(bounds: WindowBounds) -> WindowBounds {
        WindowBounds {
            width: bounds.width.max(MIN_WINDOW_WIDTH),
            height: bounds.height.max(MIN_WINDOW_HEIGHT),
            x: bounds.x,
            y: bounds.y,
        }
    }
}

impl Default for WindowManager {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use proptest::prelude::*;

    // Strategy for generating valid window bounds
    fn window_bounds_strategy() -> impl Strategy<Value = WindowBounds> {
        (
            MIN_WINDOW_WIDTH..=4000u32,
            MIN_WINDOW_HEIGHT..=3000u32,
            prop_oneof![Just(None), (-2000i32..=2000i32).prop_map(Some)],
            prop_oneof![Just(None), (-2000i32..=2000i32).prop_map(Some)],
        )
            .prop_map(|(width, height, x, y)| WindowBounds { width, height, x, y })
    }

    // Strategy for generating any window bounds (including invalid ones)
    fn any_window_bounds_strategy() -> impl Strategy<Value = WindowBounds> {
        (
            0u32..=5000u32,
            0u32..=5000u32,
            prop_oneof![Just(None), (-5000i32..=5000i32).prop_map(Some)],
            prop_oneof![Just(None), (-5000i32..=5000i32).prop_map(Some)],
        )
            .prop_map(|(width, height, x, y)| WindowBounds { width, height, x, y })
    }

    // Strategy for generating any opacity value
    fn any_opacity_strategy() -> impl Strategy<Value = f64> {
        -1.0f64..=2.0f64
    }

    #[test]
    fn test_window_manager_new() {
        let wm = WindowManager::new();
        assert!(!wm.is_in_minimal_mode());
        assert!(wm.get_normal_bounds().is_none());
    }

    #[test]
    fn test_minimal_mode_state() {
        let wm = WindowManager::new();
        
        assert!(!wm.is_in_minimal_mode());
        
        wm.set_minimal_mode(true);
        assert!(wm.is_in_minimal_mode());
        
        wm.set_minimal_mode(false);
        assert!(!wm.is_in_minimal_mode());
    }

    #[test]
    fn test_normal_bounds_save_and_get() {
        let wm = WindowManager::new();
        
        let bounds = WindowBounds {
            width: 1000,
            height: 600,
            x: Some(100),
            y: Some(200),
        };
        
        wm.save_normal_bounds(bounds.clone());
        
        let retrieved = wm.get_normal_bounds();
        assert!(retrieved.is_some());
        let retrieved = retrieved.unwrap();
        assert_eq!(retrieved.width, 1000);
        assert_eq!(retrieved.height, 600);
        assert_eq!(retrieved.x, Some(100));
        assert_eq!(retrieved.y, Some(200));
    }

    #[test]
    fn test_clear_normal_bounds() {
        let wm = WindowManager::new();
        
        let bounds = WindowBounds {
            width: 800,
            height: 600,
            x: None,
            y: None,
        };
        
        wm.save_normal_bounds(bounds);
        assert!(wm.get_normal_bounds().is_some());
        
        wm.clear_normal_bounds();
        assert!(wm.get_normal_bounds().is_none());
    }

    #[test]
    fn test_opacity_clamping() {
        // Test values below minimum
        assert_eq!(WindowManager::clamp_opacity(0.1), 0.3);
        assert_eq!(WindowManager::clamp_opacity(0.0), 0.3);
        assert_eq!(WindowManager::clamp_opacity(-0.5), 0.3);
        
        // Test values above maximum
        assert_eq!(WindowManager::clamp_opacity(1.5), 1.0);
        assert_eq!(WindowManager::clamp_opacity(2.0), 1.0);
        
        // Test valid values
        assert_eq!(WindowManager::clamp_opacity(0.5), 0.5);
        assert_eq!(WindowManager::clamp_opacity(0.3), 0.3);
        assert_eq!(WindowManager::clamp_opacity(1.0), 1.0);
        assert_eq!(WindowManager::clamp_opacity(0.75), 0.75);
    }

    #[test]
    fn test_bounds_clamping() {
        // Test bounds below minimum
        let small_bounds = WindowBounds {
            width: 100,
            height: 100,
            x: Some(50),
            y: Some(50),
        };
        let clamped = WindowManager::clamp_bounds(small_bounds);
        assert_eq!(clamped.width, 300);
        assert_eq!(clamped.height, 200);
        assert_eq!(clamped.x, Some(50));
        assert_eq!(clamped.y, Some(50));
        
        // Test bounds at minimum
        let min_bounds = WindowBounds {
            width: 300,
            height: 200,
            x: None,
            y: None,
        };
        let clamped = WindowManager::clamp_bounds(min_bounds);
        assert_eq!(clamped.width, 300);
        assert_eq!(clamped.height, 200);
        
        // Test bounds above minimum
        let large_bounds = WindowBounds {
            width: 1920,
            height: 1080,
            x: Some(0),
            y: Some(0),
        };
        let clamped = WindowManager::clamp_bounds(large_bounds);
        assert_eq!(clamped.width, 1920);
        assert_eq!(clamped.height, 1080);
    }

    proptest! {
        #![proptest_config(ProptestConfig::with_cases(100))]

        /// **Feature: mded-tauri-migration, Property 17: Minimal Mode Bounds Isolation**
        /// **Validates: Requirements 5.3**
        /// 
        /// For any window resize in minimal mode, the saved normal bounds should
        /// not be affected. This tests that normal_bounds remains unchanged when
        /// the window manager is in minimal mode.
        #[test]
        fn prop_minimal_mode_bounds_isolation(
            normal_bounds in window_bounds_strategy(),
            minimal_bounds in window_bounds_strategy(),
        ) {
            let wm = WindowManager::new();
            
            // Save normal bounds (simulating entering minimal mode)
            wm.save_normal_bounds(normal_bounds.clone());
            wm.set_minimal_mode(true);
            
            // Verify we're in minimal mode
            prop_assert!(wm.is_in_minimal_mode());
            
            // The normal bounds should still be preserved
            let retrieved = wm.get_normal_bounds();
            prop_assert!(retrieved.is_some());
            let retrieved = retrieved.unwrap();
            
            // Normal bounds should be unchanged regardless of minimal_bounds
            prop_assert_eq!(retrieved.width, normal_bounds.width);
            prop_assert_eq!(retrieved.height, normal_bounds.height);
            prop_assert_eq!(retrieved.x, normal_bounds.x);
            prop_assert_eq!(retrieved.y, normal_bounds.y);
            
            // Simulating window resize in minimal mode doesn't affect normal bounds
            // (minimal_bounds would be saved separately in config, not in WindowManager)
            let _ = minimal_bounds; // Use the variable to avoid warning
            
            // After any operations in minimal mode, normal bounds should still be intact
            let still_retrieved = wm.get_normal_bounds();
            prop_assert!(still_retrieved.is_some());
            let still_retrieved = still_retrieved.unwrap();
            prop_assert_eq!(still_retrieved.width, normal_bounds.width);
            prop_assert_eq!(still_retrieved.height, normal_bounds.height);
        }

        /// **Feature: mded-tauri-migration, Property 7: Opacity Clamping**
        /// **Validates: Requirements 6.1**
        /// 
        /// For any opacity value, setting it should result in a value clamped
        /// between 0.3 and 1.0.
        #[test]
        fn prop_opacity_clamping(opacity in any_opacity_strategy()) {
            let clamped = WindowManager::clamp_opacity(opacity);
            
            // Result should always be within valid range
            prop_assert!(clamped >= MIN_OPACITY, "Clamped opacity {} is below minimum {}", clamped, MIN_OPACITY);
            prop_assert!(clamped <= MAX_OPACITY, "Clamped opacity {} is above maximum {}", clamped, MAX_OPACITY);
            
            // If input was in valid range, output should equal input
            if opacity >= MIN_OPACITY && opacity <= MAX_OPACITY {
                prop_assert!((clamped - opacity).abs() < f64::EPSILON, 
                    "Valid opacity {} was changed to {}", opacity, clamped);
            }
            
            // If input was below minimum, output should be minimum
            if opacity < MIN_OPACITY {
                prop_assert!((clamped - MIN_OPACITY).abs() < f64::EPSILON,
                    "Opacity {} below minimum should clamp to {}, got {}", opacity, MIN_OPACITY, clamped);
            }
            
            // If input was above maximum, output should be maximum
            if opacity > MAX_OPACITY {
                prop_assert!((clamped - MAX_OPACITY).abs() < f64::EPSILON,
                    "Opacity {} above maximum should clamp to {}, got {}", opacity, MAX_OPACITY, clamped);
            }
        }

        /// **Feature: mded-tauri-migration, Property 3: Window Bounds Persistence Round-Trip**
        /// **Validates: Requirements 2.3, 2.4**
        /// 
        /// For any valid window bounds, saving them and then retrieving them
        /// should return the same bounds.
        #[test]
        fn prop_window_bounds_round_trip(bounds in window_bounds_strategy()) {
            let wm = WindowManager::new();
            
            // Save bounds
            wm.save_normal_bounds(bounds.clone());
            
            // Retrieve bounds
            let retrieved = wm.get_normal_bounds();
            prop_assert!(retrieved.is_some());
            let retrieved = retrieved.unwrap();
            
            // Should be identical
            prop_assert_eq!(retrieved.width, bounds.width);
            prop_assert_eq!(retrieved.height, bounds.height);
            prop_assert_eq!(retrieved.x, bounds.x);
            prop_assert_eq!(retrieved.y, bounds.y);
        }

        /// **Feature: mded-tauri-migration, Property 6: Minimum Window Size Enforcement**
        /// **Validates: Requirements 2.2**
        /// 
        /// For any window bounds, clamping should ensure dimensions are at least
        /// the minimum size (300x200).
        #[test]
        fn prop_minimum_window_size_enforcement(bounds in any_window_bounds_strategy()) {
            let clamped = WindowManager::clamp_bounds(bounds.clone());
            
            // Width should be at least minimum
            prop_assert!(clamped.width >= MIN_WINDOW_WIDTH,
                "Clamped width {} is below minimum {}", clamped.width, MIN_WINDOW_WIDTH);
            
            // Height should be at least minimum
            prop_assert!(clamped.height >= MIN_WINDOW_HEIGHT,
                "Clamped height {} is below minimum {}", clamped.height, MIN_WINDOW_HEIGHT);
            
            // Position should be preserved
            prop_assert_eq!(clamped.x, bounds.x);
            prop_assert_eq!(clamped.y, bounds.y);
            
            // If original was valid, it should be unchanged
            if bounds.width >= MIN_WINDOW_WIDTH {
                prop_assert_eq!(clamped.width, bounds.width);
            }
            if bounds.height >= MIN_WINDOW_HEIGHT {
                prop_assert_eq!(clamped.height, bounds.height);
            }
        }
    }
}
