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
