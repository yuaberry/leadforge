/**
 * LEADFORGE Desktop — Electron main process
 *
 * App AUTOCONTIDO: o servidor Next.js (build standalone) viaja dentro do
 * pacote do app. O usuário instala o LeadForge e ele funciona — sem Node,
 * sem Bun, sem clonar o projeto, sem terminal.
 *
 * Dois modos:
 *   LOCAL  → sobe o servidor embutido (porta dedicada 4210) e abre a janela.
 *   REMOTO → conecta numa instância hospedada (URL verificada via /api/health).
 *
 * Configuração (Supabase URL/anon key, DATABASE_URL, chaves de provedores)
 * é coletada no primeiro uso e salva no userData do sistema — nunca no
 * código e nunca no repositório.
 */
const { app, BrowserWindow, dialog, Menu, shell, ipcMain } = require('electron');
const { spawn, execFile } = require('child_process');
const path = require('path');
const fs = require('fs');
const http = require('http');
const os = require('os');

const LEADFORGE_PORT = Number(process.env.LEADFORGE_PORT || 4210);
const LEADFORGE_LOCAL_URL = `http://127.0.0.1:${LEADFORGE_PORT}`;
const HEALTH_TIMEOUT = 5000;
const SERVER_BOOT_TIMEOUT = 60_000;

const SETTINGS_FILE = path.join(app.getPath('userData'), 'settings.json');
const LOG_FILE = path.join(app.getPath('userData'), 'leadforge-server.log');

let mainWindow = null;
let serverProcess = null;
/**
 * Verdadeiro enquanto o app troca a janela de setup pela janela principal.
 * Sem isso, o evento `window-all-closed` (disparado ao fechar a janela de
 * setup) encerraria o app antes da janela principal existir.
 */
let transitioning = false;

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
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2), { mode: 0o600 });
  try {
    fs.chmodSync(SETTINGS_FILE, 0o600);
  } catch {
    /* melhor esforço — em Windows o modo POSIX não se aplica */
  }
}

function getMode() {
  return loadSettings().mode || null; // 'local' | 'remote' | null (primeira vez)
}

function setMode(mode, url = null) {
  saveSettings({ ...loadSettings(), mode, ...(url ? { serverUrl: url } : {}) });
}

function getRemoteUrl() {
  return loadSettings().serverUrl || null;
}

function getConfig() {
  return loadSettings().config || {};
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

/**
 * Verifica se a porta está em uso sem depender de `lsof` (que não existe
 * no Windows). Usa bind em Node — portátil e confiável.
 */
function isPortInUse(port) {
  return new Promise((resolve) => {
    const net = require('net');
    const tester = net.createServer();
    tester.once('error', (err) => resolve(err.code === 'EADDRINUSE'));
    tester.once('listening', () => tester.close(() => resolve(false)));
    tester.listen(port, '127.0.0.1');
  });
}

// ============================================================
// Servidor local embutido
// ============================================================

/**
 * Localiza o servidor standalone empacotado.
 * - Em produção (app instalado): resources/app/server/server.js
 * - Em desenvolvimento: desktop/server/server.js (preparado por
 *   `npm run prepare:server`) ou o build standalone direto na raiz.
 */
function resolveServerEntry() {
  const candidates = app.isPackaged
    ? [path.join(process.resourcesPath, 'app', 'server', 'server.js')]
    : [
        // __dirname = <projeto>/desktop → server/ fica ao lado
        path.join(__dirname, 'server', 'server.js'),
        // fallback: build standalone direto na raiz do projeto
        path.join(__dirname, '..', '.next', 'standalone', 'leadforge', 'server.js'),
        path.join(__dirname, '..', '.next', 'standalone', 'server.js'),
      ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

/** Diretório de trabalho do servidor (onde ficam .env e node_modules). */
function resolveServerRoot(serverEntry) {
  return path.dirname(serverEntry);
}

/**
 * Monta o ambiente do servidor a partir da config salva pelo usuário.
 * As chaves server-only (SUPABASE_URL, DATABASE_URL, ...) são lidas em
 * RUNTIME pelo Next.js — por isso funcionam num app já instalado.
 */
function buildServerEnv(config) {
  const env = {
    ...process.env,
    NODE_ENV: 'production',
    PORT: String(LEADFORGE_PORT),
    HOSTNAME: '127.0.0.1',
    NEXT_PUBLIC_APP_URL: LEADFORGE_LOCAL_URL,
  };

  const map = {
    SUPABASE_URL: 'supabaseUrl',
    SUPABASE_ANON_KEY: 'supabaseAnonKey',
    SUPABASE_SERVICE_ROLE_KEY: 'supabaseServiceRoleKey',
    DATABASE_URL: 'databaseUrl',
    APP_ENCRYPTION_KEY: 'appEncryptionKey',
    LINK_TOKEN_SECRET: 'linkTokenSecret',
    CRON_SECRET: 'cronSecret',
    OPENROUTER_API_KEY: 'openrouterApiKey',
    AI_MODEL: 'aiModel',
    GOOGLE_PLACES_API_KEY: 'googlePlacesApiKey',
    RESEND_API_KEY: 'resendApiKey',
    EMAIL_FROM: 'emailFrom',
    WHATSAPP_TOKEN: 'whatsappToken',
    WHATSAPP_PHONE_NUMBER_ID: 'whatsappPhoneNumberId',
    WHATSAPP_VERIFY_TOKEN: 'whatsappVerifyToken',
    KIWIFY_WEBHOOK_SECRET: 'kiwifyWebhookSecret',
    KIRVANO_WEBHOOK_SECRET: 'kirvanoWebhookSecret',
    REDIS_URL: 'redisUrl',
  };

  for (const [envKey, configKey] of Object.entries(map)) {
    const value = config[configKey];
    if (typeof value === 'string' && value.trim() !== '') {
      env[envKey] = value.trim();
    }
  }

  // Derivados: se o usuário não informar, geramos segredos próprios.
  if (!env.LINK_TOKEN_SECRET) env.LINK_TOKEN_SECRET = env.APP_ENCRYPTION_KEY || randomSecret();
  if (!env.APP_ENCRYPTION_KEY) env.APP_ENCRYPTION_KEY = randomSecret();
  if (!env.CRON_SECRET) env.CRON_SECRET = randomSecret();

  return env;
}

function randomSecret() {
  return require('crypto').randomBytes(32).toString('hex');
}

function logServer(message) {
  const line = `[${new Date().toISOString()}] ${message}\n`;
  try {
    fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true });
    fs.appendFileSync(LOG_FILE, line);
  } catch {
    /* log é acessório — nunca derruba o app */
  }
  console.log('[server]', message.trim());
}

async function startLocalServer() {
  const serverEntry = resolveServerEntry();
  const config = getConfig();

  if (!serverEntry) {
    dialog.showMessageBox({
      type: 'error',
      title: 'LeadForge — Servidor não encontrado',
      message: 'O componente do servidor não está presente nesta instalação.',
      detail:
        'Reinstale o LeadForge pelo instalador oficial. Se o problema persists, ' +
        'baixe a versão mais recente em https://github.com/yuaberry/leadforge/releases.',
      buttons: ['OK'],
    });
    return false;
  }

  if (!config.supabaseUrl || !config.supabaseAnonKey || !config.databaseUrl) {
    dialog.showMessageBox({
      type: 'warning',
      title: 'LeadForge — Configuração incompleta',
      message: 'Faltam dados obrigatórios para iniciar o servidor local.',
      detail:
        'Abra "Configurar conexão…" no menu Arquivo para informar a URL do Supabase, ' +
        'a chave anônima e a DATABASE_URL.',
      buttons: ['OK'],
    });
    return false;
  }

  const portBusy = await isPortInUse(LEADFORGE_PORT);
  if (portBusy) {
    const isLeadForge = await checkLeadForgeHealth(LEADFORGE_LOCAL_URL);
    if (isLeadForge) {
      logServer(`Já existe uma instância LeadForge em ${LEADFORGE_LOCAL_URL}`);
      return true;
    }
    dialog.showMessageBox({
      type: 'warning',
      title: 'LeadForge — Porta ocupada',
      message: `A porta ${LEADFORGE_PORT} já está em uso por outro programa.`,
      detail:
        `Feche o programa que usa a porta ${LEADFORGE_PORT} e abra o LeadForge novamente. ` +
        'Se precisar, defina a variável LEADFORGE_PORT com outra porta.',
      buttons: ['OK'],
    });
    return false;
  }

  const serverRoot = resolveServerRoot(serverEntry);
  logServer(`Iniciando servidor embutido: ${serverEntry}`);

  // O binário do Electron roda como Node puro quando ELECTRON_RUN_AS_NODE=1.
  // Isso evita embutir um segundo runtime Node no pacote.
  const serverEnv = { ...buildServerEnv(config), ELECTRON_RUN_AS_NODE: '1' };

  serverProcess = spawn(process.execPath, [serverEntry], {
    cwd: serverRoot,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: serverEnv,
    windowsHide: true,
  });

  serverProcess.stdout.on('data', (data) => logServer(data.toString()));
  serverProcess.stderr.on('data', (data) => logServer(`[erro] ${data.toString()}`));
  serverProcess.on('error', (err) => logServer(`ERRO ao iniciar: ${err.message}`));
  serverProcess.on('exit', (code, signal) => {
    logServer(`Servidor encerrado (code=${code}, signal=${signal})`);
    serverProcess = null;
  });

  // Aguarda o health check
  const deadline = Date.now() + SERVER_BOOT_TIMEOUT;
  while (Date.now() < deadline) {
    if (await checkLeadForgeHealth(LEADFORGE_LOCAL_URL)) {
      logServer(`Servidor pronto em ${LEADFORGE_LOCAL_URL}`);
      return true;
    }
    if (!serverProcess) {
      break; // processo morreu — não adianta esperar
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  const logTail = readLogTail();
  dialog.showMessageBox({
    type: 'error',
    title: 'LeadForge — Servidor não iniciou',
    message: 'O servidor interno não respondeu a tempo.',
    detail:
      'Verifique se a DATABASE_URL está correta e se o banco já tem as migrations aplicadas.\n\n' +
      `Log do servidor:\n${logTail}`,
    buttons: ['OK'],
  });
  return false;
}

function readLogTail(maxBytes = 2000) {
  try {
    const stat = fs.statSync(LOG_FILE);
    const size = Math.min(stat.size, maxBytes);
    const fd = fs.openSync(LOG_FILE, 'r');
    const buffer = Buffer.alloc(size);
    fs.readSync(fd, buffer, 0, size, stat.size - size);
    fs.closeSync(fd);
    return buffer.toString('utf8');
  } catch {
    return '(sem log)';
  }
}

function stopLocalServer() {
  if (serverProcess) {
    logServer('Encerrando servidor...');
    try {
      serverProcess.kill('SIGTERM');
    } catch {
      /* já encerrado */
    }
    serverProcess = null;
  }
}

// ============================================================
// Janela de configuração
// ============================================================

function showSetupWindow(mode = 'first-run') {
  return new Promise((resolve) => {
    const win = new BrowserWindow({
      width: 620,
      height: 700,
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

    win.loadFile(path.join(__dirname, 'renderer', 'setup.html'), {
      query: { mode },
    });

    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      ipcMain.removeListener('leadforge:mode-local', localHandler);
      ipcMain.removeListener('leadforge:mode-remote', remoteHandler);
      ipcMain.removeListener('leadforge:save-config', configHandler);
      if (!win.isDestroyed()) win.close();
      resolve(value);
    };

    const localHandler = (_event, config) => {
      saveSettings({ ...loadSettings(), mode: 'local', config: sanitizeConfig(config) });
      transitioning = true;
      finish('local');
    };

    const remoteHandler = (_event, url) => {
      saveSettings({ ...loadSettings(), mode: 'remote', serverUrl: url });
      transitioning = true;
      finish(url);
    };

    const configHandler = (_event, config) => {
      saveSettings({ ...loadSettings(), config: sanitizeConfig(config) });
      finish({ reconfigured: true });
    };

    ipcMain.on('leadforge:mode-local', localHandler);
    ipcMain.on('leadforge:mode-remote', remoteHandler);
    ipcMain.on('leadforge:save-config', configHandler);

    win.on('closed', () => finish(null));
  });
}

/** Mantém apenas chaves conhecidas e strings — evita injeção de campos arbitrários. */
function sanitizeConfig(config) {
  const allowed = [
    'supabaseUrl',
    'supabaseAnonKey',
    'supabaseServiceRoleKey',
    'databaseUrl',
    'appEncryptionKey',
    'linkTokenSecret',
    'cronSecret',
    'openrouterApiKey',
    'aiModel',
    'googlePlacesApiKey',
    'resendApiKey',
    'emailFrom',
    'whatsappToken',
    'whatsappPhoneNumberId',
    'whatsappVerifyToken',
    'kiwifyWebhookSecret',
    'kirvanoWebhookSecret',
    'redisUrl',
  ];
  const out = {};
  if (!config || typeof config !== 'object') return out;
  for (const key of allowed) {
    if (typeof config[key] === 'string' && config[key].trim() !== '') {
      out[key] = config[key].trim();
    }
  }
  return out;
}

// ============================================================
// Janela principal
// ============================================================

function getIconFile() {
  if (process.platform === 'win32') return 'icon.ico';
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

  // nunca navega para fora da própria app
  mainWindow.webContents.on('will-navigate', (event, targetUrl) => {
    if (!targetUrl.startsWith(url)) {
      event.preventDefault();
      shell.openExternal(targetUrl);
    }
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
          label: 'Configurar conexão…',
          click: async () => {
            const result = await showSetupWindow('reconfigure');
            if (result && result.reconfigured) {
              app.relaunch();
              app.quit();
            }
          },
        },
        {
          label: 'Trocar modo de conexão…',
          click: async () => {
            await showSetupWindow('reconfigure');
            app.relaunch();
            app.quit();
          },
        },
        { type: 'separator' },
        {
          label: 'Abrir log do servidor',
          click: () => shell.openPath(LOG_FILE),
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
              message: `LeadForge v${app.getVersion()}`,
              detail:
                'Find. Qualify. Personalize. Convert.\n\n' +
                'Plataforma de inteligência comercial e conquista financeira digital.\n\n' +
                '© 2026 Yua Devs — Todos os direitos reservados.',
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
      const result = await showSetupWindow('first-run');
      if (result === 'local') {
        targetUrl = LEADFORGE_LOCAL_URL;
      } else if (typeof result === 'string' && result !== null) {
        targetUrl = result;
      } else {
        // Usuário cancelou — encerra o app.
        transitioning = false;
        app.quit();
        return;
      }
      mode = getMode();
    } else if (mode === 'local') {
      targetUrl = LEADFORGE_LOCAL_URL;
    } else if (mode === 'remote') {
      targetUrl = getRemoteUrl();
    }

    if (!targetUrl) {
      app.quit();
      return;
    }

    if (mode === 'local') {
      const started = await startLocalServer();
      if (!started) {
        transitioning = false;
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
    // A janela principal existe — a troca de setup → principal terminou.
    transitioning = false;

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
    // Durante a troca setup → principal, não encerra o app.
    if (transitioning) return;
    stopLocalServer();
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });
}
