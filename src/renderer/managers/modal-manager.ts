import { UIManager } from './ui-manager';

export class ModalManager {
  private ui: UIManager;

  constructor(ui: UIManager) {
    this.ui = ui;
  }

  showSaveErrorModal(message: string): Promise<'retry' | 'discard' | 'cancel'> {
    return new Promise((resolve) => {
      this.ui.elements.saveErrorMessage.textContent = message;
      this.ui.elements.saveErrorModal.classList.add('show');

      const cleanup = () => {
        this.ui.elements.saveErrorModal.classList.remove('show');
        this.ui.elements.saveErrorRetry.removeEventListener('click', handleRetry);
        this.ui.elements.saveErrorDiscard.removeEventListener('click', handleDiscard);
        this.ui.elements.saveErrorCancel.removeEventListener('click', handleCancel);
        this.ui.elements.saveErrorClose.removeEventListener('click', handleCancel);
      };

      const handleRetry = () => { cleanup(); resolve('retry'); };
      const handleDiscard = () => { cleanup(); resolve('discard'); };
      const handleCancel = () => { cleanup(); resolve('cancel'); };

      this.ui.elements.saveErrorRetry.addEventListener('click', handleRetry);
      this.ui.elements.saveErrorDiscard.addEventListener('click', handleDiscard);
      this.ui.elements.saveErrorCancel.addEventListener('click', handleCancel);
      this.ui.elements.saveErrorClose.addEventListener('click', handleCancel);
    });
  }

  showRenameModal(type: 'note' | 'folder', currentName: string, onConfirm: (newName: string) => void) {
    this.ui.elements.renameTitle.textContent = `Rename ${type === 'note' ? 'Note' : 'Folder'}`;
    this.ui.elements.renameInput.value = currentName;
    this.ui.elements.renameModal.classList.add('show');
    this.ui.elements.renameInput.focus();

    const handleConfirm = () => {
      const newName = this.ui.elements.renameInput.value.trim();
      if (newName && newName !== currentName) {
        onConfirm(newName);
        closeRename();
      }
    };

    const closeRename = () => {
      this.ui.elements.renameModal.classList.remove('show');
      cleanup();
    };

    const cleanup = () => {
      this.ui.elements.renameConfirm.removeEventListener('click', handleConfirm);
      this.ui.elements.renameCancel.removeEventListener('click', closeRename);
      this.ui.elements.renameClose.removeEventListener('click', closeRename);
      this.ui.elements.renameInput.removeEventListener('keydown', keyHandler);
    };

    const keyHandler = (e: KeyboardEvent) => {
      if (e.key === 'Enter') handleConfirm();
      if (e.key === 'Escape') closeRename();
    };

    this.ui.elements.renameConfirm.addEventListener('click', handleConfirm);
    this.ui.elements.renameCancel.addEventListener('click', closeRename);
    this.ui.elements.renameClose.addEventListener('click', closeRename);
    this.ui.elements.renameInput.addEventListener('keydown', keyHandler);
  }

  showConfirmModal(message: string, onConfirm: () => void) {
    this.ui.elements.confirmMessage.textContent = message;
    this.ui.elements.confirmModal.classList.add('show');

    const handleConfirm = () => {
      onConfirm();
      closeConfirm();
    };

    const closeConfirm = () => {
      this.ui.elements.confirmModal.classList.remove('show');
      cleanup();
    };

    const cleanup = () => {
      this.ui.elements.confirmOk.removeEventListener('click', handleConfirm);
      this.ui.elements.confirmCancel.removeEventListener('click', closeConfirm);
      this.ui.elements.confirmClose.removeEventListener('click', closeConfirm);
    };

    this.ui.elements.confirmOk.addEventListener('click', handleConfirm);
    this.ui.elements.confirmCancel.addEventListener('click', closeConfirm);
    this.ui.elements.confirmClose.addEventListener('click', closeConfirm);
  }

  showCreateFolderModal(onCreate: (name: string) => Promise<void>) {
    this.ui.elements.createFolderInput.value = '';
    this.ui.elements.createFolderModal.classList.add('show');
    this.ui.elements.createFolderInput.focus();

    const handleCreate = async () => {
      const name = this.ui.elements.createFolderInput.value.trim();
      if (name) {
        await onCreate(name);
        closeCreate();
      }
    };

    const closeCreate = () => {
      this.ui.elements.createFolderModal.classList.remove('show');
      cleanup();
    };

    const cleanup = () => {
      this.ui.elements.createFolderConfirm.removeEventListener('click', handleCreate);
      this.ui.elements.createFolderCancel.removeEventListener('click', closeCreate);
      this.ui.elements.createFolderClose.removeEventListener('click', closeCreate);
      this.ui.elements.createFolderInput.removeEventListener('keydown', keyHandler);
    };

    const keyHandler = (e: KeyboardEvent) => {
      if (e.key === 'Enter') handleCreate();
      if (e.key === 'Escape') closeCreate();
    };

    this.ui.elements.createFolderConfirm.addEventListener('click', handleCreate);
    this.ui.elements.createFolderCancel.addEventListener('click', closeCreate);
    this.ui.elements.createFolderClose.addEventListener('click', closeCreate);
    this.ui.elements.createFolderInput.addEventListener('keydown', keyHandler);
  }

  closeAllModals() {
    this.ui.closeAllModals();
  }
}
