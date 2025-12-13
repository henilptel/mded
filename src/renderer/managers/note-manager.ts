import { 
  NoteInfo, 
  FolderInfo, 
  ApiResult, 
  NoteOperationResult, 
  PinResult, 
  NoteManagerState,
  SortOrder 
} from '../types';

export class NoteManager {
  private currentNoteId: string | null = null;
  private currentFolder: string = '';
  private activeNoteFolder: string = '';

  public sortOrder: SortOrder = 'modified-desc';

  constructor() {
    const saved = localStorage.getItem('mded-sort-order');
    if (saved && this.isValidSortOrder(saved)) {
      this.sortOrder = saved;
    }
  }

  private isValidSortOrder(value: string): value is SortOrder {
    return [
      'modified-desc', 'modified-asc', 
      'created-desc', 'created-asc', 
      'title-asc', 'title-desc'
    ].includes(value);
  }

  get currentState(): NoteManagerState {
    return {
      currentNoteId: this.currentNoteId,
      currentFolder: this.currentFolder,
      activeNoteFolder: this.activeNoteFolder
    };
  }

  setCurrentFolder(folder: string): void {
    this.currentFolder = folder;
  }

  setCurrentNote(id: string | null, folder: string = ''): void {
    this.currentNoteId = id;
    this.activeNoteFolder = folder;
    if (id) {
      window.electron.saveLastNote(id, folder);
    }
  }

  setSortOrder(order: SortOrder): void {
    this.sortOrder = order;
    localStorage.setItem('mded-sort-order', order);
  }

  async togglePin(noteId: string): Promise<PinResult> {
    return await window.electron.togglePinNote(noteId);
  }

  async loadFolders(): Promise<FolderInfo[]> {
    return await window.electron.listFolders();
  }

  async listNotes(searchQuery: string = ''): Promise<NoteInfo[]> {
    const isSearchMode = searchQuery.length > 0;
    const fetchFolder = isSearchMode ? undefined : (this.currentFolder || undefined);

    let notes = await window.electron.listNotes(fetchFolder);

    if (isSearchMode) {
      notes = notes.filter(note => 
        note.title.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    return this.sortNotes(notes);
  }

  async listAllNotes(): Promise<NoteInfo[]> {
    const notes = await window.electron.listNotes(undefined);
    return this.sortNotes(notes);
  }

  private sortNotes(notes: NoteInfo[]): NoteInfo[] {
    return notes.sort((a, b) => {
      // Pinned notes always on top
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;

      switch (this.sortOrder) {
        case 'modified-desc':
          return new Date(b.modified).getTime() - new Date(a.modified).getTime();
        case 'modified-asc':
          return new Date(a.modified).getTime() - new Date(b.modified).getTime();
        case 'created-desc':
          return new Date(b.created).getTime() - new Date(a.created).getTime();
        case 'created-asc':
          return new Date(a.created).getTime() - new Date(b.created).getTime();
        case 'title-asc':
          return a.title.localeCompare(b.title);
        case 'title-desc':
          return b.title.localeCompare(a.title);
        default:
          return new Date(b.modified).getTime() - new Date(a.modified).getTime();
      }
    });
  }

  async readNote(id: string, folder: string): Promise<ApiResult & { content?: string }> {
    return await window.electron.readNote(id, folder || undefined);
  }

  async saveNote(id: string, content: string, folder: string): Promise<ApiResult> {
    return await window.electron.saveNote(id, content, folder || undefined);
  }

  async createNote(): Promise<NoteOperationResult> {
    return await window.electron.createNote(this.currentFolder || undefined);
  }

  async deleteNote(id: string, folder: string): Promise<ApiResult> {
    return await window.electron.deleteNote(id, folder || undefined);
  }

  async renameNote(id: string, newName: string, folder: string): Promise<NoteOperationResult> {
    return await window.electron.renameNote(id, newName, folder || undefined);
  }

  async createFolder(name: string): Promise<ApiResult> {
    return await window.electron.createFolder(name);
  }

  async renameFolder(oldName: string, newName: string): Promise<ApiResult> {
    return await window.electron.renameFolder(oldName, newName);
  }

  async deleteFolder(name: string): Promise<ApiResult> {
    return await window.electron.deleteFolder(name);
  }

  async moveNoteToFolder(
    noteId: string, 
    currentFolder: string, 
    targetFolder: string
  ): Promise<ApiResult> {
    return await window.electron.moveNoteToFolder(noteId, currentFolder, targetFolder);
  }
}
