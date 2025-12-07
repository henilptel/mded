let currentNoteId = null;
let isPreviewMode = false;
let autoSaveTimer = null;
let isSidebarCollapsed = false;
let isMinimalMode = false;

const notesList = document.getElementById('notes-list');
const editor = document.getElementById('editor');
const preview = document.getElementById('preview');
const togglePreviewBtn = document.getElementById('toggle-preview');
const modeLabel = document.getElementById('mode-label');
const newNoteBtn = document.getElementById('new-note-btn');
const deleteNoteBtn = document.getElementById('delete-note-btn');
const sidebar = document.querySelector('.sidebar');
const appContainer = document.querySelector('.app');
const toggleSidebarBtn = document.getElementById('toggle-sidebar-btn');
const minimalModeBtn = document.getElementById('minimal-mode-btn');

document.getElementById('minimize-btn').addEventListener('click', () => {
  window.electron.minimizeWindow();
});

document.getElementById('maximize-btn').addEventListener('click', () => {
  window.electron.maximizeWindow();
});

document.getElementById('close-btn').addEventListener('click', () => {
  window.electron.closeWindow();
});

toggleSidebarBtn.addEventListener('click', () => {
  isSidebarCollapsed = !isSidebarCollapsed;
  sidebar.classList.toggle('collapsed', isSidebarCollapsed);
});

minimalModeBtn.addEventListener('click', async () => {
  isMinimalMode = !isMinimalMode;
  
  if (isMinimalMode) {
    appContainer.classList.add('minimal-mode');
    minimalModeBtn.classList.add('active');
    await window.electron.setAlwaysOnTop(true);
  } else {
    appContainer.classList.remove('minimal-mode');
    minimalModeBtn.classList.remove('active');
    await window.electron.setAlwaysOnTop(false);
  }
});

async function loadNotes() {
  const notes = await window.electron.listNotes();
  notesList.innerHTML = '';
  
  if (notes.length === 0) {
    notesList.innerHTML = '<div style="padding: 16px; text-align: center; color: rgba(255, 255, 255, 0.5); font-size: 13px;">No notes yet</div>';
    return;
  }
  
  notes.forEach(note => {
    const noteItem = document.createElement('div');
    noteItem.className = 'note-item';
    noteItem.dataset.noteId = note.id;
    
    const date = new Date(note.modified);
    const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    
    noteItem.innerHTML = `
      <h3>${note.title}</h3>
      <div class="note-date">${dateStr}</div>
    `;
    
    noteItem.addEventListener('click', () => loadNote(note.id));
    notesList.appendChild(noteItem);
  });
  
  if (!currentNoteId && notes.length > 0) {
    loadNote(notes[0].id);
  }
}

async function loadNote(noteId) {
  if (currentNoteId) {
    await saveCurrentNote();
  }
  
  currentNoteId = noteId;
  const content = await window.electron.readNote(noteId);
  editor.value = content;
  updatePreview();
  
  document.querySelectorAll('.note-item').forEach(item => {
    item.classList.toggle('active', item.dataset.noteId === noteId);
  });
}

async function saveCurrentNote() {
  if (currentNoteId && editor.value) {
    await window.electron.saveNote(currentNoteId, editor.value);
  }
}

function updatePreview() {
  const markdown = editor.value;
  preview.innerHTML = marked.parse(markdown);
}

function togglePreview() {
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

function insertMarkdown(before, after = '') {
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

function insertLineMarkdown(prefix) {
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
    const action = btn.dataset.action;
    
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
    }
  });
});

editor.addEventListener('input', () => {
  updatePreview();
  
  clearTimeout(autoSaveTimer);
  autoSaveTimer = setTimeout(() => {
    saveCurrentNote();
  }, 1000);
});

togglePreviewBtn.addEventListener('click', togglePreview);

newNoteBtn.addEventListener('click', async () => {
  const noteId = await window.electron.createNote();
  if (noteId) {
    await loadNotes();
    loadNote(noteId);
  }
});

deleteNoteBtn.addEventListener('click', async () => {
  if (!currentNoteId) return;
  
  const confirmed = confirm('Are you sure you want to delete this note?');
  if (confirmed) {
    await window.electron.deleteNote(currentNoteId);
    currentNoteId = null;
    editor.value = '';
    preview.innerHTML = '';
    await loadNotes();
  }
});

window.addEventListener('beforeunload', async (e) => {
  if (currentNoteId) {
    await saveCurrentNote();
  }
});

loadNotes();
