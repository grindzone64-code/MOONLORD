const fs = require('fs');
const path = require('path');
const Module = require('module');

// 🛠️ Ensure local node_modules and bin directories are always discoverable across dev & packaged builds
const appNodeModules = path.join(__dirname, 'node_modules');
if (fs.existsSync(appNodeModules)) {
  process.env.NODE_PATH = `${appNodeModules}${path.delimiter}${process.env.NODE_PATH || ''}`;
  if (typeof Module._initPaths === 'function') Module._initPaths();
}

const binDir = path.join(__dirname, 'bin');
if (fs.existsSync(binDir)) {
  process.env.PATH = `${binDir}${path.delimiter}${process.env.PATH || ''}`;
}
try {
  require('./utils/ensureYtdl').ensureYtdl();
} catch (e) {}

// 🛠️ Ensure bundled ffmpeg is in PATH immediately for both node and electron modes
try {
  const ffmpegStatic = require('ffmpeg-static');
  if (ffmpegStatic) {
    const ffmpegDir = path.dirname(ffmpegStatic);
    process.env.PATH = `${ffmpegDir}${path.delimiter}${process.env.PATH || ''}`;
    console.log('[index] Bundled ffmpeg added to PATH:', ffmpegDir);
  }
} catch (e) {}

// 🛠️ Preload encryption and opus engine for reliable VC music streaming
try {
  const sodium = require('libsodium-wrappers');
  if (sodium && sodium.ready) {
    sodium.ready.then(() => {
      try {
        const secretbox = require('./node_modules/discord.js-selfbot-v13/src/client/voice/util/Secretbox');
        secretbox.methods = {
          crypto_aead_xchacha20poly1305_ietf_encrypt: (plaintext, additionalData, nonce, key) =>
            sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(plaintext, additionalData, null, nonce, key),
          crypto_aead_xchacha20poly1305_ietf_decrypt: (plaintext, additionalData, nonce, key) =>
            sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(null, plaintext, additionalData, nonce, key),
        };
        console.log('[index] Secretbox encryption explicitly initialized with libsodium-wrappers.');
      } catch (sbErr) {}
    });
  }
} catch (e) {}
try {
  require('opusscript');
  console.log('[index] opusscript engine verified.');
} catch (e) {}

// 🛠️ EXE Fix: Define global File and Blob for undici compatibility
if (typeof global.File === 'undefined') {
  const { File, Blob } = require('buffer');
  global.File = File;
  global.Blob = Blob;
}

// 🛠️ EXE Fix: Polyfill String.prototype.toWellFormed for older Node.js runtimes (Node 18)
if (typeof String.prototype.toWellFormed !== 'function') {
  String.prototype.toWellFormed = function () {
    return this.replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(^|[^\uD800-\uDBFF])[\uDC00-\uDFFF]/g, (match) => {
      return match.length === 1 ? '\uFFFD' : match;
    });
  };
}

const Discord = require('discord.js-selfbot-v13');
global.Discord = Discord;

// 🔇 Aggressive warning suppressor for discord.js-selfbot-v13
const originalEmitWarning = process.emitWarning;
process.emitWarning = function(warning, ...args) {
    if (typeof warning === 'string' && warning.includes('Intents')) return;
    if (warning instanceof Error && warning.message.includes('Intents')) return;
    return originalEmitWarning.call(process, warning, ...args);
};

let config = require('./config/config');
try {
  const extConfigPath = path.join(process.cwd(), 'config.js');
  if (fs.existsSync(extConfigPath)) {
    const ext = require(extConfigPath);
    config = { ...config, ...ext };
  }
} catch (e) {}
global.config = config;

const WebServer = require('./utils/webServer');

const webServer = new WebServer();
const PORT = process.env.PORT || 5000;
webServer.start(PORT);
global.webServer = webServer;

const crashLogPath = path.join(process.cwd(), 'crash.log');
function logCrash(msg) {
  const timestamp = new Date().toISOString();
  fs.appendFileSync(crashLogPath, `[${timestamp}] ${msg}\n`);
  console.error(msg);
}

/* 🔥 GLOBAL BOTS ARRAY — always defined so the Token Manager can hot-add units */
global.bots = [];
global.initializeClient = initializeClient;

/* 🔧 CLIENT SETUP (top-level so it's always available, even with zero tokens) */
function initializeClient(client, token, index) {
  client.config = config;

  // Lavalink v4 Client Integration (node.bgcrazy.in:25575)
  try {
    const { Rainlink, Library } = require('rainlink');
    const nodes = global.config?.nodes || [
      {
        name: 'bgcrazy-node',
        host: 'node.bgcrazy.in',
        port: 25575,
        auth: 'Mark1234',
        secure: false,
        driver: 'lavalink/v4'
      }
    ];

    const lib = new Library.DiscordJS(client);
    const rainlink = new Rainlink({
      library: lib,
      nodes
    });

    rainlink.on('nodeConnect', (node) => {
      console.log(`[Client ${index}] [Lavalink] Connected to Lavalink v4 node: ${node.options.name} (${node.options.host}:${node.options.port})`);
    });

    rainlink.on('nodeError', (node, err) => {
      console.warn(`[Client ${index}] [Lavalink] Node notice (${node.options.name}):`, err.message);
    });

    rainlink.on('trackStart', (player, track) => {
      console.log(`[Client ${index}] [Lavalink] Now Playing: "${track.title}" in VC ${player.voiceId}`);
    });

    rainlink.on('trackEnd', (player, track) => {
      console.log(`[Client ${index}] [Lavalink] Track finished: "${track.title}"`);
    });

    const triggerReady = () => {
      try {
        lib.ready(rainlink.rainlinkOptions.nodes);
      } catch (e) {}
    };

    if (client.isReady()) {
      triggerReady();
    } else {
      client.once('ready', triggerReady);
    }

    client.rainlink = rainlink;
  } catch (lavalinkErr) {
    console.warn(`[Client ${index}] Lavalink setup notice:`, lavalinkErr.message);
  }

  /* ✅ READY EVENT + RPC */
  client.on('ready', async () => {
    console.log(`[Client ${index}] Logged in as ${client.user.tag}`);
    try {
      await client.user.setPresence({ activities: [], status: 'online' });
    } catch (e) { }
  });

  // 🚩 DEBUG LOGS AS REQUESTED
  client.on('debug', (info) => {
    if (info.toLowerCase().includes('voice')) {
      console.log(`[Client ${index}] [DISCORD DEBUG] ${info}`);
    }
  });

  // 🚶 Auto-follow Owner Voice State
  client.on('voiceStateUpdate', async (oldState, newState) => {
    if (!global.followOwner) return;
    const ownerId = (global.config?.allowedUserIds || [])[0];
    if (!ownerId || newState.id !== ownerId) return;

    const nativePlayer = require('./utils/nativePlayer');
    if (newState.channelId && newState.channelId !== oldState?.channelId) {
      try {
        const ch = newState.channel || await client.channels.fetch(newState.channelId).catch(() => null);
        if (ch) {
          await nativePlayer.joinChannel({ client, index }, ch).catch(() => {});
        }
      } catch (e) {}
    } else if (!newState.channelId && oldState?.channelId) {
      try {
        nativePlayer.disconnect({ client, index });
      } catch (e) {}
    }
  });
}

/* 🔥 LOAD TOKENS FROM tokens.txt (optional — the Token Manager can add them later) */
function resolveTokensFile() {
  const dirs = [
    process.env.PORTABLE_EXECUTABLE_DIR,
    process.cwd(),
    __dirname
  ].filter(Boolean);

  for (const d of dirs) {
    const p = path.join(d, 'tokens.txt');
    if (fs.existsSync(p)) return p;
  }
  return path.join(process.env.PORTABLE_EXECUTABLE_DIR || process.cwd(), 'tokens.txt');
}

const tokenPath = resolveTokensFile();
let tokens = [];
try {
  if (fs.existsSync(tokenPath)) {
    tokens = fs.readFileSync(tokenPath, 'utf8')
      .split(/\r?\n/)
      .map(t => t.trim())
      .filter(Boolean);
  }
} catch (e) {
  logCrash('[SYSTEM] Could not read tokens.txt: ' + e.message);
}

if (tokens.length === 0) {
  console.log('[SYSTEM] No tokens loaded yet. Add them via the Token Manager in the dashboard.');
} else {
  console.log(`[SYSTEM] Loaded ${tokens.length} tokens.`);

  /* 🔁 START CLIENTS */
  tokens.forEach((token, index) => {
    console.log(`[SYSTEM] Preparing and logging in client ${index}...`);

    const client = new Discord.Client({
      readyStatus: false,
      checkUpdate: false,
      intents: ['GUILDS', 'GUILD_VOICE_STATES', 'GUILD_MESSAGES'],
      partials: ['CHANNEL', 'MESSAGE']
    });

    global.bots.push({ client, token, index });
    initializeClient(client, token, index);
    client.login(token).catch(err => {
      console.error(`[SYSTEM] Client #${index} auto-login failed:`, err.message);
    });
  });
}

/* 🛡️ GLOBAL ERROR HANDLERS */
process.on('unhandledRejection', (reason, promise) => {
  logCrash(`[SYSTEM] Unhandled Rejection at: ${promise} reason: ${reason}`);
});

process.on('uncaughtException', (err, origin) => {
  logCrash(`[SYSTEM] Uncaught Exception: ${err.message}\n${err.stack}`);
});