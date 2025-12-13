// Initialize Tauri API bridge - must be first import to set up window.electron
import './api';

import { NoteManager } from './managers/note-manager';
import { UIManager } from './managers/ui-manager';
import { ShortcutManager } from './managers/shortcut-manager';
import { EditorManager } from './managers/editor-manager';
import { TabManager } from './managers/tab-manager';
import { ModalManager } from './managers/modal-manager';
import { registerKeyboardShortcuts, registerRecentNotesShortcut } from './managers/keyboard-shortcuts';
import { NoteInfo } from './types';

// Initialize Managers
const ui = new UIManager();
const noteManager = new NoteManager();
const shortcutManager = new ShortcutManager();
const editorManager = new EditorManager(ui.elements.editor, ui.elements.preview, ui.elements.modeLabel);
const tabManager = new TabManager(editorManager, noteManager);
const modalManager = new ModalManager(ui);

// State
let autoSaveTimer: number | null = null;
let isRecordingShortcut = false;

// Wire tab manager callbacks
tabManager.onTabChange = () => refreshNotes();
tabManager.onShowSaveError = (msg) => modalManager.showSaveErrorModal(msg);

// ============ Recent Notes History ============
const recentNotesStack: { id: string; folder: string }[] = [];

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
      refreshFolders();
    },
    onRename: (currentName) => {
      modalManager.showRenameModal('folder', currentName, async (newName) => {
        const result = await noteManager.renameFolder(currentName, newName);
        if (result.success) {
          ui.showToast('Folder renamed', 'success');
          // Update all open tabs that were in this folder
          tabManager.updateTabsFolder(currentName, newName);
          if (noteManager.currentState.currentFolder === currentName) {
            noteManager.setCurrentFolder(newName);
          }
          await refreshFolders();
          await refreshNotes();
        } else {
          ui.showToast(`Failed: ${result.error}`, 'error');
        }
      });
    },
    onDelete: (name) => {
      modalManager.showConfirmModal(`Delete folder "${name}" and all its notes?`, async () => {
        const result = await noteManager.deleteFolder(name);
        if (result.success) {
          ui.showToast('Folder deleted', 'success');
          // Close all tabs that were in this folder
          tabManager.closeTabsInFolder(name);
          if (noteManager.currentState.currentFolder === name) {
            noteManager.setCurrentFolder('');
          }
          await refreshFolders();
          await refreshNotes();
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
  const currentTab = tabManager.getCurrentTab();
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
      modalManager.showRenameModal('note', note.title, async (newName) => {
        const result = await noteManager.renameNote(id, newName, folder);
        if (result.success && result.noteId) {
          ui.showToast('Note renamed', 'success');
          // Update the tab if this note is open
          tabManager.updateTabNoteId(id, folder, result.noteId, newName);
          noteManager.setCurrentNote(result.noteId, folder);
          await refreshNotes();
        } else {
          ui.showToast(`Failed: ${result.error}`, 'error');
        }
      });
    },
    onDelete: async (id, folder) => {
      modalManager.showConfirmModal(`Delete note?`, async () => {
        await noteManager.deleteNote(id, folder);
        ui.showToast('Note deleted', 'success');

        // Close tab if open
        const tabIdx = tabManager.findTabIndex(id, folder);
        if (tabIdx >= 0) {
          tabManager.markTabUnmodified(id, folder);
          tabManager.closeTab(tabIdx);
        }

        window.electron.saveLastNote(null, null);
        await refreshNotes();
      });
    },
    onDragStart: () => {},
    onDrop: async () => {},
    onPin: async (id) => {
      await noteManager.togglePin(id);
      await refreshNotes();
    }
  });

  if (focusedNoteIndex >= 0 && focusedNoteIndex < notes.length) {
    const focusedNote = notes[focusedNoteIndex];
    if (focusedNote) {
      const noteEl = document.querySelector(`.note-item[data-note-id="${focusedNote.id}"]`) as HTMLElement;
      if (noteEl) noteEl.classList.add('focused');
    }
  }
}

// Sidebar Navigation
document.addEventListener('keydown', (e) => {
  if (ui.elements.sidebar.classList.contains('collapsed')) return;
  if (document.querySelector('.modal-overlay.show')) return;

  const active = document.activeElement;
  const isSidebarContext = active === document.body || active === ui.elements.searchInput || (active && ui.elements.sidebar.contains(active));

  if (!isSidebarContext) return;
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
      const note = currentDisplayedNotes[focusedNoteIndex];
      if (note) {
        e.preventDefault();
        loadNote(note.id, note.folder);
        editorManager.focus();
      }
    }
  }
});

function updateSidebarFocus() {
  document.querySelectorAll('.note-item.focused').forEach(el => el.classList.remove('focused'));

  if (focusedNoteIndex >= 0 && focusedNoteIndex < currentDisplayedNotes.length) {
    const note = currentDisplayedNotes[focusedNoteIndex];
    if (note) {
      const noteEl = document.querySelector(`.note-item[data-note-id="${note.id}"]`) as HTMLElement;
      if (noteEl) {
        noteEl.classList.add('focused');
        noteEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }
}

async function loadNote(id: string, folder: string) {
  tabManager.saveCurrentTabContent();
  const currentTab = tabManager.getCurrentTab();
  if (currentTab && currentTab.modified) {
    await noteManager.saveNote(currentTab.id, currentTab.content, currentTab.folder);
  }

  noteManager.setCurrentNote(id, folder);
  const result = await noteManager.readNote(id, folder);

  if (result.success && result.content !== undefined) {
    const title = id.replace('.md', '');
    tabManager.openTab(id, folder, title, result.content);

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

async function saveCurrentNote() {
  const tab = tabManager.getCurrentTab();

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
          tabManager.openTab(result.noteId, result.folder || '', title, content);
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
  tabManager.saveCurrentTabContent();
  const result = await noteManager.saveNote(tab.id, tab.content, tab.folder);

  if (result.success) {
    ui.updateSaveIndicator('saved');
    tabManager.markCurrentTabSaved();
  } else {
    if (result.error && (result.error.includes('ENOENT') || result.error.includes('no such file'))) {
      noteManager.setCurrentNote(null);
      await tabManager.closeTab(tabManager.getActiveTabIndex());
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
  tabManager.markCurrentTabModified();
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
    await refreshNotes();
    await loadNote(result.noteId, result.folder || '');
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

document.getElementById('exit-minimal-btn')?.addEventListener('click', () => {
  ui.toggleMinimalMode(false);
});

// Toolbar
document.querySelectorAll('.toolbar-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const action = (btn as HTMLElement).dataset.action;
    switch (action) {
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

document.getElementById('undo-btn')?.addEventListener('click', () => { document.execCommand('undo'); editorManager.updatePreview(); });
document.getElementById('redo-btn')?.addEventListener('click', () => { document.execCommand('redo'); editorManager.updatePreview(); });

// Shortcuts Modal
const shortcutsModal = document.getElementById('shortcuts-modal');
const shortcutsBtn = document.getElementById('shortcuts-btn');
const shortcutsClose = document.getElementById('shortcuts-close');

if (shortcutsModal && shortcutsBtn && shortcutsClose) {
  shortcutsBtn.addEventListener('click', () => shortcutsModal.classList.add('show'));
  shortcutsClose.addEventListener('click', () => shortcutsModal.classList.remove('show'));
  shortcutsModal.addEventListener('click', (e) => {
    if (e.target === shortcutsModal) shortcutsModal.classList.remove('show');
  });
}

// Auto-collapse sidebar on small windows
let wasManuallyCollapsed = false;
let lastWindowWidth = window.innerWidth;

function handleWindowResize() {
  const width = window.innerWidth;
  const sidebar = ui.elements.sidebar;
  const isCollapsed = sidebar.classList.contains('collapsed');

  if (width <= 400) {
    if (!isCollapsed) {
      sidebar.classList.add('collapsed');
      wasManuallyCollapsed = false;
    }
  } else if (width > 400 && lastWindowWidth <= 400 && isCollapsed && !wasManuallyCollapsed) {
    sidebar.classList.remove('collapsed');
  }

  lastWindowWidth = width;
}

document.getElementById('toggle-sidebar-btn')?.addEventListener('click', () => {
  setTimeout(() => {
    wasManuallyCollapsed = ui.elements.sidebar.classList.contains('collapsed');
  }, 0);
});

window.addEventListener('resize', handleWindowResize);
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
    }

    const dateStr = new Date(note.modified).toLocaleDateString();

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

    container.appendChild(item);
  });

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

  ui.elements.commandPaletteInput.value = '';
  ui.elements.commandPaletteInput.focus();

  setTimeout(() => {
    ui.elements.commandPaletteInput.focus();
  }, 50);

  allPaletteNotes = await noteManager.listAllNotes();
  filteredPaletteNotes = allPaletteNotes;
  commandPaletteSelectedIndex = 0;
  renderCommandPaletteResults(filteredPaletteNotes);
}

ui.elements.commandPaletteInput.addEventListener('input', (e) => {
  const query = (e.target as HTMLInputElement).value.toLowerCase();

  if (!query) {
    filteredPaletteNotes = allPaletteNotes;
  } else {
    filteredPaletteNotes = allPaletteNotes.filter(note =>
      note.title.toLowerCase().includes(query)
    );
  }

  commandPaletteSelectedIndex = 0;
  renderCommandPaletteResults(filteredPaletteNotes);
});

ui.elements.commandPaletteInput.addEventListener('keydown', (e) => {
  e.stopPropagation();

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
    const note = filteredPaletteNotes[commandPaletteSelectedIndex];
    if (note) {
      loadNote(note.id, note.folder);
      closeCommandPalette();
    }
  } else if (e.key === 'Escape') {
    e.preventDefault();
    closeCommandPalette();
  }
});

ui.elements.commandPaletteClose.addEventListener('click', closeCommandPalette);

// Sort Handler - Custom Dropdown
const sortTrigger = ui.elements.sortTrigger;
const sortMenu = ui.elements.sortMenu;

sortTrigger.addEventListener('click', (e) => {
  e.stopPropagation();
  sortMenu.classList.toggle('show');
});

document.addEventListener('click', (e) => {
  if (!sortMenu.contains(e.target as Node) && !sortTrigger.contains(e.target as Node)) {
    sortMenu.classList.remove('show');
  }
});

sortMenu.querySelectorAll('.dropdown-item').forEach(item => {
  item.addEventListener('click', () => {
    const order = (item as HTMLElement).dataset.value;
    if (order) {
      noteManager.setSortOrder(order as any);

      sortMenu.querySelectorAll('.dropdown-item').forEach(i => i.classList.remove('active'));
      item.classList.add('active');

      sortMenu.classList.remove('show');
      refreshNotes();
    }
  });
});

// ============ Register Keyboard Shortcuts ============

registerKeyboardShortcuts(shortcutManager, editorManager, tabManager, ui, {
  saveCurrentNote,
  createNewNote: () => document.getElementById('new-note-btn')?.click(),
  togglePreview: () => editorManager.togglePreview(),
  openCommandPalette,
  focusSidebar: () => {
    if (ui.elements.sidebar.classList.contains('collapsed')) {
      document.getElementById('toggle-sidebar-btn')?.click();
    }
    ui.elements.searchInput.focus();
  }
});

registerRecentNotesShortcut(shortcutManager, () => recentNotesStack, loadNote);

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

    const autoStartToggle = document.getElementById('auto-start-toggle') as HTMLInputElement;
    if (autoStartToggle) {
      const autoStart = await window.electron.getAutoStart();
      autoStartToggle.checked = autoStart;
    }
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

const autoStartToggle = document.getElementById('auto-start-toggle') as HTMLInputElement;
if (autoStartToggle) {
  autoStartToggle.addEventListener('change', async (e) => {
    const enabled = (e.target as HTMLInputElement).checked;
    const result = await window.electron.setAutoStart(enabled);
    if (result.success) {
      ui.showToast(enabled ? 'Auto-start enabled' : 'Auto-start disabled', 'success');
    } else {
      ui.showToast('Failed to update auto-start setting', 'error');
      autoStartToggle.checked = !enabled;
    }
  });
}

// Wire New Folder
document.getElementById('new-folder-btn')?.addEventListener('click', () => {
  modalManager.showCreateFolderModal(async (name) => {
    const result = await noteManager.createFolder(name);
    if (result.success) {
      ui.showToast('Folder created', 'success');
      refreshFolders();
    } else {
      ui.showToast(`Failed: ${result.error}`, 'error');
    }
  });
});

// Record Shortcut Logic
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
  else if (key.startsWith('Arrow')) key = key.replace('Arrow', '');

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

// ============ Initialization ============

async function init() {
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

  const key = await window.electron.getGlobalShortcut();
  const display = document.getElementById('shortcut-display');
  if (display) display.textContent = key;

  window.electron.onRefreshNotes((noteId) => {
    refreshNotes();
    if (noteId) {
      ui.showToast('New note created externally');
    }
  });

  window.electron.onOpenFile(async (filePath) => {
    const result = await window.electron.readExternalFile(filePath);
    if (result.success && result.content !== undefined) {
      const externalId = `external:${result.filePath || filePath}`;
      const title = result.fileName || 'External File';
      tabManager.openTab(externalId, '', title, result.content);
      ui.showToast(`Opened: ${result.fileName}`);
    } else {
      ui.showToast(`Failed to open file: ${result.error}`, 'error');
    }
  });

  const { noteId, folder } = await window.electron.getLastNote();
  if (noteId) {
    if (folder) {
      noteManager.setCurrentFolder(folder);
      await refreshFolders();
      await refreshNotes();
    }
    await loadNote(noteId, folder || '');
  } else {
    await refreshFolders();
    await refreshNotes();
  }
}

init();
