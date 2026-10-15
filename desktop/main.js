/**
 * LEADFORGE Desktop — Electron main process
 *
 * Thin client: abre a instância hospedada do LeadForge numa janela nativa.
 * Na primeira execução, pede a URL do servidor. Depois, abre direto.
 */
const { app, BrowserWindow, dialog, Menu, shell, session } = require('electron');
const path = require('path');
const fs = require('fs');

const SETTINGS_FILE = path.join(app.getPath('userData'), 'settings.json');

let mainWindow = null;

function loadSettings() {
  try {
    return JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function saveSettings(settings) {
  fs.mkdirSync(path.dirname(SETTINGS_FILE), { recursive: true });
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
}

function getServerUrl() {
  const settings = loadSettings();
  return settings.serverUrl || null;
}

function setServerUrl(url) {
  // normaliza (sem trailing slash)
  const normalized = url.replace(/\/+$/, '');
  saveSettings({ ...loadSettings(), serverUrl: normalized });
}

function askForServerUrl() {
  return new Promise((resolve) => {
    const win = new BrowserWindow({
      width: 520,
      height: 420,
      resizable: false,
      frame: true,
      title: 'LeadForge — Configurar',
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
      },
      autoHideMenuBar: true,
      icon: path.join(__dirname, 'icons', getIconFile()),
    });

    win.loadFile(path.join(__dirname, 'renderer', 'setup.html'));

    const { ipcMain } = require('electron');
    const handler = (_event, url) => {
      if (url && url.startsWith('http')) {
        setServerUrl(url);
        ipcMain.removeListener('leadforge:set-url', handler);
        win.close();
        resolve(url);
      }
    };
    ipcMain.on('leadforge:set-url', handler);
  });
}

function getIconFile() {
  if (process.platform === 'win32') return 'icon.ico';
  if (process.platform === 'darwin') return 'icon.icns';
  return 'icon.png';
}

function createMainWindow(url) {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    show: false,
    title: 'LeadForge',
    icon: path.join(__dirname, 'icons', getIconFile()),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.loadURL(url);

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // abre links externos no navegador do sistema
  mainWindow.webContents.setWindowOpenHandler(({ url: linkUrl }) => {
    if (linkUrl.startsWith(url)) {
      return { action: 'allow' };
    }
    shell.openExternal(linkUrl);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function buildMenu() {
  const template = [
    ...(process.platform === 'darwin' ? [{ role: 'appMenu' }] : []),
    {
      label: 'Arquivo',
      submenu: [
        { label: 'Atualizar', accelerator: 'CmdOrCtrl+R', click: () => mainWindow?.reload() },
        { type: 'separator' },
        { label: 'Trocar servidor…', click: async () => {
          const url = await askForServerUrl();
          if (url && mainWindow) {
            mainWindow.loadURL(url);
          }
        }},
        { type: 'separator' },
        ...(process.platform !== 'darwin' ? [{ role: 'quit' }] : []),
      ],
    },
    { role: 'editMenu' },
    { role: 'viewMenu' },
    {
      label: 'Ajuda',
      submenu: [
        {
          label: 'Sobre o LeadForge',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'Sobre',
              message: 'LeadForge v1.0.0',
              detail: 'Find. Qualify. Personalize. Convert.\n\nPlataforma de inteligência comercial e conquista financeira digital.\n\n© 2026 Yua Devs — Todos os direitos reservados.',
              buttons: ['OK'],
            });
          },
        },
        {
          label: 'Site',
          click: () => shell.openExternal('https://github.com/yuaberry/leadforge'),
        },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// Single instance lock
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    buildMenu();

    let url = getServerUrl();
    if (!url) {
      url = await askForServerUrl();
    }

    createMainWindow(url);

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createMainWindow(getServerUrl());
      }
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });
}
