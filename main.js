const { app, BrowserWindow, Tray, Menu, ipcMain, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');
const os = require('os');

let mainWindow;
let tray;

const NOTES_DIR = path.join(os.homedir(), '.mded', 'notes');

if (!fsSync.existsSync(NOTES_DIR)) {
  fsSync.mkdirSync(NOTES_DIR, { recursive: true });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    icon: path.join(__dirname, 'build/icon.png'),
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  mainWindow.loadFile('index.html');

  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });
}

const createTray = () => {
  const iconPath = path.join(__dirname, 'build/icon.png');
  const icon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
  
  tray = new Tray(icon);
  const contextMenu = Menu.buildFromTemplate([
    { label: 'Show', click: () => mainWindow.show() },
    { label: 'Quit', click: () => {
      app.isQuitting = true;
      app.quit();
    }}
  ]);
  
  tray.setToolTip('MDed - Markdown Editor');
  tray.setContextMenu(contextMenu);
  
  tray.on('click', () => {
    mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show();
  });
}

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    // Someone tried to run a second instance, we should focus our window.
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      if (!mainWindow.isVisible()) mainWindow.show();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    createWindow();
    createTray();
  });
}

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

ipcMain.handle('list-notes', async () => {
  try {
    const files = await fs.readdir(NOTES_DIR);
    const mdFiles = files.filter(f => f.endsWith('.md'));
    const notes = await Promise.all(mdFiles.map(async (file) => {
      const filePath = path.join(NOTES_DIR, file);
      const stats = await fs.stat(filePath);
      const content = await fs.readFile(filePath, 'utf-8');
      const title = content.split('\n')[0].replace(/^#\s*/, '') || file.replace('.md', '');
      return {
        id: file,
        title,
        modified: stats.mtime
      };
    }));
    return notes.sort((a, b) => b.modified - a.modified);
  } catch (error) {
    console.error('Error listing notes:', error);
    return [];
  }
});

ipcMain.handle('read-note', async (event, noteId) => {
  try {
    const filePath = path.join(NOTES_DIR, noteId);
    const content = await fs.readFile(filePath, 'utf-8');
    return content;
  } catch (error) {
    console.error('Error reading note:', error);
    return '';
  }
});

ipcMain.handle('save-note', async (event, noteId, content) => {
  try {
    const filePath = path.join(NOTES_DIR, noteId);
    await fs.writeFile(filePath, content, 'utf-8');
    return true;
  } catch (error) {
    console.error('Error saving note:', error);
    return false;
  }
});

ipcMain.handle('create-note', async () => {
  try {
    const timestamp = Date.now();
    const noteId = `note-${timestamp}.md`;
    const filePath = path.join(NOTES_DIR, noteId);
    await fs.writeFile(filePath, '# New Note\n\n', 'utf-8');
    return noteId;
  } catch (error) {
    console.error('Error creating note:', error);
    return null;
  }
});

ipcMain.handle('delete-note', async (event, noteId) => {
  try {
    const filePath = path.join(NOTES_DIR, noteId);
    await fs.unlink(filePath);
    return true;
  } catch (error) {
    console.error('Error deleting note:', error);
    return false;
  }
});

ipcMain.on('minimize-window', () => {
  mainWindow.minimize();
});

ipcMain.on('maximize-window', () => {
  if (mainWindow.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow.maximize();
  }
});

ipcMain.on('close-window', () => {
  mainWindow.hide();
});

ipcMain.handle('set-always-on-top', async (event, flag) => {
  mainWindow.setAlwaysOnTop(flag);
  return true;
});
