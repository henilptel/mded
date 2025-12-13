/**
 * Tauri API Bridge
 * 
 * This module wraps @tauri-apps/api/core invoke calls to match the existing
 * window.electron interface for compatibility with the frontend code.
 */

import { invoke } from '@tauri-apps/api/core';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';

// Types matching the Rust backend
export interface FolderInfo {
  name: string;
  path: string;
}

export interface NoteInfo {
  id: string;
  title: string;
  modified: string; // ISO date string from Rust
  created: string;  // ISO date string from Rust
  folder: string;
  pinned: boolean;
}

export interface ApiResult {
  success: boolean;
  error?: string;
  content?: string;
  note_id?: string;
  folder?: string;
  image_path?: string;
  image_id?: string;
  file_name?: string;
  file_path?: string;
  pinned?: boolean;
  opacity?: number;
}

export interface DisplayInfo {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LastNote {
  noteId: string | null;
  folder: string | null;
}

// Convert ISO date strings to Date objects for NoteInfo
function convertNoteInfo(note: NoteInfo): NoteInfo & { modified: Date; created: Date } {
  return {
    ...note,
    modified: new Date(note.modified),
    created: new Date(note.created),
  } as NoteInfo & { modified: Date; created: Date };
}


/**
 * Tauri API implementation matching the existing window.electron interface
 */
export const tauriAPI = {
  // ============ Folder Operations ============
  listFolders: (): Promise<FolderInfo[]> => 
    invoke<FolderInfo[]>('list_folders'),
  
  createFolder: (name: string): Promise<ApiResult> => 
    invoke<ApiResult>('create_folder', { name }),
  
  deleteFolder: (name: string): Promise<ApiResult> => 
    invoke<ApiResult>('delete_folder', { name }),
  
  renameFolder: (oldName: string, newName: string): Promise<ApiResult> => 
    invoke<ApiResult>('rename_folder', { oldName, newName }),

  // ============ Note Operations ============
  listNotes: async (folder?: string): Promise<(NoteInfo & { modified: Date; created: Date })[]> => {
    const notes = await invoke<NoteInfo[]>('list_notes', { folder: folder ?? null });
    return notes.map(convertNoteInfo);
  },
  
  readNote: (noteId: string, folder?: string): Promise<ApiResult> => 
    invoke<ApiResult>('read_note', { noteId, folder: folder ?? null }),
  
  saveNote: (noteId: string, content: string, folder?: string): Promise<ApiResult> => 
    invoke<ApiResult>('save_note', { noteId, content, folder: folder ?? null }),
  
  createNote: (folder?: string): Promise<ApiResult> => 
    invoke<ApiResult>('create_note', { folder: folder ?? null }),
  
  deleteNote: (noteId: string, folder?: string): Promise<ApiResult> => 
    invoke<ApiResult>('delete_note', { noteId, folder: folder ?? null }),
  
  renameNote: (noteId: string, newName: string, folder?: string): Promise<ApiResult> => 
    invoke<ApiResult>('rename_note', { noteId, newName, folder: folder ?? null }),
  
  moveNoteToFolder: (noteId: string, currentFolder: string, targetFolder: string): Promise<ApiResult> => 
    invoke<ApiResult>('move_note', { noteId, fromFolder: currentFolder, toFolder: targetFolder }),

  // ============ Note Pinning & Order ============
  togglePinNote: (noteId: string): Promise<ApiResult> => 
    invoke<ApiResult>('toggle_pin_note', { noteId }),
  
  getNoteOrder: (): Promise<Record<string, string[]>> => 
    invoke<Record<string, string[]>>('get_note_order'),
  
  saveNoteOrder: (order: Record<string, string[]>): Promise<ApiResult> => 
    invoke<ApiResult>('save_note_order', { order }),

  // ============ Window Controls ============
  minimizeWindow: (): Promise<void> => 
    getCurrentWindow().minimize(),
  
  maximizeWindow: async (): Promise<void> => {
    const win = getCurrentWindow();
    if (await win.isMaximized()) {
      await win.unmaximize();
    } else {
      await win.maximize();
    }
  },
  
  closeWindow: (): Promise<void> => 
    getCurrentWindow().hide(),
  
  setAlwaysOnTop: (flag: boolean): Promise<ApiResult> => 
    invoke<ApiResult>('set_always_on_top', { flag }),

  // ============ Minimal Mode ============
  enterMinimalMode: (): Promise<ApiResult> => 
    invoke<ApiResult>('enter_minimal_mode'),
  
  exitMinimalMode: (): Promise<ApiResult> => 
    invoke<ApiResult>('exit_minimal_mode'),
  
  saveMinimalBounds: (): Promise<ApiResult> => 
    invoke<ApiResult>('save_minimal_bounds'),

  // ============ Display & Opacity ============
  getWindowOpacity: (): Promise<number> => 
    invoke<number>('get_window_opacity'),
  
  setWindowOpacity: (opacity: number): Promise<ApiResult & { opacity?: number }> => 
    invoke<ApiResult & { opacity?: number }>('set_window_opacity', { opacity }),
  
  getDisplayInfo: (): Promise<DisplayInfo> => 
    invoke<DisplayInfo>('get_display_info'),

  // ============ System Integration ============
  saveScreenshot: (base64Data: string): Promise<ApiResult & { imagePath?: string; imageId?: string }> => 
    invoke<ApiResult & { imagePath?: string; imageId?: string }>('save_screenshot', { base64Data }),
  
  getAssetsPath: (): Promise<string> => 
    invoke<string>('get_assets_path'),
  
  readExternalFile: (filePath: string): Promise<ApiResult & { content?: string; fileName?: string; filePath?: string }> => 
    invoke<ApiResult & { content?: string; fileName?: string; filePath?: string }>('read_external_file', { filePath }),
  
  getAutoStart: (): Promise<boolean> => 
    invoke<boolean>('get_auto_start'),
  
  setAutoStart: (enabled: boolean): Promise<ApiResult> => 
    invoke<ApiResult>('set_auto_start', { enabled }),

  // ============ Config & Shortcuts ============
  getGlobalShortcut: (): Promise<string> => 
    invoke<string>('get_global_shortcut'),
  
  setGlobalShortcut: (key: string): Promise<ApiResult> => 
    invoke<ApiResult>('set_global_shortcut', { key }),
  
  getLastNote: async (): Promise<{ noteId: string | null; folder: string | null }> => {
    const result = await invoke<LastNote>('get_last_note');
    return {
      noteId: result.noteId ?? null,
      folder: result.folder ?? null,
    };
  },
  
  saveLastNote: (noteId: string | null, folder: string | null): Promise<ApiResult> => 
    invoke<ApiResult>('save_last_note', { noteId, folder }),
  
  saveQuickNote: (content: string): Promise<ApiResult> => 
    invoke<ApiResult>('save_quick_note', { content }),

  // ============ Events ============
  onRefreshNotes: (callback: (noteId?: string) => void): Promise<UnlistenFn> => 
    listen<string | null>('refresh-notes', (event) => callback(event.payload ?? undefined)),
  
  onOpenFile: (callback: (filePath: string) => void): Promise<UnlistenFn> => 
    listen<string>('open-file', (event) => callback(event.payload)),
};

// Expose as window.electron for compatibility with existing frontend code
(window as unknown as { electron: typeof tauriAPI }).electron = tauriAPI;

// Export type for global declaration
export type TauriAPI = typeof tauriAPI;
