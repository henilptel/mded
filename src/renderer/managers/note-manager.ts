import { NoteInfo, FolderInfo, ApiResult } from '../types';

export class NoteManager {
  private currentNoteId: string | null = null;
  private currentFolder: string = '';
  private activeNoteFolder: string = '';
  private noteOrder: Record<string, string[]> = {};

  constructor() {}

  get currentState() {
    return {
      currentNoteId: this.currentNoteId,
      currentFolder: this.currentFolder,
      activeNoteFolder: this.activeNoteFolder
    };
  }

  setCurrentFolder(folder: string) {
    this.currentFolder = folder;
  }

  setCurrentNote(id: string | null, folder: string = '') {
    this.currentNoteId = id;
    this.activeNoteFolder = folder;
  }

  async loadFolders(): Promise<FolderInfo[]> {
    return await window.electron.listFolders();
  }

  async listNotes(searchQuery: string = ''): Promise<NoteInfo[]> {
    const isSearchMode = searchQuery.length > 0;
    const fetchFolder = isSearchMode ? undefined : (this.currentFolder || undefined);
    
    let notes = await window.electron.listNotes(fetchFolder);
    this.noteOrder = await window.electron.getNoteOrder();

    if (isSearchMode) {
      notes = notes.filter(note => note.title.toLowerCase().includes(searchQuery.toLowerCase()));
      // Sort by modified date in search
      return notes.sort((a, b) => new Date(b.modified).getTime() - new Date(a.modified).getTime());
    }

    // Sort by custom order
    const orderKey = this.currentFolder || '_root';
    const orderedIds = this.noteOrder[orderKey] || [];

    return notes.sort((a, b) => {
      const aIndex = orderedIds.indexOf(a.id);
      const bIndex = orderedIds.indexOf(b.id);
      if (aIndex === -1 && bIndex === -1) {
        return new Date(b.modified).getTime() - new Date(a.modified).getTime();
      }
      if (aIndex === -1) return 1;
      if (bIndex === -1) return -1;
      return aIndex - bIndex;
    });
  }

  async readNote(id: string, folder: string): Promise<ApiResult> {
    return await window.electron.readNote(id, folder || undefined);
  }

  async saveNote(id: string, content: string, folder: string): Promise<ApiResult> {
    return await window.electron.saveNote(id, content, folder || undefined);
  }

  async createNote(): Promise<ApiResult> {
    return await window.electron.createNote(this.currentFolder || undefined);
  }

  async deleteNote(id: string, folder: string): Promise<ApiResult> {
    return await window.electron.deleteNote(id, folder || undefined);
  }

  async renameNote(id: string, newName: string, folder: string): Promise<ApiResult> {
    return await window.electron.renameNote(id, newName, folder);
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

  async moveNoteToFolder(noteId: string, currentFolder: string, targetFolder: string): Promise<ApiResult> {
    return await window.electron.moveNoteToFolder(noteId, currentFolder, targetFolder);
  }

  async reorderNote(noteId: string, folder: string, newIndex: number, notes: NoteInfo[]) {
      // Logic from app.ts drag drop
      const orderKey = folder || '_root';
      const currentOrder = this.noteOrder[orderKey] || notes.map(n => n.id);
      
      // Remove generic logic, specific implementation needed
      // This helper is better handled in the UI drag-drop handler calling saveNoteOrder directly
      // but let's expose a method to save order
      return; 
  }

  async saveOrder(folder: string, newOrderIds: string[]): Promise<ApiResult> {
      const orderKey = folder || '_root';
      this.noteOrder[orderKey] = newOrderIds;
      return await window.electron.saveNoteOrder(this.noteOrder);
  }

  getNoteOrderForFolder(folder: string): string[] {
      return this.noteOrder[folder || '_root'] || [];
  }
}
