import { EditorManager } from './editor-manager';
import { NoteManager } from './note-manager';
import type { SaveErrorDecision } from '../types';

export interface Tab {
  id: string;
  folder: string;
  title: string;
  content: string;
  modified: boolean;
}

export class TabManager {
  private openTabs: Tab[] = [];
  private activeTabIndex = -1;
  private editorManager: EditorManager;
  private noteManager: NoteManager;

  // Callbacks for external coordination
  public onTabChange?: () => void;
  public onShowSaveError?: (message: string) => Promise<SaveErrorDecision>;

  constructor(editorManager: EditorManager, noteManager: NoteManager) {
    this.editorManager = editorManager;
    this.noteManager = noteManager;
  }

  private getTabsBar(): HTMLElement | null {
    return document.getElementById('tabs-bar');
  }

  private getActiveTab(): Tab | undefined {
    return this.activeTabIndex >= 0 ? this.openTabs[this.activeTabIndex] : undefined;
  }

  renderTabs(): void {
    const tabsBar = this.getTabsBar();
    if (!tabsBar) return;

    tabsBar.innerHTML = '';

    if (this.openTabs.length === 0) {
      tabsBar.classList.add('hidden');
      return;
    }
    tabsBar.classList.remove('hidden');

    this.openTabs.forEach((tab, index) => {
      const tabEl = document.createElement('div');
      tabEl.className = 'tab-item' + (index === this.activeTabIndex ? ' active' : '') + (tab.modified ? ' modified' : '');

      const title = document.createElement('span');
      title.className = 'tab-title';
      title.textContent = tab.title;

      const closeBtn = document.createElement('button');
      closeBtn.className = 'tab-close';
      closeBtn.innerHTML = '<svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.closeTab(index);
      });

      tabEl.appendChild(title);
      tabEl.appendChild(closeBtn);
      tabEl.addEventListener('click', () => this.switchToTab(index));
      tabsBar.appendChild(tabEl);
    });
  }

  findTabIndex(id: string, folder: string): number {
    return this.openTabs.findIndex(t => t.id === id && t.folder === folder);
  }

  openTab(id: string, folder: string, title: string, content: string): void {
    const existingIndex = this.findTabIndex(id, folder);
    if (existingIndex >= 0) {
      this.switchToTab(existingIndex);
      return;
    }

    this.saveCurrentTabContent();

    const tab: Tab = { id, folder, title, content, modified: false };
    this.openTabs.push(tab);
    this.activeTabIndex = this.openTabs.length - 1;
    this.editorManager.setContent(content);
    this.renderTabs();
  }

  switchToTab(index: number): void {
    if (index < 0 || index >= this.openTabs.length || index === this.activeTabIndex) return;

    this.saveCurrentTabContent();
    this.activeTabIndex = index;
    const tab = this.openTabs[this.activeTabIndex];
    if (!tab) return;
    
    this.editorManager.setContent(tab.content);
    this.noteManager.setCurrentNote(tab.id, tab.folder);
    this.renderTabs();
    this.onTabChange?.();
  }

  async closeTab(index: number): Promise<void> {
    if (index < 0 || index >= this.openTabs.length) return;

    const tab = this.openTabs[index];
    if (!tab) return;
    
    const tabId = tab.id;
    const tabFolder = tab.folder;

    if (tab.modified) {
      try {
        await this.noteManager.saveNote(tab.id, tab.content, tab.folder);
      } catch (err) {
        console.error('Failed to save tab before closing:', err);
        
        if (this.onShowSaveError) {
          const decision = await this.onShowSaveError(
            `Failed to save "${tab.title}". What would you like to do?`
          );

          const currentTabIndex = this.findTabIndex(tabId, tabFolder);
          if (currentTabIndex === -1) return;

          if (decision === 'retry') {
            return this.closeTab(currentTabIndex);
          } else if (decision === 'cancel') {
            return;
          }
          index = currentTabIndex;
        }
      }
    }

    const indexToClose = this.findTabIndex(tabId, tabFolder);
    if (indexToClose === -1) return;

    this.openTabs.splice(indexToClose, 1);

    if (this.openTabs.length === 0) {
      this.activeTabIndex = -1;
      this.editorManager.clear();
      this.noteManager.setCurrentNote(null);
    } else if (indexToClose < this.activeTabIndex) {
      this.activeTabIndex--;
    } else if (indexToClose === this.activeTabIndex) {
      this.activeTabIndex = Math.min(this.activeTabIndex, this.openTabs.length - 1);
      const newTab = this.openTabs[this.activeTabIndex];
      if (newTab) {
        this.editorManager.setContent(newTab.content);
        this.noteManager.setCurrentNote(newTab.id, newTab.folder);
      }
    }

    this.renderTabs();
    this.onTabChange?.();
  }

  saveCurrentTabContent(): void {
    const tab = this.getActiveTab();
    if (tab) {
      tab.content = this.editorManager.getContent();
    }
  }

  markCurrentTabModified(): void {
    const tab = this.getActiveTab();
    if (tab) {
      tab.modified = true;
      tab.content = this.editorManager.getContent();
      this.renderTabs();
    }
  }

  markCurrentTabSaved(): void {
    const tab = this.getActiveTab();
    if (tab) {
      tab.modified = false;
      this.renderTabs();
    }
  }

  getCurrentTab(): Tab | null {
    return this.getActiveTab() ?? null;
  }

  getActiveTabIndex(): number {
    return this.activeTabIndex;
  }

  getOpenTabsCount(): number {
    return this.openTabs.length;
  }

  // Mark tab as unmodified (for deleted notes)
  markTabUnmodified(id: string, folder: string): void {
    const idx = this.findTabIndex(id, folder);
    const tab = idx >= 0 ? this.openTabs[idx] : undefined;
    if (tab) {
      tab.modified = false;
    }
  }

  // Update tab when note is renamed
  updateTabNoteId(oldId: string, oldFolder: string, newId: string, newTitle: string): void {
    const idx = this.findTabIndex(oldId, oldFolder);
    const tab = idx >= 0 ? this.openTabs[idx] : undefined;
    if (tab) {
      tab.id = newId;
      tab.title = newTitle;
      this.renderTabs();
    }
  }

  // Update all tabs when folder is renamed
  updateTabsFolder(oldFolder: string, newFolder: string): void {
    let changed = false;
    for (const tab of this.openTabs) {
      if (tab.folder === oldFolder) {
        tab.folder = newFolder;
        changed = true;
      }
    }
    if (changed) {
      this.renderTabs();
    }
  }

  // Close all tabs in a folder (for folder deletion)
  closeTabsInFolder(folder: string): void {
    const tabsToClose = this.openTabs
      .map((tab, idx) => ({ tab, idx }))
      .filter(({ tab }) => tab.folder === folder)
      .reverse(); // Close from end to avoid index shifting issues
    
    for (const { tab } of tabsToClose) {
      tab.modified = false; // Don't try to save deleted notes
      const idx = this.findTabIndex(tab.id, tab.folder);
      if (idx >= 0) {
        this.openTabs.splice(idx, 1);
      }
    }
    
    // Reset active tab if needed
    if (this.openTabs.length === 0) {
      this.activeTabIndex = -1;
      this.editorManager.clear();
      this.noteManager.setCurrentNote(null);
    } else if (this.activeTabIndex >= this.openTabs.length) {
      this.activeTabIndex = this.openTabs.length - 1;
      const newTab = this.openTabs[this.activeTabIndex];
      if (newTab) {
        this.editorManager.setContent(newTab.content);
        this.noteManager.setCurrentNote(newTab.id, newTab.folder);
      }
    }
    
    this.renderTabs();
    this.onTabChange?.();
  }

  // Navigate tabs
  nextTab(): void {
    if (this.openTabs.length > 1) {
      const nextIndex = (this.activeTabIndex + 1) % this.openTabs.length;
      this.switchToTab(nextIndex);
    }
  }

  previousTab(): void {
    if (this.openTabs.length > 1) {
      const prevIndex = (this.activeTabIndex - 1 + this.openTabs.length) % this.openTabs.length;
      this.switchToTab(prevIndex);
    }
  }
}
