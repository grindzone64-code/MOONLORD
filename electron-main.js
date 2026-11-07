// ============================================================
//  MOON LORD Control Unit — Electron desktop shell
//  Wraps the existing Node/Express bot backend + Lavalink in a
//  native single-window app. No console, no external browser,
//  no separate run_lavalink.bat — the music server auto-starts.
// ============================================================

const { app, BrowserWindow, Menu, dialog, shell } = require('electron');
const { fork, spawn } = require('child_process');
const path = require('path');
const http = require('http');
const fs = require('fs');

const PORT = 5000;
const APP_URL = `http://localhost:${PORT}`;

let mainWindow = null;
let backend = null;
let backendExited = false;

// Resolved after app is ready (paths depend on packaged vs dev).
let RUNTIME_DIR = __dirname;   // where tokens.txt / audios / crash.log live

function resolvePaths() {
    // Packaged: keep user-writable files in userData (no admin needed, survives updates).
    if (app.isPackaged) {
        RUNTIME_DIR = process.env.PORTABLE_EXECUTABLE_DIR || app.getPath('userData');
    } else {
        RUNTIME_DIR = __dirname;
    }
    try { fs.mkdirSync(RUNTIME_DIR, { recursive: true }); } catch { }
}

// ------------------------------------------------------------
// Loading screen shown until the backend web server is ready
// ------------------------------------------------------------
const LOADING_HTML = `
<!DOCTYPE html><html><head><meta charset="utf-8">
<style>
  html,body{height:100%;margin:0;background:#07080A;color:#EDEFF2;
    font-family:'Segoe UI',system-ui,sans-serif;overflow:hidden}
  .wrap{height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:24px}
  .stripe{width:150px;height:3px;border-radius:2px;
    background:linear-gradient(90deg,#3C9BE0 0 33.33%,#1B4FA0 33.33% 66.66%,#E7222E 66.66% 100%)}
  .title{font-size:18px;font-weight:800;letter-spacing:.28em;text-transform:uppercase}
  .sub{font-family:Consolas,monospace;font-size:11px;letter-spacing:.24em;
    text-transform:uppercase;color:#6B7280}
  .ring{width:44px;height:44px;border:3px solid rgba(255,255,255,.12);
    border-top-color:#2E8FE0;border-radius:50%;animation:spin .8s linear infinite}
  @keyframes spin{to{transform:rotate(360deg)}}
</style></head>
<body><div class="wrap">
  <div class="stripe"></div>
  <div class="ring"></div>
  <div class="title">MOON LORD</div>
  <div class="sub">Igniting Control Unit&hellip;</div>
</div></body></html>`;

// ------------------------------------------------------------
// Poll the local server until it responds, then load the UI
// ------------------------------------------------------------
function waitForServer(attempt = 0) {
    if (!mainWindow) return;
    const req = http.get(APP_URL + '/login', (res) => {
        res.destroy();
        if (mainWindow) mainWindow.loadURL(APP_URL);
    });
    req.setTimeout(1500, () => req.destroy());
    req.on('error', () => {
        if (backendExited) return;            // backend died — dialog handles it
        if (attempt > 120) {                  // ~60s hard cap
            showBackendError('The control unit did not start in time.');
            return;
        }
        setTimeout(() => waitForServer(attempt + 1), 500);
    });
}

function showBackendError(detail) {
    dialog.showMessageBoxSync({
        type: 'error',
        title: 'MOON LORD — Startup Failed',
        message: 'The bot backend could not start.',
        detail: (detail || '') + '\n\nCheck crash.log in the app data folder for details.',
        buttons: ['Quit']
    });
    app.quit();
}

// ------------------------------------------------------------
// Start the existing Node backend (index.js) in-process
// ------------------------------------------------------------
function startBackend() {
    try {
        console.log('[main] Initializing MOON LORD backend in-process...');
        process.env.ELECTRON_RUN = '1';

        // Add node_modules and bin to NODE_PATH and PATH before anything else
        const appNodeModules = path.join(__dirname, 'node_modules');
        if (fs.existsSync(appNodeModules)) {
            process.env.NODE_PATH = `${appNodeModules}${path.delimiter}${process.env.NODE_PATH || ''}`;
            const Module = require('module');
            if (typeof Module._initPaths === 'function') Module._initPaths();
        }

        const binDir = path.join(__dirname, 'bin');
        if (fs.existsSync(binDir)) {
            process.env.PATH = `${binDir}${path.delimiter}${process.env.PATH || ''}`;
        }

        // Add ffmpeg-static directory to PATH so prism-media and any spawn find ffmpeg immediately
        try {
            const ffmpegStatic = require('ffmpeg-static');
            if (ffmpegStatic) {
                const ffmpegDir = path.dirname(ffmpegStatic);
                process.env.PATH = `${ffmpegDir}${path.delimiter}${process.env.PATH || ''}`;
                console.log('[main] Bundled ffmpeg added to PATH:', ffmpegDir);
            }
        } catch (e) { }

        require('./index.js');
        console.log('[main] Bot backend initialized successfully.');
    } catch (err) {
        console.error('[main] Bot backend startup error:', err);
        showBackendError((err.message || 'Unknown startup error') + '\n\n' + (err.stack || ''));
    }
}

// ------------------------------------------------------------
// Main window
// ------------------------------------------------------------
function createWindow() {
    resolvePaths();

    mainWindow = new BrowserWindow({
        width: 1440,
        height: 920,
        minWidth: 1024,
        minHeight: 680,
        backgroundColor: '#07080A',
        title: 'MOON LORD Control Unit',
        icon: path.join(__dirname, 'build', process.platform === 'win32' ? 'icon.ico' : 'icon.png'),
        show: false,
        autoHideMenuBar: true,
        webPreferences: {
            contextIsolation: true,
            nodeIntegration: false
        }
    });

    Menu.setApplicationMenu(null);

    mainWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(LOADING_HTML));
    mainWindow.once('ready-to-show', () => mainWindow.show());

    // External links open in the system browser, not new app windows
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        if (url.startsWith('http://localhost')) return { action: 'allow' };
        shell.openExternal(url);
        return { action: 'deny' };
    });

    mainWindow.on('closed', () => { mainWindow = null; });

    startBackend();
    waitForServer();
}

// Single-instance lock — focus existing window instead of opening a second
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

    app.whenReady().then(createWindow);

    app.on('window-all-closed', () => {
        (global.bots || []).forEach(b => {
            try { b.client?.destroy(); } catch { }
        });
        app.quit();
    });

    app.on('before-quit', () => {
        (global.bots || []).forEach(b => {
            try { b.client?.destroy(); } catch { }
        });
    });
}
