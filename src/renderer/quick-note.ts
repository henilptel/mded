
const input = document.getElementById('quick-input') as HTMLTextAreaElement;

input.focus();

input.addEventListener('keydown', async (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        const content = input.value;
        if (content.trim()) {
            await window.electron.saveQuickNote(content);
            input.value = ''; // Clear after save
        }
    }
    
    if (e.key === 'Escape') {
        window.close(); // Start close/hide from renderer
    }
});

// Focus on window show (need to listen to ipc for 'focus' or just trust focus)
// Since main process calls focus(), it should work.
