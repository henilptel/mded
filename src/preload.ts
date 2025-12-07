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
  setAlwaysOnTop: (flag: boolean): Promise<ApiResult> => ipcRenderer.invoke('set-always-on-top', flag)
};

contextBridge.exposeInMainWorld('electron', electronAPI);

// Type declaration for renderer
export type ElectronAPI = typeof electronAPI;
