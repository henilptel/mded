import { NoteManager } from './managers/note-manager';
import { UIManager } from './managers/ui-manager';
import { ShortcutManager } from './managers/shortcut-manager';
import { EditorManager } from './managers/editor-manager';
import { NoteInfo } from './types';

// Declare globals needed by EditorManager (if any logic leaks)
interface MarkedStatic { parse: (markdown: string) => string; }
interface HljsStatic { highlightElement: (element: HTMLElement) => void; }
declare const marked: MarkedStatic;
declare const hljs: HljsStatic | undefined;

// Initialize Managers
const ui = new UIManager();
const noteManager = new NoteManager();
const shortcutManager = new ShortcutManager();
const editorManager = new EditorManager(ui.elements.editor, ui.elements.preview, ui.elements.modeLabel);

// State
let autoSaveTimer: number | null = null;
let isRecordingShortcut = false;

// ============ Event Handlers ============

async function refreshNotes() {
  const searchQuery = ui.elements.searchInput.value.trim();
  const notes = await noteManager.listNotes(searchQuery);
  renderNotes(notes);
}

async function refreshFolders() {
  const folders = await noteManager.loadFolders();
  ui.renderFolders(folders, noteManager.currentState.currentFolder, {
    onSelect: async (path) => {
      noteManager.setCurrentFolder(path);
      await refreshNotes();
      // Update active state in UI is handled by renderFolders re-render or class toggle
      refreshFolders(); 
    },
    onRename: (currentName) => {
      showRenameModal('folder', currentName, async (newName) => {
          const result = await noteManager.renameFolder(currentName, newName);
          if (result.success) {
              ui.showToast('Folder renamed', 'success');
              if (noteManager.currentState.currentFolder === currentName) {
                  noteManager.setCurrentFolder(newName);
              }
              refreshFolders();
          } else {
              ui.showToast(`Failed: ${result.error}`, 'error');
          }
      });
    },
    onDelete: (name) => {
       showConfirmModal(`Delete folder "${name}" and all its notes?`, async () => {
           const result = await noteManager.deleteFolder(name);
           if (result.success) {
               ui.showToast('Folder deleted', 'success');
               if (noteManager.currentState.currentFolder === name) {
                   noteManager.setCurrentFolder('');
               }
               refreshFolders();
               refreshNotes();
           } else {
               ui.showToast(`Failed: ${result.error}`, 'error');
           }
       });
    },
    onDrop: async (noteId, sourceFolder, targetFolder) => {
       await noteManager.moveNoteToFolder(noteId, sourceFolder, targetFolder);
       ui.showToast(`Moved to ${targetFolder}`, 'success');
       refreshNotes();
    }
  });
}

function renderNotes(notes: NoteInfo[]) {
  const state = noteManager.currentState;
  ui.renderNotes(notes, { 
      id: state.currentNoteId, 
      folder: state.activeNoteFolder, 
      searchQuery: ui.elements.searchInput.value.trim() 
    }, {
      onSelect: async (id, folder) => {
          await loadNote(id, folder);
      },
      onRename: async (id, folder) => {
          // Find current note title/name (file name for now)
          const note = notes.find(n => n.id === id);
          if (!note) return;
          showRenameModal('note', note.title, async (newName) => {
              const result = await noteManager.renameNote(id, newName, folder);
              if (result.success) {
                  ui.showToast('Note renamed', 'success');
                  if (state.currentNoteId === id) {
                      // Note ID changes if filename changes
                      noteManager.setCurrentNote(result.noteId || newName, folder);
                  }
                  refreshNotes();
                  if (result.noteId) loadNote(result.noteId, folder);
              } else {
                  ui.showToast(`Failed: ${result.error}`, 'error');
              }
          });
      },
      onDelete: async (id, folder) => {
          // Implement Delete
          const confirmed = confirm(`Delete note?`); // Temporary, use Modal later
          if (confirmed) {
              await noteManager.deleteNote(id, folder);
              ui.showToast('Note deleted', 'success');
              
              if (state.currentNoteId === id) {
                  // Clear editor and state immediately
                  editorManager.clear();
                  noteManager.setCurrentNote(null);
                  window.electron.saveLastNote(null, null); // Clear persistence
                  
                  // Optional: Load the next available note or the first one in list
                  // For now, just leaving it empty or letting refreshNotes handle list
                  // refreshNotes will re-render list, and if no note selected, UI shows empty
              }
              
              await refreshNotes();
          }
      },
      onDragStart: (id, folder) => {
          // Drag state handled in UI
      },
      onDrop: async (targetId, targetFolder) => {
          // Reorder logic handling
          // noteManager.reorderNote(...)
      }
  });
}

async function loadNote(id: string, folder: string) {
    // Auto-save previous
    if (noteManager.currentState.currentNoteId) {
        saveCurrentNote(); // async but don't await to block UI?
    }

    noteManager.setCurrentNote(id, folder);
    const result = await noteManager.readNote(id, folder);
    
    if (result.success && result.content !== undefined) {
        editorManager.setContent(result.content);
        refreshNotes(); // To update active class
    } else {
        // If note is missing, clear state and persistence
        if (result.error && (result.error.includes('ENOENT') || result.error.includes('no such file'))) {
             ui.showToast('Note found (removed)', 'error');
             editorManager.clear();
             noteManager.setCurrentNote(null);
             window.electron.saveLastNote(null, null);
             refreshNotes();
        } else {
            ui.showToast(`Failed to load: ${result.error}`, 'error');
        }
    }
}

async function saveCurrentNote() {
    const { currentNoteId, activeNoteFolder } = noteManager.currentState;
    // Don't save if no note selected or if it was just deleted (handled by caller usually but safety check)
    if (!currentNoteId) {
        // If no note selected but we have content, create a new one!
        const content = editorManager.getContent();
        if (content && content.trim().length > 0) {
            ui.updateSaveIndicator('saving');
            const result = await noteManager.createNote();
            if (result.success && result.noteId) {
                // Set as current immediately
                noteManager.setCurrentNote(result.noteId, result.folder);
                ui.showToast('New note created', 'success');
                // Refresh to show in list
                await refreshNotes();
                // Now save the content
                const saveResult = await noteManager.saveNote(result.noteId, content, result.folder || '');
                if (saveResult.success) {
                    ui.updateSaveIndicator('saved');
                } else {
                    ui.updateSaveIndicator('error', saveResult.error);
                }
            } else {
                ui.showToast(`Failed to create note: ${result.error}`, 'error');
            }
        }
        return;
    }

    if (currentNoteId) {
        // Optimization: prevent updating modified time if content hasn't changed
        if (!editorManager.isContentChanged()) {
             return;
        }

        ui.updateSaveIndicator('saving');
        const content = editorManager.getContent();
        const result = await noteManager.saveNote(currentNoteId, content, activeNoteFolder);
        if (result.success) {
            ui.updateSaveIndicator('saved');
            // Update original content so subsequent saves also check correctly
            editorManager.setContent(content); 
        } else {
             // If error is ENOENT, it means note was deleted. Stop trying to save it.
            if (result.error && (result.error.includes('ENOENT') || result.error.includes('no such file'))) {
                 noteManager.setCurrentNote(null); // Clear state so we don't try again
                 ui.updateSaveIndicator('saved'); // Or just hidden
            } else {
                ui.updateSaveIndicator('error', result.error);
            }
        }
    }
}

// ============ Wiring ============

// Search
ui.elements.searchInput.addEventListener('input', () => {
    refreshNotes();
});

// Editor
editorManager.onInput = () => {
    ui.updateSaveIndicator('saving');
    if (autoSaveTimer) clearTimeout(autoSaveTimer);
    autoSaveTimer = window.setTimeout(() => {
        saveCurrentNote();
    }, 1000);
};

editorManager.onStatsUpdate = (completed, total) => {
    const statsEl = document.getElementById('stats-indicator');
    if (statsEl) {
        if (total > 0) {
            statsEl.textContent = `${completed}/${total} completed`;
            statsEl.style.opacity = '1';
        } else {
            statsEl.textContent = '';
            statsEl.style.opacity = '0';
        }
    }
};

// Buttons
document.getElementById('new-note-btn')?.addEventListener('click', async () => {
    const result = await noteManager.createNote();
    if (result.success && result.noteId) {
        ui.showToast('Note created', 'success');
        refreshNotes();
        loadNote(result.noteId, result.folder || '');
    }
});

document.getElementById('copy-note-btn')?.addEventListener('click', async () => {
    const content = editorManager.getContent();
    if (!content) {
        ui.showToast('Note is empty', 'error');
        return;
    }
    
    try {
        await navigator.clipboard.writeText(content);
        ui.showToast('Note copied to clipboard', 'success');
    } catch (err) {
        console.error('Failed to copy:', err);
        ui.showToast('Failed to copy to clipboard', 'error');
    }
});

// Window Controls
document.getElementById('minimize-btn')?.addEventListener('click', () => window.electron.minimizeWindow());
document.getElementById('maximize-btn')?.addEventListener('click', () => window.electron.maximizeWindow());
document.getElementById('close-btn')?.addEventListener('click', () => window.electron.closeWindow());

document.getElementById('toggle-sidebar-btn')?.addEventListener('click', () => {
    ui.toggleSidebar();
});

ui.elements.minimalModeBtn.addEventListener('click', () => {
    const isMinimal = ui.elements.appContainer.classList.contains('minimal-mode');
    ui.toggleMinimalMode(!isMinimal);
});

// Toolbar
document.querySelectorAll('.toolbar-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const action = (btn as HTMLElement).dataset.action;
        switch(action) {
            case 'bold': editorManager.insertMarkdown('**', '**'); break;
            case 'italic': editorManager.insertMarkdown('*', '*'); break;
            case 'heading': editorManager.insertLineMarkdown('## '); break;
            case 'link': editorManager.insertMarkdown('[', '](url)'); break;
            case 'code': editorManager.insertMarkdown('`', '`'); break;
            case 'ul': editorManager.insertLineMarkdown('- '); break;
            case 'ol': editorManager.insertLineMarkdown('1. '); break;
            case 'todo': editorManager.insertLineMarkdown('- [ ] '); break;
        }
    });
});

document.getElementById('toggle-preview')?.addEventListener('click', () => {
    editorManager.togglePreview();
});

// Undo/Redo
document.getElementById('undo-btn')?.addEventListener('click', () => { document.execCommand('undo'); editorManager.updatePreview(); });
document.getElementById('redo-btn')?.addEventListener('click', () => { document.execCommand('redo'); editorManager.updatePreview(); });

// Keyboard Shortcuts
shortcutManager.registerCtrl('s', (e) => {
    e.preventDefault();
    saveCurrentNote().then(() => ui.showToast('Saved', 'success'));
});

shortcutManager.registerCtrl('n', (e) => {
    e.preventDefault();
    document.getElementById('new-note-btn')?.click(); // trigger click for easy re-use
});

shortcutManager.registerCtrl('e', (e) => {
    e.preventDefault();
    editorManager.togglePreview();
});

shortcutManager.registerCtrl('/', (e) => {
    e.preventDefault();
    document.getElementById('shortcuts-modal')?.classList.add('show');
});

shortcutManager.registerCtrl('b', (e) => {
    e.preventDefault();
    editorManager.insertMarkdown('**', '**');
});

shortcutManager.registerCtrl('i', (e) => {
    e.preventDefault();
    editorManager.insertMarkdown('*', '*');
});

shortcutManager.registerCtrl('k', (e) => {
    e.preventDefault();
    editorManager.insertMarkdown('[', '](url)');
});

shortcutManager.registerCtrl('d', (e) => {
    e.preventDefault();
    editorManager.duplicateLine();
});

shortcutManager.register('shift+delete', (e) => {
    e.preventDefault();
    editorManager.deleteCurrentLine();
});

shortcutManager.registerCtrl('=', (e) => {
    e.preventDefault();
    editorManager.changeFontSize(2);
});

shortcutManager.registerCtrl('-', (e) => {
    e.preventDefault();
    editorManager.changeFontSize(-2);
});

// Shortcuts Modal
const shortcutsModal = document.getElementById('shortcuts-modal');
const shortcutsBtn = document.getElementById('shortcuts-btn');
const shortcutsClose = document.getElementById('shortcuts-close');

if (shortcutsModal && shortcutsBtn && shortcutsClose) {
    shortcutsBtn.addEventListener('click', () => shortcutsModal.classList.add('show'));
    shortcutsClose.addEventListener('click', () => shortcutsModal.classList.remove('show'));
    // Close on click outside
    shortcutsModal.addEventListener('click', (e) => {
       if (e.target === shortcutsModal) shortcutsModal.classList.remove('show');
    });
}
shortcutManager.register('escape', () => {
    ui.closeAllModals(); 
    if (shortcutsModal) shortcutsModal.classList.remove('show');
});


// Auto-collapse sidebar on small windows
let wasManuallyCollapsed = false;
let lastWindowWidth = window.innerWidth;

function handleWindowResize() {
    const width = window.innerWidth;
    const sidebar = ui.elements.sidebar;
    const isCollapsed = sidebar.classList.contains('collapsed');
    
    // Auto-collapse sidebar when window is very small
    if (width <= 400) {
        if (!isCollapsed) {
            sidebar.classList.add('collapsed');
            wasManuallyCollapsed = false;
        }
    } else if (width > 400 && lastWindowWidth <= 400 && isCollapsed && !wasManuallyCollapsed) {
        // Auto-expand if window grows from small to large and it was auto-collapsed
        sidebar.classList.remove('collapsed');
    }
    
    lastWindowWidth = width;
}

// Track manual sidebar toggles via button click
document.getElementById('toggle-sidebar-btn')?.addEventListener('click', () => {
    // Small delay to let the toggle happen first
    setTimeout(() => {
        wasManuallyCollapsed = ui.elements.sidebar.classList.contains('collapsed');
    }, 0);
});

window.addEventListener('resize', handleWindowResize);
// Check on initial load
handleWindowResize();

// Initialization
async function init() {
    await refreshFolders();
    await refreshNotes();
    
    // Load global shortcut display
    const key = await window.electron.getGlobalShortcut();
    const display = document.getElementById('shortcut-display');
    if (display) display.textContent = key;

    // Listen for external updates (Quick Note, Clipboard)
    window.electron.onRefreshNotes((noteId) => {
        refreshNotes();
        if (noteId) {
             ui.showToast('New note created externally');
        }
    });

    // Load initial state
    const { noteId, folder } = await window.electron.getLastNote();
    if (noteId) {
        // Ensure folder is loaded/valid context
        if (folder) {
            noteManager.setCurrentFolder(folder);
            await refreshFolders(); // Update UI selection
            await refreshNotes();   // Update list for that folder
        }
        await loadNote(noteId, folder || '');
    } else {
        // Default to first folder if available, or just list root
        await refreshFolders();
        await refreshNotes();
    }
}

init();

// Record Shortcut Logic (simplified port)
const recordBtn = document.getElementById('record-shortcut-btn');
if (recordBtn) {
    recordBtn.addEventListener('click', () => {
        isRecordingShortcut = true;
        recordBtn.textContent = 'Press Key...';
        recordBtn.classList.add('active');
        document.getElementById('shortcut-display')?.classList.add('recording');
    });
}

document.addEventListener('keydown', async (e) => {
    if (!isRecordingShortcut) return;
    e.preventDefault();
    e.stopPropagation();
    
    if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return;
    
    const parts = [];
    if (e.metaKey || e.ctrlKey) parts.push('CommandOrControl');
    if (e.altKey) parts.push('Alt');
    if (e.shiftKey) parts.push('Shift');
    
    let key = e.key;
    if (key === ' ') key = 'Space';
    else if (key.length === 1) key = key.toUpperCase();
    else if (key.startsWith('Arrow')) key = key.replace('Arrow', ''); // Up, Down etc
    
    parts.push(key);
    const accelerator = parts.join('+');
    
    const result = await window.electron.setGlobalShortcut(accelerator);
    if (result.success) {
        const display = document.getElementById('shortcut-display');
        if (display) display.textContent = accelerator;
        ui.showToast(`Global shortcut set to ${accelerator}`, 'success');
    } else {
        ui.showToast(`Failed: ${result.error}`, 'error');
    }
    
    isRecordingShortcut = false;
    recordBtn!.textContent = 'Record';
    recordBtn!.classList.remove('active');
    document.getElementById('shortcut-display')?.classList.remove('recording');
});

// ============ Modals Logic ============

function showRenameModal(type: 'note' | 'folder', currentName: string, onConfirm: (newName: string) => void) {
    ui.elements.renameTitle.textContent = `Rename ${type === 'note' ? 'Note' : 'Folder'}`;
    ui.elements.renameInput.value = currentName;
    ui.elements.renameModal.classList.add('show');
    ui.elements.renameInput.focus();
    
    const handleConfirm = () => {
        const newName = ui.elements.renameInput.value.trim();
        if (newName && newName !== currentName) {
            onConfirm(newName);
            closeRename();
        }
    };

    const closeRename = () => {
        ui.elements.renameModal.classList.remove('show');
        cleanup();
    };

    const cleanup = () => {
        ui.elements.renameConfirm.removeEventListener('click', handleConfirm);
        ui.elements.renameCancel.removeEventListener('click', closeRename);
        ui.elements.renameClose.removeEventListener('click', closeRename);
        ui.elements.renameInput.removeEventListener('keydown', keyHandler);
    };
    
    const keyHandler = (e: KeyboardEvent) => {
        if (e.key === 'Enter') handleConfirm();
        if (e.key === 'Escape') closeRename();
    };

    ui.elements.renameConfirm.addEventListener('click', handleConfirm);
    ui.elements.renameCancel.addEventListener('click', closeRename);
    ui.elements.renameClose.addEventListener('click', closeRename);
    ui.elements.renameInput.addEventListener('keydown', keyHandler);
}

function showConfirmModal(message: string, onConfirm: () => void) {
    ui.elements.confirmMessage.textContent = message;
    ui.elements.confirmModal.classList.add('show');
    
    const handleConfirm = () => {
        onConfirm();
        closeConfirm();
    };

    const closeConfirm = () => {
        ui.elements.confirmModal.classList.remove('show');
        cleanup();
    };
    
    const cleanup = () => {
        ui.elements.confirmOk.removeEventListener('click', handleConfirm);
        ui.elements.confirmCancel.removeEventListener('click', closeConfirm);
        ui.elements.confirmClose.removeEventListener('click', closeConfirm);
    };

    ui.elements.confirmOk.addEventListener('click', handleConfirm);
    ui.elements.confirmCancel.addEventListener('click', closeConfirm);
    ui.elements.confirmClose.addEventListener('click', closeConfirm);
}

// Wire New Folder
document.getElementById('new-folder-btn')?.addEventListener('click', () => {
    ui.elements.createFolderInput.value = '';
    ui.elements.createFolderModal.classList.add('show');
    ui.elements.createFolderInput.focus();
    
    // Define cleanups to avoid duplicate listeners if clicked multiple times
    // A better pattern for single-instance app logic would be to define these outside
    // but for quick wiring inside the event handler we must be careful.
    // Let's use `once` or similar, or just remove listener before adding.
    // Actually simpler to just define named functions inside specific scope if we can ensure cleanup.
    // But here we are adding listeners every time we open the modal.
    // Fix: Move the modal logic to a dedicated init block or use cleanup in the close function.
    
    const handleCreate = async () => {
        const name = ui.elements.createFolderInput.value.trim();
        if (name) {
            const result = await noteManager.createFolder(name);
            if (result.success) {
                ui.showToast('Folder created', 'success');
                refreshFolders();
                closeCreate();
            } else {
                ui.showToast(`Failed: ${result.error}`, 'error');
            }
        }
    };
    
    const closeCreate = () => {
        ui.elements.createFolderModal.classList.remove('show');
        cleanup();
    };

    const cleanup = () => {
        ui.elements.createFolderConfirm.removeEventListener('click', handleCreate);
        ui.elements.createFolderCancel.removeEventListener('click', closeCreate);
        ui.elements.createFolderClose.removeEventListener('click', closeCreate);
        ui.elements.createFolderInput.removeEventListener('keydown', keyHandler);
    };

    const keyHandler = (e: KeyboardEvent) => {
        if (e.key === 'Enter') handleCreate();
        if (e.key === 'Escape') closeCreate();
    };

    ui.elements.createFolderConfirm.addEventListener('click', handleCreate);
    ui.elements.createFolderCancel.addEventListener('click', closeCreate);
    ui.elements.createFolderClose.addEventListener('click', closeCreate);
    ui.elements.createFolderInput.addEventListener('keydown', keyHandler);
});

