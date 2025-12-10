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

// ============ Tab Management ============
interface Tab {
  id: string;
  folder: string;
  title: string;
  content: string;
  modified: boolean;
}

let openTabs: Tab[] = [];
let activeTabIndex = -1;

function getTabsBar(): HTMLElement {
  return document.getElementById('tabs-bar') as HTMLElement;
}

function renderTabs() {
  const tabsBar = getTabsBar();
  tabsBar.innerHTML = '';
  
  if (openTabs.length === 0) {
    tabsBar.classList.add('hidden');
    return;
  }
  tabsBar.classList.remove('hidden');
  
  openTabs.forEach((tab, index) => {
    const tabEl = document.createElement('div');
    tabEl.className = 'tab-item' + (index === activeTabIndex ? ' active' : '') + (tab.modified ? ' modified' : '');
    
    const title = document.createElement('span');
    title.className = 'tab-title';
    title.textContent = tab.title;
    
    const closeBtn = document.createElement('button');
    closeBtn.className = 'tab-close';
    closeBtn.innerHTML = '<svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      closeTab(index);
    });
    
    tabEl.appendChild(title);
    tabEl.appendChild(closeBtn);
    tabEl.addEventListener('click', () => switchToTab(index));
    tabsBar.appendChild(tabEl);
  });
}

function findTabIndex(id: string, folder: string): number {
  return openTabs.findIndex(t => t.id === id && t.folder === folder);
}

function openTab(id: string, folder: string, title: string, content: string) {
  const existingIndex = findTabIndex(id, folder);
  if (existingIndex >= 0) {
    switchToTab(existingIndex);
    return;
  }
  
  saveCurrentTabContent();
  
  const tab: Tab = { id, folder, title, content, modified: false };
  openTabs.push(tab);
  activeTabIndex = openTabs.length - 1;
  editorManager.setContent(content);
  renderTabs();
}

function switchToTab(index: number) {
  if (index < 0 || index >= openTabs.length || index === activeTabIndex) return;
  
  saveCurrentTabContent();
  activeTabIndex = index;
  const tab = openTabs[activeTabIndex];
  editorManager.setContent(tab.content);
  noteManager.setCurrentNote(tab.id, tab.folder);
  renderTabs();
  refreshNotes();
}

function closeTab(index: number) {
  if (index < 0 || index >= openTabs.length) return;
  
  const tab = openTabs[index];
  if (tab.modified) {
    noteManager.saveNote(tab.id, tab.content, tab.folder);
  }
  
  openTabs.splice(index, 1);
  
  if (openTabs.length === 0) {
    activeTabIndex = -1;
    editorManager.clear();
    noteManager.setCurrentNote(null);
  } else if (index <= activeTabIndex) {
    activeTabIndex = Math.max(0, activeTabIndex - 1);
    const newTab = openTabs[activeTabIndex];
    editorManager.setContent(newTab.content);
    noteManager.setCurrentNote(newTab.id, newTab.folder);
  }
  
  renderTabs();
  refreshNotes();
}

function saveCurrentTabContent() {
  if (activeTabIndex >= 0 && openTabs[activeTabIndex]) {
    openTabs[activeTabIndex].content = editorManager.getContent();
  }
}

function markCurrentTabModified() {
  if (activeTabIndex >= 0 && openTabs[activeTabIndex]) {
    openTabs[activeTabIndex].modified = true;
    openTabs[activeTabIndex].content = editorManager.getContent();
    renderTabs();
  }
}

function markCurrentTabSaved() {
  if (activeTabIndex >= 0 && openTabs[activeTabIndex]) {
    openTabs[activeTabIndex].modified = false;
    renderTabs();
  }
}

function getCurrentTab(): Tab | null {
  return activeTabIndex >= 0 ? openTabs[activeTabIndex] : null;
}

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

let currentDisplayedNotes: NoteInfo[] = [];
let focusedNoteIndex = -1;

function renderNotes(notes: NoteInfo[]) {
  currentDisplayedNotes = notes;
  const currentTab = getCurrentTab();
  ui.renderNotes(notes, { 
      id: currentTab?.id || null, 
      folder: currentTab?.folder || '', 
      searchQuery: ui.elements.searchInput.value.trim() 
    }, {
      onSelect: async (id, folder) => {
          await loadNote(id, folder);
      },
      onRename: async (id, folder) => {
          const note = notes.find(n => n.id === id);
          if (!note) return;
          showRenameModal('note', note.title, async (newName) => {
              const result = await noteManager.renameNote(id, newName, folder);
              if (result.success) {
                  ui.showToast('Note renamed', 'success');
                  if (currentTab?.id === id) {
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
          const confirmed = confirm(`Delete note?`);
          if (confirmed) {
              await noteManager.deleteNote(id, folder);
              ui.showToast('Note deleted', 'success');
              
              // Close tab if open
              const tabIdx = findTabIndex(id, folder);
              if (tabIdx >= 0) {
                  openTabs.splice(tabIdx, 1);
                  if (tabIdx <= activeTabIndex) {
                      activeTabIndex = Math.max(0, activeTabIndex - 1);
                  }
                  if (openTabs.length === 0) {
                      activeTabIndex = -1;
                      editorManager.clear();
                      noteManager.setCurrentNote(null);
                  } else {
                      const newTab = openTabs[activeTabIndex];
                      editorManager.setContent(newTab.content);
                      noteManager.setCurrentNote(newTab.id, newTab.folder);
                  }
                  renderTabs();
              }
              
              window.electron.saveLastNote(null, null);
              await refreshNotes();
          }
      },
      onDragStart: (id, folder) => {
          // Drag state handled in UI
      },
      onDrop: async (targetId, targetFolder) => {
          // Reorder logic handling
          // noteManager.reorderNote(...)
      },
      onPin: async (id) => {
          await noteManager.togglePin(id);
          await refreshNotes();
      }
  });

  // Highlight focused item if exists
  if (focusedNoteIndex >= 0 && focusedNoteIndex < notes.length) {
      const noteId = notes[focusedNoteIndex].id;
      const noteEl = document.querySelector(`.note-item[data-note-id="${noteId}"]`) as HTMLElement;
      if (noteEl) noteEl.classList.add('focused');
  }
}

// Sidebar Navigation
document.addEventListener('keydown', (e) => {
    // Only if sidebar is visible and no modals are open
    if (ui.elements.sidebar.classList.contains('collapsed')) return;
    if (document.querySelector('.modal-overlay.show')) return;
    
    // Allow navigation if body is focused or search input is focused
    // or if we clicked into the sidebar
    const active = document.activeElement;
    const isSidebarContext = active === document.body || active === ui.elements.searchInput || (active && ui.elements.sidebar.contains(active));
    
    if (!isSidebarContext) return;
    
    // Ignore if Ctrl/Meta is pressed (shortcuts)
    if (e.ctrlKey || e.metaKey || e.altKey) return;

    if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (currentDisplayedNotes.length === 0) return;
        focusedNoteIndex++;
        if (focusedNoteIndex >= currentDisplayedNotes.length) focusedNoteIndex = currentDisplayedNotes.length - 1;
        updateSidebarFocus();
    } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (currentDisplayedNotes.length === 0) return;
        focusedNoteIndex--;
        if (focusedNoteIndex < 0) focusedNoteIndex = 0;
        updateSidebarFocus();
    } else if (e.key === 'Enter') {
        if (focusedNoteIndex >= 0 && focusedNoteIndex < currentDisplayedNotes.length) {
            // Only if we are not renaming or searching? 
            // If in search input, Enter moves to note
            e.preventDefault();
            const note = currentDisplayedNotes[focusedNoteIndex];
            loadNote(note.id, note.folder);
            // unfocus search input so we can type in editor?
            // Actually usually we want to focus editor
            editorManager.focus();
        }
    }
});

function updateSidebarFocus() {
    // Remove previous focus
    document.querySelectorAll('.note-item.focused').forEach(el => el.classList.remove('focused'));
    
    if (focusedNoteIndex >= 0 && focusedNoteIndex < currentDisplayedNotes.length) {
        const note = currentDisplayedNotes[focusedNoteIndex];
        const noteEl = document.querySelector(`.note-item[data-note-id="${note.id}"]`) as HTMLElement;
        if (noteEl) {
            noteEl.classList.add('focused');
            noteEl.scrollIntoView({ block: 'nearest' });
        }
    }
}

// ============ Recent Notes History ============
const recentNotesStack: {id: string, folder: string}[] = [];

async function loadNote(id: string, folder: string) {
    // Auto-save previous tab
    saveCurrentTabContent();
    const currentTab = getCurrentTab();
    if (currentTab && currentTab.modified) {
        await noteManager.saveNote(currentTab.id, currentTab.content, currentTab.folder);
    }

    noteManager.setCurrentNote(id, folder);
    const result = await noteManager.readNote(id, folder);
    
    if (result.success && result.content !== undefined) {
        const title = id.replace('.md', '');
        openTab(id, folder, title, result.content);
        
        if (folder !== noteManager.currentState.currentFolder) {
            noteManager.setCurrentFolder(folder);
            ui.elements.searchInput.value = '';
            await refreshFolders();
        }
        
        refreshNotes();
        
        const idx = recentNotesStack.findIndex(n => n.id === id);
        if (idx !== -1) recentNotesStack.splice(idx, 1);
        recentNotesStack.push({ id, folder });
        
    } else {
        if (result.error && (result.error.includes('ENOENT') || result.error.includes('no such file'))) {
             ui.showToast('Note not found', 'error');
             editorManager.clear();
             noteManager.setCurrentNote(null);
             window.electron.saveLastNote(null, null);
             refreshNotes();
        } else {
            ui.showToast(`Failed to load: ${result.error}`, 'error');
        }
    }
}

// Shortcut
shortcutManager.registerCtrl('Tab', (e) => {
    e.preventDefault();
    if (recentNotesStack.length > 1) {
        // Get the previous one (2nd from top)
        // stack = [A, B]. Current is B. Target is A.
        const target = recentNotesStack[recentNotesStack.length - 2];
        loadNote(target.id, target.folder);
    }
});

async function saveCurrentNote() {
    const tab = getCurrentTab();
    
    if (!tab) {
        const content = editorManager.getContent();
        if (content && content.trim().length > 0) {
            ui.updateSaveIndicator('saving');
            const result = await noteManager.createNote();
            if (result.success && result.noteId) {
                noteManager.setCurrentNote(result.noteId, result.folder);
                ui.showToast('New note created', 'success');
                await refreshNotes();
                const saveResult = await noteManager.saveNote(result.noteId, content, result.folder || '');
                if (saveResult.success) {
                    ui.updateSaveIndicator('saved');
                    const title = result.noteId.replace('.md', '');
                    openTab(result.noteId, result.folder || '', title, content);
                } else {
                    ui.updateSaveIndicator('error', saveResult.error);
                }
            } else {
                ui.showToast(`Failed to create note: ${result.error}`, 'error');
            }
        }
        return;
    }

    if (!tab.modified) return;

    ui.updateSaveIndicator('saving');
    saveCurrentTabContent();
    const result = await noteManager.saveNote(tab.id, tab.content, tab.folder);
    
    if (result.success) {
        ui.updateSaveIndicator('saved');
        markCurrentTabSaved();
        editorManager.setContent(tab.content);
    } else {
        if (result.error && (result.error.includes('ENOENT') || result.error.includes('no such file'))) {
            noteManager.setCurrentNote(null);
            closeTab(activeTabIndex);
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
    markCurrentTabModified();
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

// Exit minimal mode button
document.getElementById('exit-minimal-btn')?.addEventListener('click', () => {
    ui.toggleMinimalMode(false);
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

// ============ Command Palette Logic ============

let allPaletteNotes: NoteInfo[] = [];
let filteredPaletteNotes: NoteInfo[] = [];
let commandPaletteSelectedIndex = 0;

function renderCommandPaletteResults(notes: NoteInfo[]) {
    const container = ui.elements.commandPaletteResults;
    container.innerHTML = '';
    
    if (notes.length === 0) {
        const item = document.createElement('div');
        item.className = 'note-item';
        item.style.cursor = 'default';
        item.textContent = 'No matching notes';
        container.appendChild(item);
        return;
    }

    notes.forEach((note, index) => {
        const item = document.createElement('div');
        item.className = 'note-item';
        if (index === commandPaletteSelectedIndex) {
            item.classList.add('active');
            // Scroll into view if needed
            // Use setTimeout to ensure layout is done? usually fine synchronously here
        }
        
        const dateStr = new Date(note.modified).toLocaleDateString();
        // Highlight title match?
        // Reuse ui.escapeHtml
        // For simple MVP text content is fine
        
        item.innerHTML = `
            <div class="note-content">
                <h3>${ui.escapeHtml(note.title)}</h3>
                <div class="note-meta">
                   <span class="note-date">${dateStr}</span>
                   ${note.folder ? `<span class="note-folder">${note.folder}</span>` : ''}
                </div>
            </div>
        `;
        
        item.addEventListener('click', () => {
            loadNote(note.id, note.folder);
            closeCommandPalette();
        });
        
        // Ensure active item is visible
        if (index === commandPaletteSelectedIndex) {
             // We can't scroll immediately if not attached? attached above.
             // Manual scroll logic or scrollIntoView
             // scrollIntoView might scroll the whole modal if not careful with options
        }

        container.appendChild(item);
    });
    
    // Scroll active element into view
    const activeItem = container.children[commandPaletteSelectedIndex] as HTMLElement;
    if (activeItem) {
        activeItem.scrollIntoView({ block: 'nearest' });
    }
}

function closeCommandPalette() {
    ui.elements.commandPaletteModal.classList.remove('show');
}

async function openCommandPalette() {
    ui.elements.commandPaletteModal.classList.add('show');
    
    // Focus strategies: immediate + delayed to catch after transition
    ui.elements.commandPaletteInput.value = '';
    ui.elements.commandPaletteInput.focus();
    
    // Fallback for slower transitions (CSS might hold it invisible for a frame)
    setTimeout(() => {
        ui.elements.commandPaletteInput.focus();
    }, 50);
    
    // Load all notes
    allPaletteNotes = await noteManager.listAllNotes();
    filteredPaletteNotes = allPaletteNotes;
    commandPaletteSelectedIndex = 0;
    renderCommandPaletteResults(filteredPaletteNotes);
}

// Event listeners for Command Palette Input
ui.elements.commandPaletteInput.addEventListener('input', (e) => {
    const query = (e.target as HTMLInputElement).value.toLowerCase();
    
    if (!query) {
        filteredPaletteNotes = allPaletteNotes;
    } else {
        // Reuse fuzzy search score logic or simple includes for now?
        // Simple includes for speed as requested in initial MVP
        filteredPaletteNotes = allPaletteNotes.filter(note => 
            note.title.toLowerCase().includes(query)
        );
    }
    
    commandPaletteSelectedIndex = 0;
    renderCommandPaletteResults(filteredPaletteNotes);
});

ui.elements.commandPaletteInput.addEventListener('keydown', (e) => {
    e.stopPropagation(); // Prevent bubbling to document
    
    if (e.key === 'ArrowDown') {
        e.preventDefault();
        commandPaletteSelectedIndex = (commandPaletteSelectedIndex + 1) % filteredPaletteNotes.length;
        renderCommandPaletteResults(filteredPaletteNotes);
    } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        commandPaletteSelectedIndex = (commandPaletteSelectedIndex - 1 + filteredPaletteNotes.length) % filteredPaletteNotes.length;
        renderCommandPaletteResults(filteredPaletteNotes);
    } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredPaletteNotes[commandPaletteSelectedIndex]) {
            const note = filteredPaletteNotes[commandPaletteSelectedIndex];
            loadNote(note.id, note.folder);
            closeCommandPalette();
        }
    } else if (e.key === 'Escape') {
        e.preventDefault();
        closeCommandPalette();
    }
});

ui.elements.commandPaletteClose.addEventListener('click', closeCommandPalette);

// Register Ctrl+P
shortcutManager.registerCtrl('p', (e) => {
    e.preventDefault();
    openCommandPalette();
});

// Sort Handler - Custom Dropdown
const sortTrigger = ui.elements.sortTrigger;
const sortMenu = ui.elements.sortMenu;

sortTrigger.addEventListener('click', (e) => {
    e.stopPropagation();
    sortMenu.classList.toggle('show');
});

// Close dropdown when clicking outside
document.addEventListener('click', (e) => {
    if (!sortMenu.contains(e.target as Node) && !sortTrigger.contains(e.target as Node)) {
        sortMenu.classList.remove('show');
    }
});

// Handle Sort Selection
sortMenu.querySelectorAll('.dropdown-item').forEach(item => {
    item.addEventListener('click', () => {
        const order = (item as HTMLElement).dataset.value;
        if (order) {
            noteManager.setSortOrder(order as any);
            
            // Update UI
            sortMenu.querySelectorAll('.dropdown-item').forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            
            sortMenu.classList.remove('show');
            refreshNotes();
        }
    });
});


// Sidebar Focus Shortcut
shortcutManager.register('ctrl+shift+e', (e) => {
    e.preventDefault();
    if (ui.elements.sidebar.classList.contains('collapsed')) {
        document.getElementById('toggle-sidebar-btn')?.click();
    }
    ui.elements.searchInput.focus();
});

// Initialization
async function init() {
    // Sync Sort UI
    if (noteManager.sortOrder) {
        sortMenu.querySelectorAll('.dropdown-item').forEach(item => {
            if ((item as HTMLElement).dataset.value === noteManager.sortOrder) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });
    }
    
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

// ============ Display Settings Modal ============
const displaySettingsModal = document.getElementById('display-settings-modal');
const displaySettingsBtn = document.getElementById('display-settings-btn');
const displaySettingsClose = document.getElementById('display-settings-close');
const opacitySlider = document.getElementById('opacity-slider') as HTMLInputElement;
const opacityValue = document.getElementById('opacity-value');

if (displaySettingsModal && displaySettingsBtn && displaySettingsClose) {
  displaySettingsBtn.addEventListener('click', async () => {
    displaySettingsModal.classList.add('show');
    
    const opacity = await window.electron.getWindowOpacity();
    if (opacitySlider) opacitySlider.value = String(Math.round(opacity * 100));
    if (opacityValue) opacityValue.textContent = `${Math.round(opacity * 100)}%`;
  });
  
  displaySettingsClose.addEventListener('click', () => {
    displaySettingsModal.classList.remove('show');
  });
  
  displaySettingsModal.addEventListener('click', (e) => {
    if (e.target === displaySettingsModal) displaySettingsModal.classList.remove('show');
  });
}

if (opacitySlider) {
  opacitySlider.addEventListener('input', async (e) => {
    const value = parseInt((e.target as HTMLInputElement).value);
    if (opacityValue) opacityValue.textContent = `${value}%`;
    await window.electron.setWindowOpacity(value / 100);
  });
}

document.querySelectorAll('.corner-btn').forEach(btn => {
  btn.addEventListener('click', async () => {
    const corner = (btn as HTMLElement).dataset.corner as 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
    if (corner) {
      await window.electron.snapToCorner(corner);
      ui.showToast(`Snapped to ${corner.replace('-', ' ')}`, 'info');
    }
  });
});

// ============ Tab Keyboard Shortcuts ============

// Close current tab: Ctrl+W
shortcutManager.registerCtrl('w', (e) => {
    e.preventDefault();
    if (activeTabIndex >= 0) {
        closeTab(activeTabIndex);
    }
});

// Next tab: Ctrl+Tab or Ctrl+PageDown
shortcutManager.register('ctrl+tab', (e) => {
    e.preventDefault();
    if (openTabs.length > 1) {
        const nextIndex = (activeTabIndex + 1) % openTabs.length;
        switchToTab(nextIndex);
    }
});

shortcutManager.registerCtrl('pagedown', (e) => {
    e.preventDefault();
    if (openTabs.length > 1) {
        const nextIndex = (activeTabIndex + 1) % openTabs.length;
        switchToTab(nextIndex);
    }
});

// Previous tab: Ctrl+Shift+Tab or Ctrl+PageUp  
shortcutManager.register('ctrl+shift+tab', (e) => {
    e.preventDefault();
    if (openTabs.length > 1) {
        const prevIndex = (activeTabIndex - 1 + openTabs.length) % openTabs.length;
        switchToTab(prevIndex);
    }
});

shortcutManager.registerCtrl('pageup', (e) => {
    e.preventDefault();
    if (openTabs.length > 1) {
        const prevIndex = (activeTabIndex - 1 + openTabs.length) % openTabs.length;
        switchToTab(prevIndex);
    }
});