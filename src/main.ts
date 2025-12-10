import { app, BrowserWindow, Tray, Menu, ipcMain, nativeImage, globalShortcut, clipboard, Notification } from 'electron';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as os from 'os';
import * as crypto from 'crypto';

let mainWindow: BrowserWindow | null = null;
let quickNoteWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;

/**
 * Validates that a file or folder name is safe and does not contain path traversal characters.
 * Also ensures the resolved path is within the intended base directory.
 */
function validatePath(baseDir: string, relativePath: string): string {
  // 1. Basic check for traversal attempts in the relative path string
  if (relativePath.includes('..') || relativePath.includes('/') || relativePath.includes('\\')) {
    throw new Error('Invalid path: Path traversal detected');
  }

  // 2. Resolve the full path
  const resolvedPath = path.join(baseDir, relativePath);

  // 3. Verify the resolved path starts with the base directory
  if (!resolvedPath.startsWith(baseDir)) {
    throw new Error('Invalid path: Path is outside of base directory');
  }

  return resolvedPath;
}

const NOTES_DIR = path.join(os.homedir(), '.mded', 'notes');

// Ensure notes directory exists
if (!fsSync.existsSync(NOTES_DIR)) {
  fsSync.mkdirSync(NOTES_DIR, { recursive: true });
}

const CONFIG_FILE = path.join(os.homedir(), '.mded', 'config.json');
let config: any = {
  globalShortcut: 'CommandOrControl+Shift+N',
  clipboardShortcut: 'CommandOrControl+Alt+V',
  quickNoteShortcut: 'CommandOrControl+Alt+N',
  windowBounds: { width: 1200, height: 800 },
  lastNoteId: null as string | null,
  lastFolder: null as string | null,
  pinnedNotes: [] as string[],
  minimalModeBounds: { width: 400, height: 300 } as { width: number, height: number, x?: number, y?: number },
  windowOpacity: 1.0
};

function loadConfig() {
  try {
    if (fsSync.existsSync(CONFIG_FILE)) {
      const data = fsSync.readFileSync(CONFIG_FILE, 'utf-8');
      const loaded = JSON.parse(data);
      config = { ...config, ...loaded };
    }
  } catch (error) {
    console.error('Error loading config:', error);
  }
}

function saveConfig() {
  try {
    fsSync.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
  } catch (error) {
    console.error('Error saving config:', error);
  }
}

let saveTimer: NodeJS.Timeout | null = null;
function scheduleSaveConfig() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveConfig();
  }, 1000);
}

loadConfig();

interface NoteInfo {
  id: string;
  title: string;
  modified: Date;
  created: Date;
  folder: string;
  pinned?: boolean;
}

interface FolderInfo {
  name: string;
  path: string;
}

function createWindow(): void {
  const { width, height, x, y } = config.windowBounds || { width: 1200, height: 800 };

  mainWindow = new BrowserWindow({
    width,
    height,
    x,
    y,
    minWidth: 300,
    minHeight: 200,
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

  mainWindow.on('resize', () => {
    if (!mainWindow) return;
    const { width, height } = mainWindow.getBounds();
    config.windowBounds = { ...config.windowBounds, width, height };
    scheduleSaveConfig();
  });

  mainWindow.on('move', () => {
    if (!mainWindow) return;
    const { x, y } = mainWindow.getBounds();
    config.windowBounds = { ...config.windowBounds, x, y };
    scheduleSaveConfig();
  });

  mainWindow.loadFile(path.join(__dirname, '../index.html'));

  // Set initial window opacity via CSS variable (Linux workaround)
  mainWindow.webContents.on('did-finish-load', () => {
    if (mainWindow && config.windowOpacity !== 1.0) {
      mainWindow.webContents.executeJavaScript(
        `document.documentElement.style.setProperty('--window-opacity', '${config.windowOpacity}')`
      );
    }
  });

  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });

  // Prevent maximizing while in minimal mode
  mainWindow.on('maximize', () => {
    if (isInMinimalMode) {
      mainWindow?.unmaximize();
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
    // Register global shortcut
    registerGlobalShortcut(config.globalShortcut);
    registerClipboardShortcut(config.clipboardShortcut);
    registerQuickNoteShortcut(config.quickNoteShortcut);
  });
}

function registerGlobalShortcut(key: string): boolean {
  try {
    globalShortcut.unregisterAll();
    const ret = globalShortcut.register(key, () => {
      if (mainWindow) {
        if (mainWindow.isVisible()) {
          // In minimal mode, just focus the window instead of hiding
          if (isInMinimalMode) {
            mainWindow.focus();
          } else {
            mainWindow.hide();
          }
        } else {
          mainWindow.show();
          mainWindow.focus();
        }
      }
    });
    return ret;
  } catch (error) {
    console.error('Failed to register shortcut:', error);
    return false;
  }
}

function registerClipboardShortcut(key: string): boolean {
  try {
    return globalShortcut.register(key, async () => {
      const content = clipboard.readText();
      if (!content.trim()) {
        new Notification({ title: 'MDed', body: 'Clipboard is empty' }).show();
        return;
      }

      const noteId = `clipboard-${Date.now()}.md`;
      const filePath = path.join(NOTES_DIR, noteId);
      
      try {
        await fs.writeFile(filePath, content, 'utf-8');
        new Notification({ title: 'MDed', body: 'Note saved from clipboard!' }).show();
        
        // If window is open, refresh (could send IPC, but for now relies on manual or auto refresh)
         if (mainWindow && mainWindow.isVisible()) {
            mainWindow.webContents.send('refresh-notes', noteId);
         }
      } catch (err) {
        console.error('Failed to save clipboard note:', err);
        new Notification({ title: 'MDed', body: 'Failed to save note' }).show();
      }
    });
  } catch (error) {
    console.error('Failed to register clipboard shortcut:', error);
    return false;
  }
}

function createQuickNoteWindow(): void {
  if (quickNoteWindow) {
    // Check if somehow destroyed but not nulled
    if (quickNoteWindow.isDestroyed()) {
        quickNoteWindow = null;
    } else {
        if (quickNoteWindow.isVisible()) {
        quickNoteWindow.hide();
        } else {
        quickNoteWindow.show();
        quickNoteWindow.focus();
        }
        return;
    }
  }
  
  const { screen } = require('electron');
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth, x: screenX, y: screenY } = primaryDisplay.workArea;
  
  const windowWidth = 500;
  const windowHeight = 300;
  const padding = 20;

  quickNoteWindow = new BrowserWindow({
    width: windowWidth,
    height: windowHeight,
    x: screenX + screenWidth - windowWidth - padding,
    y: screenY + padding,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  quickNoteWindow.loadFile(path.join(__dirname, '../quick-note.html'));

  quickNoteWindow.on('blur', () => {
    if (quickNoteWindow && !quickNoteWindow.isDestroyed()) {
        quickNoteWindow.hide();
    }
  });
  
  quickNoteWindow.on('close', (e) => {
      // Don't simplify destroy, just hide
      if (!isQuitting) {
          e.preventDefault();
          if (quickNoteWindow && !quickNoteWindow.isDestroyed()) {
              quickNoteWindow.hide();
          }
      }
  });

  quickNoteWindow.on('closed', () => {
      quickNoteWindow = null;
  });
}

function registerQuickNoteShortcut(key: string) {
    globalShortcut.register(key, () => {
        createQuickNoteWindow();
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
    const folderPath = validatePath(NOTES_DIR, folderName);
    await fs.mkdir(folderPath, { recursive: true });
    return { success: true };
  } catch (error) {
    console.error('Error creating folder:', error);
    return { success: false, error: String(error) };
  }
});

ipcMain.handle('delete-folder', async (_event, folderName: string) => {
  try {
    const folderPath = validatePath(NOTES_DIR, folderName);
    await fs.rm(folderPath, { recursive: true, force: true });
    return { success: true };
  } catch (error) {
    console.error('Error deleting folder:', error);
    return { success: false, error: String(error) };
  }
});

ipcMain.handle('rename-folder', async (_event, oldName: string, newName: string) => {
  try {
    const oldPath = validatePath(NOTES_DIR, oldName);
    const newPath = validatePath(NOTES_DIR, newName);
    await fs.rename(oldPath, newPath);
    return { success: true };
  } catch (error) {
    console.error('Error renaming folder:', error);
    return { success: false, error: String(error) };
  }
});

ipcMain.handle('rename-note', async (_event, noteId: string, newName: string, folder?: string) => {
  try {
    // Ensure new name ends with .md
    if (!newName.endsWith('.md')) {
      newName += '.md';
    }
    
    const oldPath = folder 
      ? validatePath(path.join(NOTES_DIR, folder), noteId)
      : validatePath(NOTES_DIR, noteId);
      
    const newPath = folder
      ? validatePath(path.join(NOTES_DIR, folder), newName)
      : validatePath(NOTES_DIR, newName);

    await fs.rename(oldPath, newPath);
    
    // Update pinned notes if needed
    if (config.pinnedNotes.includes(noteId)) {
        config.pinnedNotes = config.pinnedNotes.map((id: string) => id === noteId ? newName : id);
        scheduleSaveConfig();
    }
    
    return { success: true, noteId: newName };
  } catch (error) {
    console.error('Error renaming note:', error);
    return { success: false, error: String(error) };
  }
});

ipcMain.handle('move-note-to-folder', async (_event, noteId: string, currentFolder: string, targetFolder: string) => {
  try {
    const currentPath = currentFolder 
      ? validatePath(path.join(NOTES_DIR, currentFolder), noteId)
      : validatePath(NOTES_DIR, noteId);
    const targetPath = targetFolder
      ? validatePath(path.join(NOTES_DIR, targetFolder), noteId)
      : validatePath(NOTES_DIR, noteId);
    
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
    try {
      const stats = await fs.stat(filePath);
      return {
        id: file,
        title: path.basename(file, '.md'),
        modified: stats.mtime,
        created: stats.birthtime,
        folder
      };
    } catch (err) {
      console.error(`Error getting stats for ${file}:`, err);
      return null;
    }
  }));
  
  return notes.filter(n => n !== null) as NoteInfo[];
}

ipcMain.handle('list-notes', async (_event, folder?: string) => {
  try {
    let notes: NoteInfo[] = [];
    
    if (folder) {
      // List notes from specific folder
      const folderPath = validatePath(NOTES_DIR, folder);
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
    
    const sortedNotes = notes.sort((a, b) => new Date(b.modified).getTime() - new Date(a.modified).getTime());
    
    // enhance with pinned status
    return sortedNotes.map(n => ({
        ...n,
        pinned: config.pinnedNotes.includes(n.id)
    }));
  } catch (error) {
    console.error('Error listing notes:', error);
    return [];
  }
});

ipcMain.handle('read-note', async (_event, noteId: string, folder?: string) => {
  try {
    const filePath = folder 
      ? validatePath(path.join(NOTES_DIR, folder), noteId)
      : validatePath(NOTES_DIR, noteId);
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
      ? validatePath(path.join(NOTES_DIR, folder), noteId)
      : validatePath(NOTES_DIR, noteId);
    await fs.writeFile(filePath, content, 'utf-8');
    return { success: true };
  } catch (error) {
    console.error('Error saving note:', error);
    return { success: false, error: String(error) };
  }
});

ipcMain.handle('create-note', async (_event, folder?: string) => {
  try {
    const noteId = `note-${crypto.randomUUID()}.md`;
    const filePath = folder 
      ? validatePath(path.join(NOTES_DIR, folder), noteId)
      : validatePath(NOTES_DIR, noteId);
    
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
      ? validatePath(path.join(NOTES_DIR, folder), noteId)
      : validatePath(NOTES_DIR, noteId);
    await fs.unlink(filePath);
    
    // Remove from pinned
    if (config.pinnedNotes.includes(noteId)) {
        config.pinnedNotes = config.pinnedNotes.filter((id: string) => id !== noteId);
        scheduleSaveConfig();
    }
    
    return { success: true };
  } catch (error) {
    console.error('Error deleting note:', error);
    return { success: false, error: String(error) };
  }
});

ipcMain.handle('toggle-pin-note', (_event, noteId: string) => {
    if (config.pinnedNotes.includes(noteId)) {
        config.pinnedNotes = config.pinnedNotes.filter((id: string) => id !== noteId);
    } else {
        config.pinnedNotes.push(noteId);
    }
    scheduleSaveConfig();
    return { success: true, pinned: config.pinnedNotes.includes(noteId) };
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
  // Don't allow maximize in minimal mode
  if (isInMinimalMode) {
    return;
  }
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

ipcMain.handle('get-global-shortcut', () => {
  return config.globalShortcut;
});

ipcMain.handle('set-global-shortcut', (_event, key: string) => {
  if (registerGlobalShortcut(key)) {
    config.globalShortcut = key;
    scheduleSaveConfig();
    return { success: true };
  }
});

// ============ Persistence ============

ipcMain.handle('get-last-note', () => {
  return {
    noteId: config.lastNoteId,
    folder: config.lastFolder
  };
});

ipcMain.handle('save-last-note', (_event, noteId: string | null, folder: string | null) => {
  config.lastNoteId = noteId;
  config.lastFolder = folder;
  scheduleSaveConfig();
  return { success: true };
});

ipcMain.handle('save-quick-note', async (_event, content: string) => {
  try {
      if (!content.trim()) return { success: false, error: 'Empty content' };
      
      const noteId = `quick-${Date.now()}.md`;
      const filePath = path.join(NOTES_DIR, noteId);
      await fs.writeFile(filePath, content, 'utf-8');
      
      new Notification({ title: 'MDed', body: 'Quick note saved' }).show();
      quickNoteWindow?.hide();
      
      
       if (mainWindow && mainWindow.isVisible()) {
           mainWindow.webContents.send('refresh-notes', noteId);
       }
       return { success: true };
  } catch (error) {
      console.error('Error saving quick note:', error);
      return { success: false, error: String(error) };
  }
});

// ============ P4: Window & Display Features ============

let normalBoundsBeforeMinimal: Electron.Rectangle | null = null;
let isInMinimalMode = false;

ipcMain.handle('enter-minimal-mode', async () => {
  if (!mainWindow) return { success: false };
  
  // Save current bounds to restore later
  normalBoundsBeforeMinimal = mainWindow.getBounds();
  isInMinimalMode = true;
  
  // Use saved minimal bounds or defaults (small window)
  const savedBounds = config.minimalModeBounds || {};
  const width = savedBounds.width || 400;
  const height = savedBounds.height || 300;
  
  // Set minimum size for minimal mode
  mainWindow.setMinimumSize(200, 150);
  
  // Position: use saved position or center on screen
  const { screen } = require('electron');
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight, x: screenX, y: screenY } = primaryDisplay.workArea;
  
  const newX = savedBounds.x !== undefined ? savedBounds.x : screenX + Math.round((screenWidth - width) / 2);
  const newY = savedBounds.y !== undefined ? savedBounds.y : screenY + Math.round((screenHeight - height) / 2);
  
  // Unmaximize first if window is maximized
  if (mainWindow.isMaximized()) {
    mainWindow.unmaximize();
  }
  
  mainWindow.setBounds({
    width,
    height,
    x: newX,
    y: newY
  });
  
  return { success: true };
});

ipcMain.handle('exit-minimal-mode', async () => {
  if (!mainWindow) return { success: false };
  
  isInMinimalMode = false;
  
  // Save current minimal mode bounds before exiting
  const currentBounds = mainWindow.getBounds();
  config.minimalModeBounds = {
    width: currentBounds.width,
    height: currentBounds.height,
    x: currentBounds.x,
    y: currentBounds.y
  };
  scheduleSaveConfig();
  
  // Restore to normal bounds
  if (normalBoundsBeforeMinimal) {
    mainWindow.setMinimumSize(300, 200);
    mainWindow.setBounds(normalBoundsBeforeMinimal);
    normalBoundsBeforeMinimal = null;
  }
  
  return { success: true };
});

ipcMain.handle('save-minimal-bounds', async () => {
  if (!mainWindow || !isInMinimalMode) return { success: false };
  
  const bounds = mainWindow.getBounds();
  config.minimalModeBounds = {
    width: bounds.width,
    height: bounds.height,
    x: bounds.x,
    y: bounds.y
  };
  scheduleSaveConfig();
  
  return { success: true };
});

ipcMain.handle('get-window-opacity', () => {
  return config.windowOpacity;
});

ipcMain.handle('set-window-opacity', async (_event, opacity: number) => {
  if (!mainWindow) return { success: false };
  
  const clampedOpacity = Math.max(0.3, Math.min(1.0, opacity));
  
  // Use CSS variable for Linux compatibility (native setOpacity doesn't work on Linux)
  mainWindow.webContents.executeJavaScript(
    `document.documentElement.style.setProperty('--window-opacity', '${clampedOpacity}')`
  );
  
  config.windowOpacity = clampedOpacity;
  scheduleSaveConfig();
  
  return { success: true, opacity: clampedOpacity };
});

ipcMain.handle('snap-to-corner', async (_event, corner: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right') => {
  if (!mainWindow) return { success: false };
  
  if (mainWindow.isMaximized()) {
    mainWindow.unmaximize();
  }
  
  const { screen } = require('electron');
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight, x: screenX, y: screenY } = primaryDisplay.workArea;
  
  const bounds = mainWindow.getBounds();
  const padding = 20;
  
  let newX = screenX;
  let newY = screenY;
  
  switch (corner) {
    case 'top-left':
      newX = screenX + padding;
      newY = screenY + padding;
      break;
    case 'top-right':
      newX = screenX + screenWidth - bounds.width - padding;
      newY = screenY + padding;
      break;
    case 'bottom-left':
      newX = screenX + padding;
      newY = screenY + screenHeight - bounds.height - padding;
      break;
    case 'bottom-right':
      newX = screenX + screenWidth - bounds.width - padding;
      newY = screenY + screenHeight - bounds.height - padding;
      break;
  }
  
  mainWindow.setBounds({ x: newX, y: newY, width: bounds.width, height: bounds.height });
  
  return { success: true };
});

ipcMain.handle('get-display-info', async () => {
  const { screen } = require('electron');
  const primaryDisplay = screen.getPrimaryDisplay();
  return primaryDisplay.workArea;
});