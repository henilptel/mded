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
                  editorManager.clear();
                  noteManager.setCurrentNote(null);
              }
              refreshNotes();
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
        ui.showToast(`Failed to load: ${result.error}`, 'error');
    }
}

async function saveCurrentNote() {
    const { currentNoteId, activeNoteFolder } = noteManager.currentState;
    if (currentNoteId) {
        ui.updateSaveIndicator('saving');
        const content = editorManager.getContent();
        const result = await noteManager.saveNote(currentNoteId, content, activeNoteFolder);
        if (result.success) {
            ui.updateSaveIndicator('saved');
        } else {
            ui.updateSaveIndicator('error', result.error);
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

// Buttons
document.getElementById('new-note-btn')?.addEventListener('click', async () => {
    const result = await noteManager.createNote();
    if (result.success && result.noteId) {
        ui.showToast('Note created', 'success');
        refreshNotes();
        loadNote(result.noteId, result.folder || '');
    }
});

// Window Controls
document.getElementById('minimize-btn')?.addEventListener('click', () => window.electron.minimizeWindow());
document.getElementById('maximize-btn')?.addEventListener('click', () => window.electron.maximizeWindow());
document.getElementById('close-btn')?.addEventListener('click', () => window.electron.closeWindow());

ui.elements.minimalModeBtn.addEventListener('click', () => {
    const isMinimal = ui.elements.appContainer.classList.contains('minimal-mode');
    ui.toggleMinimalMode(!isMinimal);
});

ui.elements.vimToggleBtn.addEventListener('click', () => {
    const active = editorManager.toggleVimMode();
    ui.elements.vimToggleBtn.classList.toggle('active', active);
    ui.showToast(`Vim mode ${active ? 'enabled' : 'disabled'}`, 'info');
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


// Initialization
async function init() {
    await refreshFolders();
    await refreshNotes();
    
    // Load global shortcut display
    const key = await window.electron.getGlobalShortcut();
    const display = document.getElementById('shortcut-display');
    if (display) display.textContent = key;
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

