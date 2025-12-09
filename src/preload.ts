import { contextBridge, ipcRenderer } from 'electron';

export interface NoteInfo {
  id: string;
  title: string;
  modified: Date;
  folder: string;
}

export interface FolderInfo {
  name: string;
  path: string;
}

export interface ApiResult<T = void> {
  success: boolean;
  error?: string;
  content?: string;
  noteId?: string;
  folder?: string;
}

const electronAPI = {
  // Folder operations
  listFolders: (): Promise<FolderInfo[]> => ipcRenderer.invoke('list-folders'),
  createFolder: (name: string): Promise<ApiResult> => ipcRenderer.invoke('create-folder', name),
  deleteFolder: (name: string): Promise<ApiResult> => ipcRenderer.invoke('delete-folder', name),
  renameFolder: (oldName: string, newName: string): Promise<ApiResult> => ipcRenderer.invoke('rename-folder', oldName, newName),
  renameNote: (noteId: string, newName: string, folder?: string): Promise<ApiResult> => ipcRenderer.invoke('rename-note', noteId, newName, folder),
  moveNoteToFolder: (noteId: string, currentFolder: string, targetFolder: string): Promise<ApiResult> => 
    ipcRenderer.invoke('move-note-to-folder', noteId, currentFolder, targetFolder),
  
  // Note operations
  listNotes: (folder?: string): Promise<NoteInfo[]> => ipcRenderer.invoke('list-notes', folder),
  readNote: (noteId: string, folder?: string): Promise<ApiResult> => ipcRenderer.invoke('read-note', noteId, folder),
  saveNote: (noteId: string, content: string, folder?: string): Promise<ApiResult> => 
    ipcRenderer.invoke('save-note', noteId, content, folder),
  createNote: (folder?: string): Promise<ApiResult> => ipcRenderer.invoke('create-note', folder),
  deleteNote: (noteId: string, folder?: string): Promise<ApiResult> => ipcRenderer.invoke('delete-note', noteId, folder),
  
  // Note order
  getNoteOrder: (): Promise<Record<string, string[]>> => ipcRenderer.invoke('get-note-order'),
  saveNoteOrder: (order: Record<string, string[]>): Promise<ApiResult> => ipcRenderer.invoke('save-note-order', order),
  
  // Window controls
  minimizeWindow: (): void => ipcRenderer.send('minimize-window'),
  maximizeWindow: (): void => ipcRenderer.send('maximize-window'),
  closeWindow: (): void => ipcRenderer.send('close-window'),
  setAlwaysOnTop: (flag: boolean): Promise<ApiResult> => ipcRenderer.invoke('set-always-on-top', flag),
  getGlobalShortcut: (): Promise<string> => ipcRenderer.invoke('get-global-shortcut'),
  setGlobalShortcut: (key: string): Promise<ApiResult> => ipcRenderer.invoke('set-global-shortcut', key),
  
  // Persistence
  getLastNote: (): Promise<{ noteId: string | null, folder: string | null }> => ipcRenderer.invoke('get-last-note'),
  saveLastNote: (noteId: string, folder: string): Promise<ApiResult> => ipcRenderer.invoke('save-last-note', noteId, folder),
  saveQuickNote: (content: string): Promise<ApiResult> => ipcRenderer.invoke('save-quick-note', content)
};

contextBridge.exposeInMainWorld('electron', electronAPI);

// Type declaration for renderer
export type ElectronAPI = typeof electronAPI;
