import { EditorManager } from './editor-manager';
import { NoteManager } from './note-manager';
import { UIManager } from './ui-manager';

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
  private ui: UIManager;

  // Callbacks for external coordination
  public onTabChange?: () => void;
  public onShowSaveError?: (message: string) => Promise<'retry' | 'discard' | 'cancel'>;

  constructor(editorManager: EditorManager, noteManager: NoteManager, ui: UIManager) {
    this.editorManager = editorManager;
    this.noteManager = noteManager;
    this.ui = ui;
  }

  private getTabsBar(): HTMLElement | null {
    return document.getElementById('tabs-bar');
  }

  renderTabs() {
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

  openTab(id: string, folder: string, title: string, content: string) {
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

  switchToTab(index: number) {
    if (index < 0 || index >= this.openTabs.length || index === this.activeTabIndex) return;

    this.saveCurrentTabContent();
    this.activeTabIndex = index;
    const tab = this.openTabs[this.activeTabIndex];
    this.editorManager.setContent(tab.content);
    this.noteManager.setCurrentNote(tab.id, tab.folder);
    this.renderTabs();
    this.onTabChange?.();
  }

  async closeTab(index: number): Promise<void> {
    if (index < 0 || index >= this.openTabs.length) return;

    const tab = this.openTabs[index];
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
      this.editorManager.setContent(newTab.content);
      this.noteManager.setCurrentNote(newTab.id, newTab.folder);
    }

    this.renderTabs();
    this.onTabChange?.();
  }

  saveCurrentTabContent() {
    if (this.activeTabIndex >= 0 && this.openTabs[this.activeTabIndex]) {
      this.openTabs[this.activeTabIndex].content = this.editorManager.getContent();
    }
  }

  markCurrentTabModified() {
    if (this.activeTabIndex >= 0 && this.openTabs[this.activeTabIndex]) {
      this.openTabs[this.activeTabIndex].modified = true;
      this.openTabs[this.activeTabIndex].content = this.editorManager.getContent();
      this.renderTabs();
    }
  }

  markCurrentTabSaved() {
    if (this.activeTabIndex >= 0 && this.openTabs[this.activeTabIndex]) {
      this.openTabs[this.activeTabIndex].modified = false;
      this.renderTabs();
    }
  }

  getCurrentTab(): Tab | null {
    return this.activeTabIndex >= 0 ? this.openTabs[this.activeTabIndex] : null;
  }

  getActiveTabIndex(): number {
    return this.activeTabIndex;
  }

  getOpenTabsCount(): number {
    return this.openTabs.length;
  }

  // Mark tab as unmodified (for deleted notes)
  markTabUnmodified(id: string, folder: string) {
    const idx = this.findTabIndex(id, folder);
    if (idx >= 0) {
      this.openTabs[idx].modified = false;
    }
  }

  // Navigate tabs
  nextTab() {
    if (this.openTabs.length > 1) {
      const nextIndex = (this.activeTabIndex + 1) % this.openTabs.length;
      this.switchToTab(nextIndex);
    }
  }

  previousTab() {
    if (this.openTabs.length > 1) {
      const prevIndex = (this.activeTabIndex - 1 + this.openTabs.length) % this.openTabs.length;
      this.switchToTab(prevIndex);
    }
  }
}
