import { NoteInfo, FolderInfo, ApiResult } from '../types';

export class NoteManager {
  private currentNoteId: string | null = null;
  private currentFolder: string = '';
  private activeNoteFolder: string = '';


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
    if (id) {
        window.electron.saveLastNote(id, folder);
    }
  }

  async loadFolders(): Promise<FolderInfo[]> {
    return await window.electron.listFolders();
  }

  async listNotes(searchQuery: string = ''): Promise<NoteInfo[]> {
    const isSearchMode = searchQuery.length > 0;
    const fetchFolder = isSearchMode ? undefined : (this.currentFolder || undefined);
    
    let notes = await window.electron.listNotes(fetchFolder);
    
    if (isSearchMode) {
      notes = notes.filter(note => note.title.toLowerCase().includes(searchQuery.toLowerCase()));
    }

    // Always sort by modified date (descending)
    return notes.sort((a, b) => new Date(b.modified).getTime() - new Date(a.modified).getTime());
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


}
