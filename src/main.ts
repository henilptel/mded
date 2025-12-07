import { app, BrowserWindow, Tray, Menu, ipcMain, nativeImage, globalShortcut } from 'electron';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as os from 'os';

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;

const NOTES_DIR = path.join(os.homedir(), '.mded', 'notes');

// Ensure notes directory exists
if (!fsSync.existsSync(NOTES_DIR)) {
  fsSync.mkdirSync(NOTES_DIR, { recursive: true });
}

interface NoteInfo {
  id: string;
  title: string;
  modified: Date;
  folder: string;
}

interface FolderInfo {
  name: string;
  path: string;
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    icon: path.join(__dirname, '../build/icon.png'),
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  mainWindow.loadFile(path.join(__dirname, '../index.html'));

  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });
}

const createTray = (): void => {
  const iconPath = path.join(__dirname, '../build/icon.png');
  const icon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
  
  tray = new Tray(icon);
  const contextMenu = Menu.buildFromTemplate([
    { label: 'Show', click: () => mainWindow?.show() },
    { label: 'Quit', click: () => {
      isQuitting = true;
      app.quit();
    }}
  ]);
  
  tray.setToolTip('MDed - Markdown Editor');
  tray.setContextMenu(contextMenu);
  
  tray.on('click', () => {
    mainWindow?.isVisible() ? mainWindow.hide() : mainWindow?.show();
  });
};

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      if (!mainWindow.isVisible()) mainWindow.show();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    createWindow();
    createTray();
    
    // Global hotkey to show/focus window (Ctrl+Shift+N)
    globalShortcut.register('CommandOrControl+Shift+N', () => {
      if (mainWindow) {
        if (!mainWindow.isVisible()) {
          mainWindow.show();
        }
        mainWindow.focus();
      }
    });
  });
}

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// ============ Folder Management ============

async function listFolders(): Promise<FolderInfo[]> {
  try {
    const entries = await fs.readdir(NOTES_DIR, { withFileTypes: true });
    const folders: FolderInfo[] = [{ name: 'All Notes', path: '' }];
    
    for (const entry of entries) {
      if (entry.isDirectory()) {
        folders.push({
          name: entry.name,
          path: entry.name
        });
      }
    }
    return folders;
  } catch (error) {
    console.error('Error listing folders:', error);
    return [{ name: 'All Notes', path: '' }];
  }
}

ipcMain.handle('list-folders', async () => {
  return listFolders();
});

ipcMain.handle('create-folder', async (_event, folderName: string) => {
  try {
    const folderPath = path.join(NOTES_DIR, folderName);
    await fs.mkdir(folderPath, { recursive: true });
    return { success: true };
  } catch (error) {
    console.error('Error creating folder:', error);
    return { success: false, error: String(error) };
  }
});

ipcMain.handle('move-note-to-folder', async (_event, noteId: string, currentFolder: string, targetFolder: string) => {
  try {
    const currentPath = currentFolder 
      ? path.join(NOTES_DIR, currentFolder, noteId)
      : path.join(NOTES_DIR, noteId);
    const targetPath = targetFolder
      ? path.join(NOTES_DIR, targetFolder, noteId)
      : path.join(NOTES_DIR, noteId);
    
    await fs.rename(currentPath, targetPath);
    return { success: true };
  } catch (error) {
    console.error('Error moving note:', error);
    return { success: false, error: String(error) };
  }
});

// ============ Note Management ============

async function getNotesFromDir(dir: string, folder: string = ''): Promise<NoteInfo[]> {
  const files = await fs.readdir(dir);
  const mdFiles = files.filter(f => f.endsWith('.md'));
  
  const notes = await Promise.all(mdFiles.map(async (file) => {
    const filePath = path.join(dir, file);
    const stats = await fs.stat(filePath);
    const content = await fs.readFile(filePath, 'utf-8');
    const title = content.split('\n')[0].replace(/^#\s*/, '') || file.replace('.md', '');
    return {
      id: file,
      title,
      modified: stats.mtime,
      folder
    };
  }));
  
  return notes;
}

ipcMain.handle('list-notes', async (_event, folder?: string) => {
  try {
    let notes: NoteInfo[] = [];
    
    if (folder) {
      // List notes from specific folder
      const folderPath = path.join(NOTES_DIR, folder);
      if (fsSync.existsSync(folderPath)) {
        notes = await getNotesFromDir(folderPath, folder);
      }
    } else {
      // List all notes (root + all folders)
      notes = await getNotesFromDir(NOTES_DIR, '');
      
      const entries = await fs.readdir(NOTES_DIR, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const folderPath = path.join(NOTES_DIR, entry.name);
          const folderNotes = await getNotesFromDir(folderPath, entry.name);
          notes = notes.concat(folderNotes);
        }
      }
    }
    
    return notes.sort((a, b) => new Date(b.modified).getTime() - new Date(a.modified).getTime());
  } catch (error) {
    console.error('Error listing notes:', error);
    return [];
  }
});

ipcMain.handle('read-note', async (_event, noteId: string, folder?: string) => {
  try {
    const filePath = folder 
      ? path.join(NOTES_DIR, folder, noteId)
      : path.join(NOTES_DIR, noteId);
    const content = await fs.readFile(filePath, 'utf-8');
    return { success: true, content };
  } catch (error) {
    console.error('Error reading note:', error);
    return { success: false, error: String(error) };
  }
});

ipcMain.handle('save-note', async (_event, noteId: string, content: string, folder?: string) => {
  try {
    const filePath = folder 
      ? path.join(NOTES_DIR, folder, noteId)
      : path.join(NOTES_DIR, noteId);
    await fs.writeFile(filePath, content, 'utf-8');
    return { success: true };
  } catch (error) {
    console.error('Error saving note:', error);
    return { success: false, error: String(error) };
  }
});

ipcMain.handle('create-note', async (_event, folder?: string) => {
  try {
    const timestamp = Date.now();
    const noteId = `note-${timestamp}.md`;
    const filePath = folder 
      ? path.join(NOTES_DIR, folder, noteId)
      : path.join(NOTES_DIR, noteId);
    
    // Ensure folder exists
    if (folder) {
      await fs.mkdir(path.join(NOTES_DIR, folder), { recursive: true });
    }
    
    await fs.writeFile(filePath, '# New Note\n\n', 'utf-8');
    return { success: true, noteId, folder: folder || '' };
  } catch (error) {
    console.error('Error creating note:', error);
    return { success: false, error: String(error) };
  }
});

ipcMain.handle('delete-note', async (_event, noteId: string, folder?: string) => {
  try {
    const filePath = folder 
      ? path.join(NOTES_DIR, folder, noteId)
      : path.join(NOTES_DIR, noteId);
    await fs.unlink(filePath);
    return { success: true };
  } catch (error) {
    console.error('Error deleting note:', error);
    return { success: false, error: String(error) };
  }
});

// ============ Note Order Management ============

const ORDER_FILE = path.join(os.homedir(), '.mded', 'note-order.json');

ipcMain.handle('get-note-order', async () => {
  try {
    if (fsSync.existsSync(ORDER_FILE)) {
      const data = await fs.readFile(ORDER_FILE, 'utf-8');
      return JSON.parse(data);
    }
    return {};
  } catch (error) {
    console.error('Error reading note order:', error);
    return {};
  }
});

ipcMain.handle('save-note-order', async (_event, order: Record<string, string[]>) => {
  try {
    await fs.writeFile(ORDER_FILE, JSON.stringify(order, null, 2), 'utf-8');
    return { success: true };
  } catch (error) {
    console.error('Error saving note order:', error);
    return { success: false, error: String(error) };
  }
});

// ============ Window Controls ============

ipcMain.on('minimize-window', () => {
  mainWindow?.minimize();
});

ipcMain.on('maximize-window', () => {
  if (mainWindow?.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow?.maximize();
  }
});

ipcMain.on('close-window', () => {
  mainWindow?.hide();
});

ipcMain.handle('set-always-on-top', async (_event, flag: boolean) => {
  mainWindow?.setAlwaysOnTop(flag);
  return { success: true };
});
