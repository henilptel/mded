/**
 * Tauri API Bridge
 * 
 * This module wraps @tauri-apps/api/core invoke calls to match the existing
 * window.electron interface for compatibility with the frontend code.
 */

import { invoke } from '@tauri-apps/api/core';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';

// Types matching the Rust backend (snake_case from Rust)
interface RustNoteInfo {
  id: string;
  title: string;
  modified: string; // ISO date string from Rust
  created: string;  // ISO date string from Rust
  folder: string;
  pinned: boolean;
}

// Note: Rust uses #[serde(rename_all = "camelCase")] so fields come as camelCase
interface RustApiResult {
  success: boolean;
  error?: string;
  content?: string;
  noteId?: string;
  folder?: string;
  imagePath?: string;
  imageId?: string;
  fileName?: string;
  filePath?: string;
  pinned?: boolean;
  opacity?: number;
}

// Re-export types for external use
export type { FolderInfo, NoteInfo, ApiResult } from './types';

import type { 
  FolderInfo, 
  NoteInfo, 
  ApiResult, 
  NoteOperationResult,
  PinResult,
  ScreenshotResult,
  ExternalFileResult,
  OpacityResult
} from './types';

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

// Convert Rust snake_case response to camelCase NoteInfo with Date objects
function convertNoteInfo(note: RustNoteInfo): NoteInfo {
  return {
    id: note.id,
    title: note.title,
    modified: new Date(note.modified),
    created: new Date(note.created),
    folder: note.folder,
    pinned: note.pinned,
  };
}

// Convert Rust API result to typed result
function convertApiResult(result: RustApiResult): ApiResult & { content?: string } {
  return {
    success: result.success,
    error: result.error,
    content: result.content,
  };
}

function convertNoteOperationResult(result: RustApiResult): NoteOperationResult {
  return {
    success: result.success,
    error: result.error,
    noteId: result.noteId,
    folder: result.folder,
  };
}

function convertPinResult(result: RustApiResult): PinResult {
  return {
    success: result.success,
    error: result.error,
    pinned: result.pinned,
  };
}

function convertScreenshotResult(result: RustApiResult): ScreenshotResult {
  return {
    success: result.success,
    error: result.error,
    imagePath: result.imagePath,
    imageId: result.imageId,
  };
}

function convertExternalFileResult(result: RustApiResult): ExternalFileResult {
  return {
    success: result.success,
    error: result.error,
    content: result.content,
    fileName: result.fileName,
    filePath: result.filePath,
  };
}

function convertOpacityResult(result: RustApiResult): OpacityResult {
  return {
    success: result.success,
    error: result.error,
    opacity: result.opacity,
  };
}


/**
 * Tauri API implementation matching the existing window.electron interface
 */
export const tauriAPI = {
  // ============ Folder Operations ============
  listFolders: (): Promise<FolderInfo[]> => 
    invoke<FolderInfo[]>('list_folders'),
  
  createFolder: async (name: string): Promise<ApiResult> => {
    const result = await invoke<RustApiResult>('create_folder', { name });
    return { success: result.success, error: result.error };
  },
  
  deleteFolder: async (name: string): Promise<ApiResult> => {
    const result = await invoke<RustApiResult>('delete_folder', { name });
    return { success: result.success, error: result.error };
  },
  
  renameFolder: async (oldName: string, newName: string): Promise<ApiResult> => {
    const result = await invoke<RustApiResult>('rename_folder', { oldName, newName });
    return { success: result.success, error: result.error };
  },

  // ============ Note Operations ============
  listNotes: async (folder?: string): Promise<NoteInfo[]> => {
    const notes = await invoke<RustNoteInfo[]>('list_notes', { folder: folder ?? null });
    return notes.map(convertNoteInfo);
  },
  
  readNote: async (noteId: string, folder?: string): Promise<ApiResult & { content?: string }> => {
    const result = await invoke<RustApiResult>('read_note', { noteId, folder: folder ?? null });
    return convertApiResult(result);
  },
  
  saveNote: async (noteId: string, content: string, folder?: string): Promise<ApiResult> => {
    const result = await invoke<RustApiResult>('save_note', { noteId, content, folder: folder ?? null });
    return { success: result.success, error: result.error };
  },
  
  createNote: async (folder?: string): Promise<NoteOperationResult> => {
    const result = await invoke<RustApiResult>('create_note', { folder: folder ?? null });
    return convertNoteOperationResult(result);
  },
  
  deleteNote: async (noteId: string, folder?: string): Promise<ApiResult> => {
    const result = await invoke<RustApiResult>('delete_note', { noteId, folder: folder ?? null });
    return { success: result.success, error: result.error };
  },
  
  renameNote: async (noteId: string, newName: string, folder?: string): Promise<NoteOperationResult> => {
    const result = await invoke<RustApiResult>('rename_note', { noteId, newName, folder: folder ?? null });
    return convertNoteOperationResult(result);
  },
  
  moveNoteToFolder: async (noteId: string, currentFolder: string, targetFolder: string): Promise<ApiResult> => {
    const result = await invoke<RustApiResult>('move_note', { noteId, fromFolder: currentFolder, toFolder: targetFolder });
    return { success: result.success, error: result.error };
  },

  // ============ Note Pinning & Order ============
  togglePinNote: async (noteId: string): Promise<PinResult> => {
    const result = await invoke<RustApiResult>('toggle_pin_note', { noteId });
    return convertPinResult(result);
  },
  
  getNoteOrder: (): Promise<Record<string, string[]>> => 
    invoke<Record<string, string[]>>('get_note_order'),
  
  saveNoteOrder: async (order: Record<string, string[]>): Promise<ApiResult> => {
    const result = await invoke<RustApiResult>('save_note_order', { order });
    return { success: result.success, error: result.error };
  },

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
  enterMinimalMode: async (): Promise<ApiResult> => {
    const result = await invoke<RustApiResult>('enter_minimal_mode');
    return { success: result.success, error: result.error };
  },
  
  exitMinimalMode: async (): Promise<ApiResult> => {
    const result = await invoke<RustApiResult>('exit_minimal_mode');
    return { success: result.success, error: result.error };
  },
  
  saveMinimalBounds: async (): Promise<ApiResult> => {
    const result = await invoke<RustApiResult>('save_minimal_bounds');
    return { success: result.success, error: result.error };
  },

  // ============ Display & Opacity ============
  getWindowOpacity: (): Promise<number> => 
    invoke<number>('get_window_opacity'),
  
  setWindowOpacity: async (opacity: number): Promise<OpacityResult> => {
    const result = await invoke<RustApiResult>('set_window_opacity', { opacity });
    return convertOpacityResult(result);
  },
  
  getDisplayInfo: (): Promise<DisplayInfo> => 
    invoke<DisplayInfo>('get_display_info'),

  // ============ System Integration ============
  saveScreenshot: async (base64Data: string): Promise<ScreenshotResult> => {
    const result = await invoke<RustApiResult>('save_screenshot', { base64Data });
    return convertScreenshotResult(result);
  },
  
  getAssetsPath: (): Promise<string> => 
    invoke<string>('get_assets_path'),
  
  readExternalFile: async (filePath: string): Promise<ExternalFileResult> => {
    const result = await invoke<RustApiResult>('read_external_file', { filePath });
    return convertExternalFileResult(result);
  },
  
  getAutoStart: (): Promise<boolean> => 
    invoke<boolean>('get_auto_start'),
  
  setAutoStart: async (enabled: boolean): Promise<ApiResult> => {
    const result = await invoke<RustApiResult>('set_auto_start', { enabled });
    return { success: result.success, error: result.error };
  },

  // ============ Config & Shortcuts ============
  getGlobalShortcut: (): Promise<string> => 
    invoke<string>('get_global_shortcut'),
  
  setGlobalShortcut: async (key: string): Promise<ApiResult> => {
    const result = await invoke<RustApiResult>('set_global_shortcut', { key });
    return { success: result.success, error: result.error };
  },
  
  getLastNote: async (): Promise<{ noteId: string | null; folder: string | null }> => {
    const result = await invoke<LastNote>('get_last_note');
    return {
      noteId: result.noteId ?? null,
      folder: result.folder ?? null,
    };
  },
  
  saveLastNote: async (noteId: string | null, folder: string | null): Promise<ApiResult> => {
    const result = await invoke<RustApiResult>('save_last_note', { noteId, folder });
    return { success: result.success, error: result.error };
  },
  
  saveQuickNote: async (content: string): Promise<ApiResult> => {
    const result = await invoke<RustApiResult>('save_quick_note', { content });
    return { success: result.success, error: result.error };
  },

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
