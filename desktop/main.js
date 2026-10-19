/**
 * LEADFORGE Desktop — Electron main process
 *
 * Dois modos:
 *   LOCAL  → inicia o servidor LeadForge localmente na porta 4210 e abre a janela.
 *   REMOTE → conecta numa instância hospedada (URL verificada via /api/health).
 *
 * CORREÇÃO DE BUG: anteriormente usava localhost:3000, que conflitava
 * com outros projetos (ex.: Soundify). Agora usa porta dedicada 4210
 * + health check para garantir que está conectando no LeadForge.
 */
const { app, BrowserWindow, dialog, Menu, shell, ipcMain } = require('electron');
const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const http = require('http');

const LEADFORGE_PORT = 4210;
const LEADFORGE_LOCAL_URL = `http://localhost:${LEADFORGE_PORT}`;
const HEALTH_TIMEOUT = 5000;

const SETTINGS_FILE = path.join(app.getPath('userData'), 'settings.json');

let mainWindow = null;
let serverProcess = null;

// ============================================================
// Settings
// ============================================================

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

function getMode() {
  const settings = loadSettings();
  return settings.mode || null; // 'local' | 'remote' | null (primeira vez)
}

function setMode(mode, url = null) {
  saveSettings({ ...loadSettings(), mode, ...(url ? { serverUrl: url } : {}) });
}

function getRemoteUrl() {
  return loadSettings().serverUrl || null;
}

// ============================================================
// Health check — verifica que a URL é realmente LeadForge
// ============================================================

function checkLeadForgeHealth(url) {
  return new Promise((resolve) => {
    const request = http.get(
      `${url.replace(/\/+$/, '')}/api/health`,
      { timeout: HEALTH_TIMEOUT },
      (response) => {
        let body = '';
        response.on('data', (chunk) => { body += chunk; });
        response.on('end', () => {
          try {
            const data = JSON.parse(body);
            resolve(data.app === 'leadforge');
          } catch {
            resolve(false);
          }
        });
      }
    );
    request.on('error', () => resolve(false));
    request.on('timeout', () => {
      request.destroy();
      resolve(false);
    });
  });
}

/** Verifica se uma porta está em uso. */
function isPortInUse(port) {
  try {
    const output = execSync(`lsof -i :${port} -t 2>/dev/null || true`).toString().trim();
    return output.length > 0;
  } catch {
    return false;
  }
}

// ============================================================
// Local server management (spawn do Next.js)
// ============================================================

/**
 * Encontra o diretório do projeto LeadForge.
 * Ordem: env LEADFORGE_PATH → diretórios comuns no home.
 */
function findLeadForgeProject() {
  // 1. Variável de ambiente
  const envPath = process.env.LEADFORGE_PATH;
  if (envPath && fs.existsSync(path.join(envPath, '.next'))) {
    return envPath;
  }

  // 2. Diretórios comuns no home do usuário
  const home = require('os').homedir();
  const candidates = [
    path.join(home, 'leadforge'),
    path.join(home, 'LeadForge'),
    path.join(home, 'projects', 'leadforge'),
    path.join(home, 'dev', 'leadforge'),
    path.join(home, 'Documents', 'leadforge'),
    path.join(home, 'Área de Trabalho', 'leadforge'),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(path.join(candidate, '.next')) && fs.existsSync(path.join(candidate, 'package.json'))) {
      return candidate;
    }
  }

  return null;
}

async function startLocalServer() {
  const projectPath = findLeadForgeProject();

  if (!projectPath) {
    dialog.showMessageBox({
      type: 'error',
      title: 'LeadForge — Projeto não encontrado',
      message: 'Não encontrei a instalação do LeadForge no seu computador.',
      detail: `Procurei em:\n${path.join(require('os').homedir(), 'leadforge')}\n\nPara usar o modo local, defina a variável LEADFORGE_PATH ou instale o LeadForge no diretório padrão.\n\nOu use o modo "Servidor remoto" se você tem uma instância hospedada.`,
      buttons: ['OK'],
    });
    return false;
  }

  // Verifica se a porta já está em uso (pelo LeadForge ou por outro)
  if (isPortInUse(LEADFORGE_PORT)) {
    // Verifica se já é LeadForge rodando
    const isLeadForge = await checkLeadForgeHealth(LEADFORGE_LOCAL_URL);
    if (isLeadForge) {
      console.log('[LeadForge] Servidor já rodando em', LEADFORGE_LOCAL_URL);
      return true;
    }
    dialog.showMessageBox({
      type: 'warning',
      title: 'LeadForge — Porta ocupada',
      message: `A porta ${LEADFORGE_PORT} já está em uso por outro programa.`,
      detail: 'Feche o programa que está usando esta porta e tente novamente.',
      buttons: ['OK'],
    });
    return false;
  }

  // Inicia o servidor (next start na porta 4210)
  console.log('[LeadForge] Iniciando servidor em', projectPath);
  const isBun = fs.existsSync(path.join(projectPath, 'bun.lock'));

  serverProcess = spawn(
    isBun ? 'bun' : 'npx',
    isBun ? ['run', 'start'] : ['next', 'start', '--port', String(LEADFORGE_PORT)],
    {
      cwd: projectPath,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        PORT: String(LEADFORGE_PORT),
        NODE_ENV: 'production',
      },
    }
  );

  serverProcess.stdout.on('data', (data) => {
    console.log('[server]', data.toString().trim());
  });
  serverProcess.stderr.on('data', (data) => {
    console.error('[server]', data.toString().trim());
  });
  serverProcess.on('error', (err) => {
    console.error('[server] ERRO:', err.message);
  });

  // Aguarda o servidor subir (tenta health check por até 30 segundos)
  for (let i = 0; i < 30; i++) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    const ready = await checkLeadForgeHealth(LEADFORGE_LOCAL_URL);
    if (ready) {
      console.log('[LeadForge] Servidor pronto em', LEADFORGE_LOCAL_URL);
      return true;
    }
  }

  dialog.showMessageBox({
    type: 'error',
    title: 'LeadForge — Servidor não iniciou',
    message: 'O servidor LeadForge não respondeu dentro de 30 segundos.',
    detail: 'Verifique se o banco Supabase está acessível e se .env.local está configurado.',
    buttons: ['OK'],
  });
  return false;
}

function stopLocalServer() {
  if (serverProcess) {
    console.log('[LeadForge] Encerrando servidor...');
    serverProcess.kill('SIGTERM');
    serverProcess = null;
  }
}

// ============================================================
// Janela de configuração
// ============================================================

function showSetupWindow() {
  return new Promise((resolve) => {
    const win = new BrowserWindow({
      width: 540,
      height: 520,
      resizable: false,
      title: 'LeadForge — Configurar',
      autoHideMenuBar: true,
      icon: path.join(__dirname, 'icons', getIconFile()),
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
      },
    });

    win.loadFile(path.join(__dirname, 'renderer', 'setup.html'));

    const localHandler = () => {
      ipcMain.removeListener('leadforge:mode-local', localHandler);
      ipcMain.removeListener('leadforge:mode-remote', remoteHandler);
      win.close();
      resolve('local');
    };

    const remoteHandler = (_event, url) => {
      ipcMain.removeListener('leadforge:mode-local', localHandler);
      ipcMain.removeListener('leadforge:mode-remote', remoteHandler);
      win.close();
      resolve(url);
    };

    ipcMain.on('leadforge:mode-local', localHandler);
    ipcMain.on('leadforge:mode-remote', remoteHandler);
  });
}

// ============================================================
// Janela principal
// ============================================================

function getIconFile() {
  if (process.platform === 'win32') return 'icon.ico';
  if (process.platform === 'darwin') return 'icon.png';
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

  // links externos abrem no navegador do sistema
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
        {
          label: 'Trocar modo de conexão…',
          click: async () => {
            setMode(null); // força re-configuração
            app.relaunch();
            app.quit();
          },
        },
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

// ============================================================
// App lifecycle
// ============================================================

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

    let mode = getMode();
    let targetUrl = null;

    if (!mode) {
      // Primeira execução: mostra setup
      const result = await showSetupWindow();
      if (result === 'local') {
        setMode('local');
        targetUrl = LEADFORGE_LOCAL_URL;
      } else if (typeof result === 'string') {
        setMode('remote', result);
        targetUrl = result;
      } else {
        app.quit();
        return;
      }
    } else if (mode === 'local') {
      targetUrl = LEADFORGE_LOCAL_URL;
    } else if (mode === 'remote') {
      targetUrl = getRemoteUrl();
    }

    if (!targetUrl) {
      app.quit();
      return;
    }

    // Inicia servidor local se necessário
    if (mode === 'local') {
      const started = await startLocalServer();
      if (!started) {
        app.quit();
        return;
      }
      targetUrl = LEADFORGE_LOCAL_URL;
    } else {
      // Modo remoto: verifica que é LeadForge
      const isLeadForge = await checkLeadForgeHealth(targetUrl);
      if (!isLeadForge) {
        const choice = dialog.showMessageBoxSync({
          type: 'warning',
          title: 'LeadForge — Servidor não identificado',
          message: `A URL ${targetUrl} não parece ser um servidor LeadForge.`,
          detail: 'Deseja abrir mesmo assim?',
          buttons: ['Abrir mesmo assim', 'Reconfigurar', 'Sair'],
          defaultId: 1,
        });
        if (choice === 1) {
          setMode(null);
          app.relaunch();
          app.quit();
          return;
        } else if (choice === 2) {
          app.quit();
          return;
        }
      }
    }

    createMainWindow(targetUrl);

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createMainWindow(targetUrl);
      }
    });
  });

  app.on('before-quit', () => {
    stopLocalServer();
  });

  app.on('window-all-closed', () => {
    stopLocalServer();
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });
}
