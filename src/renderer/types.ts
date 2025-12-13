// ============ Core Data Types ============

export interface NoteInfo {
  id: string;
  title: string;
  modified: Date;
  created: Date;
  folder: string;
  pinned: boolean;
}

export interface FolderInfo {
  name: string;
  path: string;
}

// ============ API Response Types ============

/** Base API result for all operations */
export interface ApiResult {
  success: boolean;
  error?: string;
}

/** Result for note read operations */
export interface ReadNoteResult extends ApiResult {
  content?: string;
}

/** Result for note creation/rename operations */
export interface NoteOperationResult extends ApiResult {
  noteId?: string;
  folder?: string;
}

/** Result for pin toggle operations */
export interface PinResult extends ApiResult {
  pinned?: boolean;
}

/** Result for screenshot save operations */
export interface ScreenshotResult extends ApiResult {
  imagePath?: string;
  imageId?: string;
}

/** Result for external file read operations */
export interface ExternalFileResult extends ApiResult {
  content?: string;
  fileName?: string;
  filePath?: string;
}

/** Result for opacity operations */
export interface OpacityResult extends ApiResult {
  opacity?: number;
}

// ============ Sort Order Type ============

export type SortOrder = 
  | 'modified-desc' 
  | 'modified-asc' 
  | 'created-desc' 
  | 'created-asc' 
  | 'title-asc' 
  | 'title-desc';

// ============ UI Callback Types ============

export interface FolderCallbacks {
  onSelect: (path: string) => void;
  onRename: (name: string) => void;
  onDelete: (name: string) => void;
  onDrop: (noteId: string, sourceFolder: string, targetFolder: string) => void;
}

export interface NoteCallbacks {
  onSelect: (id: string, folder: string) => void;
  onRename: (id: string, folder: string) => void;
  onDelete: (id: string, folder: string) => void;
  onDragStart: (id: string, folder: string) => void;
  onDrop: (targetId: string, targetFolder: string) => void;
  onPin: (id: string, folder: string) => void;
}

export interface NoteRenderState {
  id: string | null;
  folder: string;
  searchQuery: string;
}

// ============ Manager State Types ============

export interface NoteManagerState {
  currentNoteId: string | null;
  currentFolder: string;
  activeNoteFolder: string;
}

// ============ Modal Decision Types ============

export type SaveErrorDecision = 'retry' | 'discard' | 'cancel';
export type ModalType = 'note' | 'folder';

// ============ Editor Interface ============

/**
 * Interface for EditorManager implementations
 * Both the textarea-based and CodeMirror-based implementations satisfy this interface
 */
export interface IEditorManager {
  isPreviewMode: boolean;
  onInput: (() => void) | null;
  onSave: (() => void) | null;
  onStatsUpdate: ((completed: number, total: number) => void) | null;

  getContent(): string;
  setContent(content: string): void;
  isContentChanged(): boolean;
  clear(): void;
  focus(): void;
  togglePreview(): void;
  updatePreview(): void;
  updateStats(): void;
  toggleCheckbox(index: number): void;
  changeFontSize(delta: number): void;
  insertMarkdown(before: string, after?: string): void;
  insertLineMarkdown(prefix: string): void;
  duplicateLine(): void;
  deleteCurrentLine(): void;
}
