export class UIManager {
  // DOM Elements
  public elements = {
    notesList: document.getElementById('notes-list') as HTMLDivElement,
    foldersList: document.getElementById('folders-list') as HTMLDivElement,
    editor: document.getElementById('editor') as HTMLTextAreaElement,
    preview: document.getElementById('preview') as HTMLDivElement,
    searchInput: document.getElementById('search-input') as HTMLInputElement,
    sortTrigger: document.getElementById('sort-trigger-btn') as HTMLButtonElement,
    sortMenu: document.getElementById('sort-menu') as HTMLDivElement,
    saveIndicator: document.getElementById('save-indicator') as HTMLSpanElement,
    modeLabel: document.getElementById('mode-label') as HTMLSpanElement,
    toastContainer: document.getElementById('toast-container') as HTMLDivElement,
    sidebar: document.querySelector('.sidebar') as HTMLDivElement,
    appContainer: document.querySelector('.app') as HTMLDivElement,
    minimalModeBtn: document.getElementById('minimal-mode-btn') as HTMLButtonElement,
    
    // Modals
    createFolderModal: document.getElementById('create-folder-modal') as HTMLDivElement,
    createFolderInput: document.getElementById('create-folder-input') as HTMLInputElement,
    createFolderConfirm: document.getElementById('create-folder-confirm') as HTMLButtonElement,
    createFolderCancel: document.getElementById('create-folder-cancel') as HTMLButtonElement,
    createFolderClose: document.getElementById('create-folder-close') as HTMLButtonElement,

    renameModal: document.getElementById('rename-modal') as HTMLDivElement,
    renameInput: document.getElementById('rename-input') as HTMLInputElement,
    renameTitle: document.getElementById('rename-modal-title') as HTMLHeadingElement,
    renameConfirm: document.getElementById('rename-confirm') as HTMLButtonElement,
    renameCancel: document.getElementById('rename-cancel') as HTMLButtonElement,
    renameClose: document.getElementById('rename-close') as HTMLButtonElement,

    confirmModal: document.getElementById('confirm-modal') as HTMLDivElement,
    confirmMessage: document.getElementById('confirm-modal-message') as HTMLParagraphElement,
    confirmOk: document.getElementById('confirm-ok') as HTMLButtonElement,
    confirmCancel: document.getElementById('confirm-cancel') as HTMLButtonElement,
    confirmClose: document.getElementById('confirm-close') as HTMLButtonElement,

    // Command Palette
    commandPaletteModal: document.getElementById('command-palette-modal') as HTMLDivElement,
    commandPaletteInput: document.getElementById('command-palette-input') as HTMLInputElement,
    commandPaletteResults: document.getElementById('command-palette-results') as HTMLDivElement,
    commandPaletteClose: document.getElementById('command-palette-close') as HTMLButtonElement,

    // Display Settings
    displaySettingsModal: document.getElementById('display-settings-modal') as HTMLDivElement,
    opacitySlider: document.getElementById('opacity-slider') as HTMLInputElement,
    opacityValue: document.getElementById('opacity-value') as HTMLSpanElement,
  };

  private isMinimalMode = false;
  private minimalBoundsSaveTimer: number | null = null;

  constructor() {}

  showToast(message: string, type: 'success' | 'error' | 'info' = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    this.elements.toastContainer.appendChild(toast);
    
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        toast.classList.add('show');
      });
    });
    
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  toggleSidebar() {
    this.elements.sidebar.classList.toggle('collapsed');
  }

  async toggleMinimalMode(isActive: boolean) {
    this.isMinimalMode = isActive;
    
    if (isActive) {
      await window.electron.enterMinimalMode();
      this.elements.appContainer.classList.add('minimal-mode');
      this.elements.minimalModeBtn.classList.add('active');
      await window.electron.setAlwaysOnTop(true);
      
      this.setupMinimalModeResizeListener();
    } else {
      // Save bounds before exiting
      await window.electron.saveMinimalBounds();
      await window.electron.exitMinimalMode();
      this.elements.appContainer.classList.remove('minimal-mode');
      this.elements.minimalModeBtn.classList.remove('active');
      await window.electron.setAlwaysOnTop(false);
      
      this.removeMinimalModeResizeListener();
    }
  }

  private resizeHandler = () => {
    if (!this.isMinimalMode) return;
    
    if (this.minimalBoundsSaveTimer) {
      clearTimeout(this.minimalBoundsSaveTimer);
    }
    
    this.minimalBoundsSaveTimer = window.setTimeout(() => {
      window.electron.saveMinimalBounds();
    }, 500);
  };

  private setupMinimalModeResizeListener() {
    window.addEventListener('resize', this.resizeHandler);
  }

  private removeMinimalModeResizeListener() {
    window.removeEventListener('resize', this.resizeHandler);
    if (this.minimalBoundsSaveTimer) {
      clearTimeout(this.minimalBoundsSaveTimer);
      this.minimalBoundsSaveTimer = null;
    }
  }

  isInMinimalMode(): boolean {
    return this.isMinimalMode;
  }

  updateSaveIndicator(status: 'saving' | 'saved' | 'error', errorMsg?: string) {
    if (status === 'saving') {
      this.elements.saveIndicator.textContent = 'Saving...';
      this.elements.saveIndicator.style.opacity = '1';
      this.elements.saveIndicator.style.color = 'var(--text-quaternary)';
    } else if (status === 'saved') {
      this.elements.saveIndicator.textContent = 'Saved';
      this.elements.saveIndicator.style.color = 'var(--text-quaternary)';
      setTimeout(() => {
          this.elements.saveIndicator.style.opacity = '0';
      }, 2000);
    } else if (status === 'error') {
      this.elements.saveIndicator.textContent = 'Error';
      this.elements.saveIndicator.style.color = '#f87171';
      if (errorMsg) this.showToast(errorMsg, 'error');
    }
  }

  escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Modal helpers could go here, or remain in app.ts or a ModalManager
  // For now, let's keep specific modal logic in app.ts to avoid too much boilerplate moving
  // but generic closeAllModals is useful
  closeAllModals() {
    document.querySelectorAll('.modal-overlay').forEach(modal => {
      modal.classList.remove('show');
    });
  }

  renderFolders(folders: import('../types').FolderInfo[], currentFolder: string, callbacks: {
    onSelect: (path: string) => void,
    onRename: (name: string) => void,
    onDelete: (name: string) => void,
    onDrop: (sourceId: string, sourceFolder: string, targetFolder: string) => void
  }) {
    this.elements.foldersList.innerHTML = '';
    
    folders.forEach(folder => {
      const folderItem = document.createElement('div');
      folderItem.className = 'folder-item';
      folderItem.dataset.folderPath = folder.path;
      if (folder.path === currentFolder) {
        folderItem.classList.add('active');
      }
      
      const icon = folder.path === '' 
        ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path></svg>'
        : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>';
      
      const content = document.createElement('div');
      content.className = 'folder-content';
      content.style.display = 'flex';
      content.style.alignItems = 'center';
      content.style.gap = '8px';
      content.style.flex = '1';
      content.innerHTML = `${icon}<span>${this.escapeHtml(folder.name)}</span>`;
      
      folderItem.appendChild(content);
      
      if (folder.path !== '') {
        const actions = document.createElement('div');
        actions.className = 'folder-actions';
        actions.style.display = 'flex';
        actions.style.gap = '4px';
        
        const renameBtn = document.createElement('button');
        renameBtn.className = 'btn-icon-sm';
        renameBtn.innerHTML = '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>';
        renameBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          callbacks.onRename(folder.name);
        });
        
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'btn-icon-sm';
        deleteBtn.innerHTML = '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>';
        deleteBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          callbacks.onDelete(folder.name);
        });
        
        actions.appendChild(renameBtn);
        actions.appendChild(deleteBtn);
        folderItem.appendChild(actions);
      }
      
      folderItem.addEventListener('click', (e) => {
         if (!(e.target as HTMLElement).closest('.folder-actions')) {
           callbacks.onSelect(folder.path);
         }
      });
      
      // Drop zone
      folderItem.addEventListener('dragover', (e) => { e.preventDefault(); folderItem.classList.add('drag-over'); });
      folderItem.addEventListener('dragleave', () => { folderItem.classList.remove('drag-over'); });
      folderItem.addEventListener('drop', (e) => {
        e.preventDefault();
        folderItem.classList.remove('drag-over');
        const noteId = e.dataTransfer?.getData('text/plain');
        const sourceFolder = e.dataTransfer?.getData('application/x-mded-folder'); // We need to set this in dragstart
        if (noteId && sourceFolder !== undefined) { 
           // We need to pass source folder from somewhere.
           // Simplified: The callback should handle the lookup or we rely on app state logic.
           // Allow callback to handle it.
           callbacks.onDrop(noteId, sourceFolder, folder.path);
        }
      });

      this.elements.foldersList.appendChild(folderItem);
    });
  }

  renderNotes(notes: import('../types').NoteInfo[], state: { id: string|null, folder: string, searchQuery: string }, callbacks: {
      onSelect: (id: string, folder: string) => void,
      onRename: (id: string, folder: string) => void,
      onDelete: (id: string, folder: string) => void,
      onDragStart: (id: string, folder: string) => void,
      onDrop: (targetId: string, targetFolder: string) => void,
      onPin: (id: string, folder: string) => void
  }) {
    this.elements.notesList.innerHTML = '';

    if (notes.length === 0) {
      this.elements.notesList.innerHTML = `<div class="empty-state">${state.searchQuery ? 'No matching notes' : 'No notes yet'}</div>`;
      return;
    }

    notes.forEach(note => {
      const noteItem = document.createElement('div');
      noteItem.className = 'note-item';
      if (note.pinned) noteItem.classList.add('pinned');
      noteItem.dataset.noteId = note.id;
      noteItem.dataset.folder = note.folder;
      noteItem.draggable = true;
      
      if (note.id === state.id && note.folder === state.folder) {
        noteItem.classList.add('active');
      }

      const dateStr = new Date(note.modified).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      
      // Content
      const content = document.createElement('div');
      content.className = 'note-content';
      
      // highlighting logic (if supported)
      let titleHtml = this.escapeHtml(note.title);
      if (state.searchQuery) {
          const re = new RegExp(`(${state.searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
          titleHtml = titleHtml.replace(re, '<span class="search-highlight">$1</span>');
      }
      
      // Pin Icon if pinned
      const pinIcon = note.pinned ? `<span class="pin-indicator"><svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M16 4v12l-4 4-4-4V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2z"></path></svg></span>` : '';

      content.innerHTML = `
          <h3>${titleHtml} ${pinIcon}</h3>
          <div class="note-meta">
            <span class="note-date">${dateStr}</span>
            ${note.folder ? `<span class="note-folder">${note.folder}</span>` : ''}
          </div>
      `;

      // Actions
      const actions = document.createElement('div');
      actions.className = 'note-actions';
      actions.style.display = 'flex';
      actions.style.gap = '2px';
      actions.style.marginLeft = 'auto';
      actions.style.opacity = '0.5';

      // Pin Button
      const pinBtn = document.createElement('button');
      pinBtn.className = 'btn-icon-sm' + (note.pinned ? ' active' : '');
      pinBtn.title = note.pinned ? 'Unpin' : 'Pin';
      pinBtn.innerHTML = '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 4v12l-4 4-4-4V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2z"></path></svg>';
      pinBtn.addEventListener('click', (e) => { e.stopPropagation(); callbacks.onPin(note.id, note.folder); });
      
      const renameBtn = document.createElement('button');
      renameBtn.className = 'btn-icon-sm';
      renameBtn.innerHTML = '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>';
      renameBtn.addEventListener('click', (e) => { e.stopPropagation(); callbacks.onRename(note.id, note.folder); });

      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'btn-icon-sm';
      deleteBtn.innerHTML = '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>';
      deleteBtn.addEventListener('click', (e) => { e.stopPropagation(); callbacks.onDelete(note.id, note.folder); });

      actions.appendChild(pinBtn);
      actions.appendChild(renameBtn);
      actions.appendChild(deleteBtn);

      noteItem.innerHTML = `<div class="note-drag-handle">⋮⋮</div>`;
      noteItem.appendChild(content);
      noteItem.appendChild(actions);

      noteItem.addEventListener('click', (e) => {
          if (!(e.target as HTMLElement).closest('.note-actions')) {
              callbacks.onSelect(note.id, note.folder);
          }
      });

      // Drag events
      noteItem.addEventListener('dragstart', (e) => {
          noteItem.classList.add('dragging');
          e.dataTransfer?.setData('text/plain', note.id);
          e.dataTransfer?.setData('application/x-mded-folder', note.folder || '');
          callbacks.onDragStart(note.id, note.folder);
      });
      noteItem.addEventListener('dragend', () => {
          noteItem.classList.remove('dragging');
          document.querySelectorAll('.note-item').forEach(i => i.classList.remove('drag-over'));
      });
      noteItem.addEventListener('dragover', (e) => {
          e.preventDefault();
          noteItem.classList.add('drag-over');
      });
      noteItem.addEventListener('dragleave', () => {
          noteItem.classList.remove('drag-over');
      });
      noteItem.addEventListener('drop', (e) => {
          e.preventDefault();
          e.stopPropagation();
           // Drop on another note -> Reorder
           callbacks.onDrop(note.id, note.folder);
      });

      this.elements.notesList.appendChild(noteItem);
    });
  }
}