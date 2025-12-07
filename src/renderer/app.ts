// Type declarations for globals exposed by HTML scripts
interface NoteInfo {
  id: string;
  title: string;
  modified: Date;
  folder: string;
}

interface FolderInfo {
  name: string;
  path: string;
}

interface ApiResult {
  success: boolean;
  error?: string;
  content?: string;
  noteId?: string;
  folder?: string;
}

interface ElectronAPI {
  listFolders: () => Promise<FolderInfo[]>;
  createFolder: (name: string) => Promise<ApiResult>;
  moveNoteToFolder: (noteId: string, currentFolder: string, targetFolder: string) => Promise<ApiResult>;
  listNotes: (folder?: string) => Promise<NoteInfo[]>;
  readNote: (noteId: string, folder?: string) => Promise<ApiResult>;
  saveNote: (noteId: string, content: string, folder?: string) => Promise<ApiResult>;
  createNote: (folder?: string) => Promise<ApiResult>;
  deleteNote: (noteId: string, folder?: string) => Promise<ApiResult>;
  getNoteOrder: () => Promise<Record<string, string[]>>;
  saveNoteOrder: (order: Record<string, string[]>) => Promise<ApiResult>;
  minimizeWindow: () => void;
  maximizeWindow: () => void;
  closeWindow: () => void;
  setAlwaysOnTop: (flag: boolean) => Promise<ApiResult>;
  getGlobalShortcut: () => Promise<string>;
  setGlobalShortcut: (key: string) => Promise<ApiResult>;
}

interface MarkedStatic {
  parse: (markdown: string) => string;
}

interface HljsStatic {
  highlightElement: (element: HTMLElement) => void;
}

// Declare globals
declare const marked: MarkedStatic;
declare const hljs: HljsStatic | undefined;

// Access electron API from window (use 'api' to avoid conflict with global 'electron')
const api = (window as unknown as { electron: ElectronAPI }).electron;

// ============ State ============
let currentNoteId: string | null = null;
let currentFolder: string = '';
let activeNoteFolder: string = ''; // Tracks the folder of the currently open note
let isPreviewMode = false;
let autoSaveTimer: number | null = null;
let isSidebarCollapsed = false;
let isMinimalMode = false;
let isVimMode = false;
let noteOrder: Record<string, string[]> = {};
let draggedNoteId: string | null = null;
let draggedNoteFolder: string | null = null;

// ============ DOM Elements ============
const notesList = document.getElementById('notes-list') as HTMLDivElement;
const foldersList = document.getElementById('folders-list') as HTMLDivElement;
const editor = document.getElementById('editor') as HTMLTextAreaElement;
const preview = document.getElementById('preview') as HTMLDivElement;
const togglePreviewBtn = document.getElementById('toggle-preview') as HTMLButtonElement;
const modeLabel = document.getElementById('mode-label') as HTMLSpanElement;
const newNoteBtn = document.getElementById('new-note-btn') as HTMLButtonElement;
const deleteNoteBtn = document.getElementById('delete-note-btn') as HTMLButtonElement;
const sidebar = document.querySelector('.sidebar') as HTMLDivElement;
const appContainer = document.querySelector('.app') as HTMLDivElement;
const toggleSidebarBtn = document.getElementById('toggle-sidebar-btn') as HTMLButtonElement;
const minimalModeBtn = document.getElementById('minimal-mode-btn') as HTMLButtonElement;
const searchInput = document.getElementById('search-input') as HTMLInputElement;
const newFolderBtn = document.getElementById('new-folder-btn') as HTMLButtonElement;
const undoBtn = document.getElementById('undo-btn') as HTMLButtonElement;
const redoBtn = document.getElementById('redo-btn') as HTMLButtonElement;
const vimToggleBtn = document.getElementById('vim-toggle-btn') as HTMLButtonElement;
const shortcutsBtn = document.getElementById('shortcuts-btn') as HTMLButtonElement;
const shortcutsModal = document.getElementById('shortcuts-modal') as HTMLDivElement;
const shortcutsClose = document.getElementById('shortcuts-close') as HTMLButtonElement;
const toastContainer = document.getElementById('toast-container') as HTMLDivElement;
const createFolderModal = document.getElementById('create-folder-modal') as HTMLDivElement;
const createFolderInput = document.getElementById('create-folder-input') as HTMLInputElement;
const createFolderConfirm = document.getElementById('create-folder-confirm') as HTMLButtonElement;
const createFolderCancel = document.getElementById('create-folder-cancel') as HTMLButtonElement;
const createFolderClose = document.getElementById('create-folder-close') as HTMLButtonElement;

// ============ Toast Notifications ============
function showToast(message: string, type: 'success' | 'error' | 'info' = 'info'): void {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  toastContainer.appendChild(toast);
  
  // Trigger animation
  requestAnimationFrame(() => {
    toast.classList.add('show');
  });
  
  // Remove after 3 seconds
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ============ Window Controls ============
document.getElementById('minimize-btn')?.addEventListener('click', () => {
  api.minimizeWindow();
});

document.getElementById('maximize-btn')?.addEventListener('click', () => {
  api.maximizeWindow();
});

document.getElementById('close-btn')?.addEventListener('click', () => {
  api.closeWindow();
});

toggleSidebarBtn?.addEventListener('click', () => {
  isSidebarCollapsed = !isSidebarCollapsed;
  sidebar.classList.toggle('collapsed', isSidebarCollapsed);
});

minimalModeBtn?.addEventListener('click', async () => {
  isMinimalMode = !isMinimalMode;
  
  if (isMinimalMode) {
    appContainer.classList.add('minimal-mode');
    minimalModeBtn.classList.add('active');
    await api.setAlwaysOnTop(true);
  } else {
    appContainer.classList.remove('minimal-mode');
    minimalModeBtn.classList.remove('active');
    await api.setAlwaysOnTop(false);
  }
});

// ============ Folder Management ============
async function loadFolders(): Promise<void> {
  const folders = await api.listFolders();
  foldersList.innerHTML = '';
  
  folders.forEach((folder: FolderInfo) => {
    const folderItem = document.createElement('div');
    folderItem.className = 'folder-item';
    folderItem.dataset.folderPath = folder.path;
    if (folder.path === currentFolder) {
      folderItem.classList.add('active');
    }
    
    const icon = folder.path === '' 
      ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path></svg>'
      : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>';
    
    folderItem.innerHTML = `${icon}<span>${folder.name}</span>`;
    folderItem.addEventListener('click', () => selectFolder(folder.path));
    
    // Drop zone for notes
    folderItem.addEventListener('dragover', (e) => {
      e.preventDefault();
      folderItem.classList.add('drag-over');
    });
    
    folderItem.addEventListener('dragleave', () => {
      folderItem.classList.remove('drag-over');
    });
    
    folderItem.addEventListener('drop', async (e) => {
      e.preventDefault();
      folderItem.classList.remove('drag-over');
      if (draggedNoteId && draggedNoteFolder !== null) {
        const result = await api.moveNoteToFolder(draggedNoteId, draggedNoteFolder, folder.path);
        if (result.success) {
          showToast(`Moved to ${folder.name}`, 'success');
          await loadNotes();
        } else {
          showToast(`Failed to move: ${result.error}`, 'error');
        }
      }
    });
    
    foldersList.appendChild(folderItem);
  });
}

async function selectFolder(folderPath: string): Promise<void> {
  currentFolder = folderPath;
  document.querySelectorAll('.folder-item').forEach(item => {
    item.classList.toggle('active', (item as HTMLElement).dataset.folderPath === folderPath);
  });
  await loadNotes();
}

newFolderBtn?.addEventListener('click', () => {
  createFolderInput.value = '';
  createFolderModal.classList.add('show');
  createFolderInput.focus();
});

function closeCreateFolderModal() {
  createFolderModal.classList.remove('show');
}

createFolderClose?.addEventListener('click', closeCreateFolderModal);
createFolderCancel?.addEventListener('click', closeCreateFolderModal);

createFolderModal?.addEventListener('click', (e) => {
  if (e.target === createFolderModal) {
    closeCreateFolderModal();
  }
});

async function createFolder() {
  const name = createFolderInput.value.trim();
  if (name) {
    const result = await api.createFolder(name);
    if (result.success) {
      showToast('Folder created', 'success');
      await loadFolders();
      closeCreateFolderModal();
    } else {
      showToast(`Failed to create folder: ${result.error}`, 'error');
    }
  }
}

createFolderConfirm?.addEventListener('click', createFolder);

createFolderInput?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    createFolder();
  }
  if (e.key === 'Escape') {
    closeCreateFolderModal();
  }
});

// ============ Note Management ============
async function loadNotes(): Promise<void> {
  const targetFolder = currentFolder;
  const notes = await api.listNotes(targetFolder || undefined);
  
  // Prevent race condition: if folder changed while loading, discard results
  if (currentFolder !== targetFolder) {
    return;
  }

  noteOrder = await api.getNoteOrder();
  
  notesList.innerHTML = '';
  
  if (notes.length === 0) {
    notesList.innerHTML = '<div class="empty-state">No notes yet</div>';
    return;
  }
  
  // Sort by custom order if available
  const orderKey = currentFolder || '_root';
  const orderedIds = noteOrder[orderKey] || [];
  const sortedNotes = [...notes].sort((a, b) => {
    const aIndex = orderedIds.indexOf(a.id);
    const bIndex = orderedIds.indexOf(b.id);
    if (aIndex === -1 && bIndex === -1) {
      return new Date(b.modified).getTime() - new Date(a.modified).getTime();
    }
    if (aIndex === -1) return 1;
    if (bIndex === -1) return -1;
    return aIndex - bIndex;
  });
  
  sortedNotes.forEach((note: NoteInfo) => {
    const noteItem = document.createElement('div');
    noteItem.className = 'note-item';
    noteItem.dataset.noteId = note.id;
    noteItem.dataset.folder = note.folder;
    noteItem.draggable = true;
    
    const date = new Date(note.modified);
    const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    
    noteItem.innerHTML = `
      <div class="note-drag-handle">⋮⋮</div>
      <div class="note-content">
        <h3>${escapeHtml(note.title)}</h3>
        <div class="note-meta">
          <span class="note-date">${dateStr}</span>
          ${note.folder ? `<span class="note-folder">${note.folder}</span>` : ''}
        </div>
      </div>
    `;
    
    noteItem.addEventListener('click', () => loadNote(note.id, note.folder));
    
    // Drag and drop
    noteItem.addEventListener('dragstart', (e) => {
      draggedNoteId = note.id;
      draggedNoteFolder = note.folder;
      noteItem.classList.add('dragging');
      e.dataTransfer?.setData('text/plain', note.id);
    });
    
    noteItem.addEventListener('dragend', () => {
      draggedNoteId = null;
      draggedNoteFolder = null;
      noteItem.classList.remove('dragging');
      document.querySelectorAll('.note-item').forEach(item => {
        item.classList.remove('drag-over');
      });
    });
    
    noteItem.addEventListener('dragover', (e) => {
      e.preventDefault();
      const draggingItem = document.querySelector('.dragging');
      if (draggingItem && draggingItem !== noteItem) {
        noteItem.classList.add('drag-over');
      }
    });
    
    noteItem.addEventListener('dragleave', () => {
      noteItem.classList.remove('drag-over');
    });
    
    noteItem.addEventListener('drop', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      noteItem.classList.remove('drag-over');
      
      if (draggedNoteId && draggedNoteId !== note.id && draggedNoteFolder === note.folder) {
        // Reorder within same folder
        const orderKey = note.folder || '_root';
        const currentOrder = noteOrder[orderKey] || sortedNotes.map(n => n.id);
        const fromIndex = currentOrder.indexOf(draggedNoteId);
        const toIndex = currentOrder.indexOf(note.id);
        
        if (fromIndex !== -1) {
          currentOrder.splice(fromIndex, 1);
          currentOrder.splice(toIndex, 0, draggedNoteId);
          noteOrder[orderKey] = currentOrder;
          await api.saveNoteOrder(noteOrder);
          await loadNotes();
        }
      }
    });
    
    notesList.appendChild(noteItem);
  });
  
  // Highlight current note
  if (currentNoteId) {
    document.querySelectorAll('.note-item').forEach(item => {
      const itemNoteId = (item as HTMLElement).dataset.noteId;
      const itemFolder = (item as HTMLElement).dataset.folder || '';
      const isActive = itemNoteId === currentNoteId && itemFolder === activeNoteFolder;
      item.classList.toggle('active', isActive);
    });
  } else if (sortedNotes.length > 0) {
    loadNote(sortedNotes[0].id, sortedNotes[0].folder);
  }
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

async function loadNote(noteId: string, folder: string): Promise<void> {
  if (currentNoteId) {
    await saveCurrentNote();
  }
  
  currentNoteId = noteId;
  activeNoteFolder = folder;
  
  const result = await api.readNote(noteId, folder || undefined);
  if (result.success && result.content !== undefined) {
    editor.value = result.content;
    updatePreview();
  } else {
    showToast(`Failed to load note: ${result.error}`, 'error');
  }
  
  document.querySelectorAll('.note-item').forEach(item => {
    const itemNoteId = (item as HTMLElement).dataset.noteId;
    const itemFolder = (item as HTMLElement).dataset.folder || '';
    const isActive = itemNoteId === noteId && itemFolder === folder;
    item.classList.toggle('active', isActive);
  });
}

async function saveCurrentNote(): Promise<void> {
  if (currentNoteId && editor.value) {
    const result = await api.saveNote(currentNoteId, editor.value, activeNoteFolder || undefined);
    if (!result.success) {
      showToast(`Failed to save: ${result.error}`, 'error');
    }
  }
}

function updatePreview(): void {
  const markdown = editor.value;
  const html = marked.parse(markdown);
  preview.innerHTML = html;
  
  // Apply syntax highlighting to code blocks
  preview.querySelectorAll('pre code').forEach((block) => {
    if (typeof hljs !== 'undefined') {
      hljs.highlightElement(block as HTMLElement);
    }
  });
}

function togglePreview(): void {
  isPreviewMode = !isPreviewMode;
  
  if (isPreviewMode) {
    editor.classList.add('preview-mode');
    preview.classList.add('preview-mode');
    modeLabel.textContent = 'Edit';
  } else {
    editor.classList.remove('preview-mode');
    preview.classList.remove('preview-mode');
    modeLabel.textContent = 'Preview';
  }
}

// ============ Markdown Toolbar ============
function insertMarkdown(before: string, after: string = ''): void {
  const start = editor.selectionStart;
  const end = editor.selectionEnd;
  const selectedText = editor.value.substring(start, end);
  const newText = before + selectedText + after;
  
  editor.value = editor.value.substring(0, start) + newText + editor.value.substring(end);
  editor.focus();
  editor.selectionStart = start + before.length;
  editor.selectionEnd = start + before.length + selectedText.length;
  
  updatePreview();
}

function insertLineMarkdown(prefix: string): void {
  const start = editor.selectionStart;
  const lineStart = editor.value.lastIndexOf('\n', start - 1) + 1;
  const lineEnd = editor.value.indexOf('\n', start);
  const end = lineEnd === -1 ? editor.value.length : lineEnd;
  
  const line = editor.value.substring(lineStart, end);
  const newLine = line.startsWith(prefix) ? line.substring(prefix.length) : prefix + line;
  
  editor.value = editor.value.substring(0, lineStart) + newLine + editor.value.substring(end);
  editor.focus();
  
  updatePreview();
}

document.querySelectorAll('.toolbar-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const action = (btn as HTMLElement).dataset.action;
    
    switch(action) {
      case 'bold':
        insertMarkdown('**', '**');
        break;
      case 'italic':
        insertMarkdown('*', '*');
        break;
      case 'heading':
        insertLineMarkdown('## ');
        break;
      case 'link':
        insertMarkdown('[', '](url)');
        break;
      case 'code':
        insertMarkdown('`', '`');
        break;
      case 'ul':
        insertLineMarkdown('- ');
        break;
      case 'ol':
        insertLineMarkdown('1. ');
        break;
      case 'todo':
        insertLineMarkdown('- [ ] ');
        break;
    }
  });
});

// ============ Undo/Redo ============
undoBtn?.addEventListener('click', () => {
  document.execCommand('undo');
  updatePreview();
});

redoBtn?.addEventListener('click', () => {
  document.execCommand('redo');
  updatePreview();
});

// ============ Vim Mode ============
vimToggleBtn?.addEventListener('click', () => {
  isVimMode = !isVimMode;
  vimToggleBtn.classList.toggle('active', isVimMode);
  editor.dataset.vimMode = isVimMode ? 'true' : 'false';
  
  if (isVimMode) {
    showToast('Vim mode enabled (hjkl navigation in command mode)', 'info');
  } else {
    showToast('Vim mode disabled', 'info');
  }
});

// Simple vim-like keybindings (lightweight implementation)
let vimCommandMode = false;

editor.addEventListener('keydown', (e: KeyboardEvent) => {
  if (!isVimMode) return;
  
  // Escape to enter command mode
  if (e.key === 'Escape') {
    vimCommandMode = true;
    editor.classList.add('vim-command-mode');
    e.preventDefault();
    return;
  }
  
  // i to enter insert mode
  if (vimCommandMode && e.key === 'i') {
    vimCommandMode = false;
    editor.classList.remove('vim-command-mode');
    e.preventDefault();
    return;
  }
  
  if (!vimCommandMode) return;
  
  // Navigation in command mode
  const pos = editor.selectionStart;
  const lines = editor.value.split('\n');
  let currentLine = 0;
  let charCount = 0;
  
  for (let i = 0; i < lines.length; i++) {
    if (charCount + lines[i].length >= pos) {
      currentLine = i;
      break;
    }
    charCount += lines[i].length + 1;
  }
  
  switch (e.key) {
    case 'h': // left
      if (pos > 0) editor.selectionStart = editor.selectionEnd = pos - 1;
      e.preventDefault();
      break;
    case 'l': // right
      if (pos < editor.value.length) editor.selectionStart = editor.selectionEnd = pos + 1;
      e.preventDefault();
      break;
    case 'j': // down
      if (currentLine < lines.length - 1) {
        const colPos = pos - charCount;
        const nextLineStart = charCount + lines[currentLine].length + 1;
        const nextLineEnd = nextLineStart + lines[currentLine + 1].length;
        const newPos = Math.min(nextLineStart + colPos, nextLineEnd);
        editor.selectionStart = editor.selectionEnd = newPos;
      }
      e.preventDefault();
      break;
    case 'k': // up
      if (currentLine > 0) {
        let prevLineStart = 0;
        for (let i = 0; i < currentLine - 1; i++) {
          prevLineStart += lines[i].length + 1;
        }
        const colPos = pos - charCount;
        const newPos = Math.min(prevLineStart + colPos, prevLineStart + lines[currentLine - 1].length);
        editor.selectionStart = editor.selectionEnd = newPos;
      }
      e.preventDefault();
      break;
    case 'w': // word forward
      const wordMatch = editor.value.slice(pos).match(/\W?\w+/);
      if (wordMatch) {
        editor.selectionStart = editor.selectionEnd = pos + wordMatch[0].length;
      }
      e.preventDefault();
      break;
    case 'b': // word backward
      const beforeCursor = editor.value.slice(0, pos);
      const wordBackMatch = beforeCursor.match(/\w+\W?$/);
      if (wordBackMatch) {
        editor.selectionStart = editor.selectionEnd = pos - wordBackMatch[0].length;
      }
      e.preventDefault();
      break;
    case '0': // line start
      editor.selectionStart = editor.selectionEnd = charCount;
      e.preventDefault();
      break;
    case '$': // line end
      editor.selectionStart = editor.selectionEnd = charCount + lines[currentLine].length;
      e.preventDefault();
      break;
    case 'g': // gg - go to top
      editor.selectionStart = editor.selectionEnd = 0;
      e.preventDefault();
      break;
    case 'G': // G - go to bottom
      editor.selectionStart = editor.selectionEnd = editor.value.length;
      e.preventDefault();
      break;
    case 'd': // dd - delete line (simplified)
      if (currentLine < lines.length) {
        const lineStart = charCount;
        const lineEnd = charCount + lines[currentLine].length + 1;
        editor.value = editor.value.substring(0, lineStart) + editor.value.substring(lineEnd);
        editor.selectionStart = editor.selectionEnd = lineStart;
        updatePreview();
      }
      e.preventDefault();
      break;
    case 'x': // delete character
      if (pos < editor.value.length) {
        editor.value = editor.value.substring(0, pos) + editor.value.substring(pos + 1);
        updatePreview();
      }
      e.preventDefault();
      break;
    case 'a': // append (enter insert mode after cursor)
      vimCommandMode = false;
      editor.classList.remove('vim-command-mode');
      if (pos < editor.value.length) {
        editor.selectionStart = editor.selectionEnd = pos + 1;
      }
      e.preventDefault();
      break;
    case 'o': // open line below
      vimCommandMode = false;
      editor.classList.remove('vim-command-mode');
      const lineEnd2 = charCount + lines[currentLine].length;
      editor.value = editor.value.substring(0, lineEnd2) + '\n' + editor.value.substring(lineEnd2);
      editor.selectionStart = editor.selectionEnd = lineEnd2 + 1;
      updatePreview();
      e.preventDefault();
      break;
    case 'O': // open line above
      vimCommandMode = false;
      editor.classList.remove('vim-command-mode');
      editor.value = editor.value.substring(0, charCount) + '\n' + editor.value.substring(charCount);
      editor.selectionStart = editor.selectionEnd = charCount;
      updatePreview();
      e.preventDefault();
      break;
    default:
      // Block other keys in command mode
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
      }
  }
});

// ============ Keyboard Shortcuts ============
shortcutsBtn?.addEventListener('click', () => {
  shortcutsModal.classList.add('show');
});

shortcutsClose?.addEventListener('click', () => {
  shortcutsModal.classList.remove('show');
});

shortcutsModal?.addEventListener('click', (e) => {
  if (e.target === shortcutsModal) {
    shortcutsModal.classList.remove('show');
  }
});

// Global keyboard shortcuts
document.addEventListener('keydown', (e: KeyboardEvent) => {
  // Ctrl+/ or Ctrl+? to show shortcuts
  if ((e.ctrlKey || e.metaKey) && (e.key === '/' || e.key === '?')) {
    e.preventDefault();
    shortcutsModal.classList.toggle('show');
  }
  
  // Escape to close modals
  if (e.key === 'Escape' && shortcutsModal.classList.contains('show')) {
    shortcutsModal.classList.remove('show');
  }
  
  // Ctrl+S to save
  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    e.preventDefault();
    saveCurrentNote().then(() => showToast('Saved', 'success'));
  }
  
  // Ctrl+N for new note
  if ((e.ctrlKey || e.metaKey) && e.key === 'n' && !e.shiftKey) {
    e.preventDefault();
    newNoteBtn.click();
  }
  
  // Ctrl+B for bold
  if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
    e.preventDefault();
    insertMarkdown('**', '**');
  }
  
  // Ctrl+I for italic
  if ((e.ctrlKey || e.metaKey) && e.key === 'i') {
    e.preventDefault();
    insertMarkdown('*', '*');
  }
  
  // Ctrl+K for link
  if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
    e.preventDefault();
    insertMarkdown('[', '](url)');
  }
  
  // Ctrl+E to toggle preview
  if ((e.ctrlKey || e.metaKey) && e.key === 'e') {
    e.preventDefault();
    togglePreview();
  }
});

// ============ Search ============
searchInput?.addEventListener('input', () => {
  const query = searchInput.value.toLowerCase().trim();
  const noteItems = notesList.querySelectorAll('.note-item');
  
  noteItems.forEach(item => {
    const title = item.querySelector('h3')?.textContent?.toLowerCase() || '';
    const matches = query === '' || title.includes(query);
    (item as HTMLElement).style.display = matches ? '' : 'none';
  });
});

// ============ Editor Events ============
editor.addEventListener('input', () => {
  updatePreview();
  
  if (autoSaveTimer) {
    clearTimeout(autoSaveTimer);
  }
  autoSaveTimer = window.setTimeout(() => {
    saveCurrentNote();
  }, 1000);
});

togglePreviewBtn?.addEventListener('click', togglePreview);

newNoteBtn?.addEventListener('click', async () => {
  const result = await api.createNote(currentFolder || undefined);
  if (result.success && result.noteId) {
    showToast('Note created', 'success');
    await loadNotes();
    loadNote(result.noteId, result.folder || '');
  } else {
    showToast(`Failed to create note: ${result.error}`, 'error');
  }
});



deleteNoteBtn?.addEventListener('click', async () => {
  if (!currentNoteId) return;
  
  const confirmed = confirm('Are you sure you want to delete this note?');
  if (confirmed) {
    const result = await api.deleteNote(currentNoteId, activeNoteFolder || undefined);
    if (result.success) {
      showToast('Note deleted', 'success');
      currentNoteId = null;
      editor.value = '';
      preview.innerHTML = '';
      await loadNotes();
    } else {
      showToast(`Failed to delete: ${result.error}`, 'error');
    }
  }
});

// ============ Lifecycle ============
window.addEventListener('beforeunload', async () => {
  if (currentNoteId) {
    await saveCurrentNote();
  }
});

// ============ Shortcut Recording ============
const shortcutDisplay = document.getElementById('shortcut-display') as HTMLDivElement;
const recordShortcutBtn = document.getElementById('record-shortcut-btn') as HTMLButtonElement;
let isRecordingShortcut = false;

async function loadGlobalShortcut() {
  if (shortcutDisplay) {
    const key = await api.getGlobalShortcut();
    shortcutDisplay.textContent = key;
  }
}

if (recordShortcutBtn) {
  recordShortcutBtn.addEventListener('click', () => {
    isRecordingShortcut = true;
    recordShortcutBtn.textContent = 'Press Key...';
    recordShortcutBtn.classList.add('active');
    shortcutDisplay.classList.add('recording');
  });
}

document.addEventListener('keydown', async (e) => {
  if (!isRecordingShortcut) return;
  
  e.preventDefault();
  e.stopPropagation();
  
  // Ignore modifier-only presses
  if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return;
  
  const parts = [];
  if (e.metaKey) parts.push('CommandOrControl'); // Electron uses CommandOrControl for cross-platform
  else if (e.ctrlKey) parts.push('CommandOrControl');
  
  if (e.altKey) parts.push('Alt');
  if (e.shiftKey) parts.push('Shift');
  
  // Map special keys
  let key = e.key;
  if (key === ' ') key = 'Space';
  else if (key.length === 1) key = key.toUpperCase();
  else if (key === 'ArrowUp') key = 'Up';
  else if (key === 'ArrowDown') key = 'Down';
  else if (key === 'ArrowLeft') key = 'Left';
  else if (key === 'ArrowRight') key = 'Right';
  
  parts.push(key);
  
  const accelerator = parts.join('+');
  
  // Attempt to save
  const result = await api.setGlobalShortcut(accelerator);
  
  if (result.success) {
    shortcutDisplay.textContent = accelerator;
    showToast(`Global shortcut set to ${accelerator}`, 'success');
  } else {
    showToast(`Failed to set shortcut: ${result.error}`, 'error');
    // Reload old one
    loadGlobalShortcut();
  }
  
  // Reset state
  isRecordingShortcut = false;
  recordShortcutBtn.textContent = 'Record';
  recordShortcutBtn.classList.remove('active');
  shortcutDisplay.classList.remove('recording');
});

// Update init to load shortcut
async function init(): Promise<void> {
  await loadFolders();
  await loadNotes();
  await loadGlobalShortcut();
}

init();
