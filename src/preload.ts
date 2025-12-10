import { contextBridge, ipcRenderer } from 'electron';

export interface NoteInfo {
  id: string;
  title: string;
  modified: Date;
  created: Date;
  folder: string;
  pinned?: boolean;
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
  togglePinNote: (noteId: string): Promise<ApiResult> => ipcRenderer.invoke('toggle-pin-note', noteId),
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
  saveLastNote: (noteId: string | null, folder: string | null): Promise<ApiResult> => ipcRenderer.invoke('save-last-note', noteId, folder),
  saveQuickNote: (content: string): Promise<ApiResult> => ipcRenderer.invoke('save-quick-note', content),
  
  // P4: Window & Display Features
  enterMinimalMode: (): Promise<ApiResult> => ipcRenderer.invoke('enter-minimal-mode'),
  exitMinimalMode: (): Promise<ApiResult> => ipcRenderer.invoke('exit-minimal-mode'),
  saveMinimalBounds: (): Promise<ApiResult> => ipcRenderer.invoke('save-minimal-bounds'),
  getWindowOpacity: (): Promise<number> => ipcRenderer.invoke('get-window-opacity'),
  setWindowOpacity: (opacity: number): Promise<ApiResult & { opacity?: number }> => ipcRenderer.invoke('set-window-opacity', opacity),
  getDisplayInfo: (): Promise<{ x: number, y: number, width: number, height: number }> => ipcRenderer.invoke('get-display-info'),
  
  // P5: System Integration
  saveScreenshot: (base64Data: string): Promise<ApiResult & { imagePath?: string, imageId?: string }> => 
    ipcRenderer.invoke('save-screenshot', base64Data),
  getAssetsPath: (): Promise<string> => ipcRenderer.invoke('get-assets-path'),
  readExternalFile: (filePath: string): Promise<ApiResult & { content?: string, fileName?: string, filePath?: string }> =>
    ipcRenderer.invoke('read-external-file', filePath),
  getAutoStart: (): Promise<boolean> => ipcRenderer.invoke('get-auto-start'),
  setAutoStart: (enabled: boolean): Promise<ApiResult> => ipcRenderer.invoke('set-auto-start', enabled),
  
  // Events
  onRefreshNotes: (callback: (noteId?: string) => void) => ipcRenderer.on('refresh-notes', (_event, noteId) => callback(noteId)),
  onOpenFile: (callback: (filePath: string) => void) => ipcRenderer.on('open-file', (_event, filePath) => callback(filePath))
};

contextBridge.exposeInMainWorld('electron', electronAPI);

// Type declaration for renderer
export type ElectronAPI = typeof electronAPI;