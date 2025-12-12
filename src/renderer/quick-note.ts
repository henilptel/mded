/**
 * Quick Note Window Handler
 * 
 * Handles the quick note popup window functionality:
 * - Enter to save the note
 * - Escape to close without saving
 * - Window blur to hide the popup
 * 
 * Requirements: 8.1, 8.2, 8.3, 8.4
 */

// Initialize Tauri API bridge - must be first import to set up window.electron
import './api';

const input = document.getElementById('quick-input') as HTMLTextAreaElement;

// Focus the input on load
input.focus();

// Handle keyboard events
input.addEventListener('keydown', async (e) => {
    // Enter (without Shift) saves the note
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        const content = input.value;
        if (content.trim()) {
            await window.electron.saveQuickNote(content);
            input.value = ''; // Clear after save
            // Window will be hidden by the backend after save
        }
    }
    
    // Escape closes without saving
    // Requirements: 8.4 - WHEN the user presses Escape in the quick note popup 
    // THEN the Quick_Note_Window SHALL hide the popup without saving
    if (e.key === 'Escape') {
        hideQuickNoteWindow();
    }
});

/**
 * Handle window blur event - hide the popup when focus is lost
 * 
 * Requirements: 8.3 - WHEN the quick note popup loses focus 
 * THEN the Quick_Note_Window SHALL hide the popup
 */
window.addEventListener('blur', () => {
    // Small delay to allow for click events to complete
    // This prevents the window from hiding when clicking inside it
    setTimeout(() => {
        hideQuickNoteWindow();
    }, 100);
});

/**
 * Hides the quick note window using Tauri's window API
 */
async function hideQuickNoteWindow() {
    try {
        // Try to use Tauri's window API if available
        if (typeof window !== 'undefined' && (window as any).__TAURI__) {
            const { getCurrentWindow } = await import('@tauri-apps/api/window');
            const currentWindow = getCurrentWindow();
            await currentWindow.hide();
        } else {
            // Fallback for non-Tauri environment (e.g., Electron)
            window.close();
        }
    } catch (error) {
        console.error('Failed to hide quick note window:', error);
        // Fallback to window.close()
        window.close();
    }
}

// Clear input when window becomes visible again
// This ensures a fresh state each time the quick note is opened
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
        input.value = '';
        input.focus();
    }
});
