/**
 * Global type declarations for the MDed Tauri application
 */

import type { TauriAPI } from './api';

export {};

declare global {
  interface Window {
    electron: TauriAPI;
  }
  
  const marked: { 
    parse: (markdown: string, options?: { gfm?: boolean; breaks?: boolean }) => string;
  };
  const hljs: { highlightElement: (element: HTMLElement) => void } | undefined;
}
