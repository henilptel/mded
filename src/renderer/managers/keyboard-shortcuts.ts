import { ShortcutManager } from './shortcut-manager';
import type { IEditorManager } from '../types';
import { TabManager } from './tab-manager';
import { UIManager } from './ui-manager';

export interface KeyboardShortcutCallbacks {
  saveCurrentNote: () => Promise<void>;
  createNewNote: () => void;
  togglePreview: () => void;
  openCommandPalette: () => void;
  focusSidebar: () => void;
}

export function registerKeyboardShortcuts(
  shortcutManager: ShortcutManager,
  editorManager: IEditorManager,
  tabManager: TabManager,
  ui: UIManager,
  callbacks: KeyboardShortcutCallbacks
) {
  // Undo/Redo - using editor's native history instead of deprecated document.execCommand
  shortcutManager.registerCtrl('z', (e) => {
    e.preventDefault();
    editorManager.undo();
  });

  shortcutManager.registerCtrl('y', (e) => {
    e.preventDefault();
    editorManager.redo();
  });

  // Save
  shortcutManager.registerCtrl('s', (e) => {
    e.preventDefault();
    callbacks.saveCurrentNote().then(() => ui.showToast('Saved', 'success'));
  });

  // New note
  shortcutManager.registerCtrl('n', (e) => {
    e.preventDefault();
    callbacks.createNewNote();
  });

  // Toggle preview
  shortcutManager.registerCtrl('e', (e) => {
    e.preventDefault();
    callbacks.togglePreview();
  });

  // Show shortcuts modal
  shortcutManager.registerCtrl('/', (e) => {
    e.preventDefault();
    document.getElementById('shortcuts-modal')?.classList.add('show');
  });

  // Text formatting
  shortcutManager.registerCtrl('b', (e) => {
    e.preventDefault();
    editorManager.insertMarkdown('**', '**');
  });

  shortcutManager.registerCtrl('i', (e) => {
    e.preventDefault();
    editorManager.insertMarkdown('*', '*');
  });

  shortcutManager.registerCtrl('k', (e) => {
    e.preventDefault();
    editorManager.insertMarkdown('[', '](url)');
  });

  // Line operations
  shortcutManager.registerCtrl('d', (e) => {
    e.preventDefault();
    editorManager.duplicateLine();
  });

  shortcutManager.register('shift+delete', (e) => {
    e.preventDefault();
    editorManager.deleteCurrentLine();
  });

  // Font size
  shortcutManager.registerCtrl('=', (e) => {
    e.preventDefault();
    editorManager.changeFontSize(2);
  });

  shortcutManager.registerCtrl('-', (e) => {
    e.preventDefault();
    editorManager.changeFontSize(-2);
  });

  // Escape - close modals
  shortcutManager.register('escape', () => {
    ui.closeAllModals();
    document.getElementById('shortcuts-modal')?.classList.remove('show');
  });

  // Command palette
  shortcutManager.registerCtrl('p', (e) => {
    e.preventDefault();
    callbacks.openCommandPalette();
  });

  // Sidebar focus
  shortcutManager.register('ctrl+shift+e', (e) => {
    e.preventDefault();
    callbacks.focusSidebar();
  });

  // Tab management
  shortcutManager.registerCtrl('w', (e) => {
    e.preventDefault();
    if (tabManager.getActiveTabIndex() >= 0) {
      tabManager.closeTab(tabManager.getActiveTabIndex());
    }
  });

  shortcutManager.register('ctrl+tab', (e) => {
    e.preventDefault();
    tabManager.nextTab();
  });

  shortcutManager.registerCtrl('pagedown', (e) => {
    e.preventDefault();
    tabManager.nextTab();
  });

  shortcutManager.register('ctrl+shift+tab', (e) => {
    e.preventDefault();
    tabManager.previousTab();
  });

  shortcutManager.registerCtrl('pageup', (e) => {
    e.preventDefault();
    tabManager.previousTab();
  });
}

export function registerRecentNotesShortcut(
  shortcutManager: ShortcutManager,
  getRecentNotes: () => { id: string; folder: string }[],
  loadNote: (id: string, folder: string) => void
): void {
  shortcutManager.registerCtrl('Tab', (e) => {
    e.preventDefault();
    const recentNotes = getRecentNotes();
    if (recentNotes.length > 1) {
      const target = recentNotes[recentNotes.length - 2];
      if (target) {
        loadNote(target.id, target.folder);
      }
    }
  });
}
