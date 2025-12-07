import { ElectronAPI } from '../preload';

export {};

declare global {
  interface Window {
    electron: ElectronAPI;
  }
  const marked: { parse: (markdown: string) => string };
  const hljs: { highlightElement: (element: HTMLElement) => void } | undefined;
}

