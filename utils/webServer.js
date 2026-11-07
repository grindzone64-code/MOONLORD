const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const bodyParser = require('body-parser');
const nativePlayer = require('./nativePlayer');

class WebServer {
    constructor() {
        this.app = express();
        this.server = null;
        this.port = 5000;
        this.setupMiddleware();
        this.setupRoutes();
    }

    setupMiddleware() {
        // Universal CORS headers for Android WebView, local files, and mobile gateways
        this.app.use((req, res, next) => {
            res.header('Access-Control-Allow-Origin', '*');
            res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
            res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, x-license-key, x-device-id, bypass-tunnel-reminder, *');
            if (req.method === 'OPTIONS') {
                return res.sendStatus(200);
            }
            next();
        });
        this.app.use(cors({
            origin: '*',
            methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
            allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Authorization', 'x-license-key', 'x-device-id', 'bypass-tunnel-reminder', '*']
        }));
        this.app.use(bodyParser.json());
        this.app.use(bodyParser.urlencoded({ extended: true }));

        const publicPath = path.join(__dirname, '..', 'public');
        this.app.use(express.static(publicPath));
    }

    getLicenseKey(req) {
        const raw = (req && (
            req.headers['x-license-key'] ||
            req.headers['x-client-id'] ||
            req.headers['x-device-id'] ||
            req.query?.license_key ||
            req.query?.client_id ||
            req.query?.device_id ||
            req.body?.license_key ||
            req.body?.client_id ||
            req.body?.device_id
        )) || '';
        let trimmed = String(raw).trim();
        if (trimmed && trimmed !== 'null' && trimmed !== 'undefined' && trimmed !== 'license-user' && trimmed !== 'mobile') {
            return trimmed.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64);
        }
        // If no explicit license/client-id is provided or generic 'mobile' was sent, isolate by client IP
        const clientIp = (req && (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || ''))
            .split(',')[0].trim().replace(/[^a-zA-Z0-9]/g, '');
        if (clientIp) {
            return `ip_${clientIp}`.slice(0, 64);
        }
        return 'default_fleet';
    }

    getLicenseTokenPath(lic) {
        const baseDir = process.env.PORTABLE_EXECUTABLE_DIR || process.cwd();
        const dataDir = path.join(baseDir, 'data');
        if (!fs.existsSync(dataDir)) {
            try { fs.mkdirSync(dataDir, { recursive: true }); } catch (e) {}
        }
        return path.join(dataDir, `tokens_${lic}.txt`);
    }

    getBotPool(req) {
        const lic = this.getLicenseKey(req);
        if (!lic) {
            return global.bots || [];
        }
        if (!global.licenseBotPools) {
            global.licenseBotPools = new Map();
        }
        if (!global.licenseBotPools.has(lic)) {
            const tokenFile = this.getLicenseTokenPath(lic);
            const botList = [];
            let tokens = [];
            try {
                if (fs.existsSync(tokenFile)) {
                    tokens = fs.readFileSync(tokenFile, 'utf8').split(/\r?\n/).map(t => t.trim()).filter(Boolean);
                }
            } catch (e) {}

            tokens.forEach((token, index) => {
                if (global.Discord && typeof global.initializeClient === 'function') {
                    try {
                        const client = new global.Discord.Client({
                            readyStatus: false,
                            checkUpdate: false,
                            intents: ['GUILDS', 'GUILD_VOICE_STATES', 'GUILD_MESSAGES'],
                            partials: ['CHANNEL', 'MESSAGE']
                        });
                        const botEntry = { client, token, index, license: lic };
                        botList.push(botEntry);
                        global.initializeClient(client, token, index);
                        client.login(token).catch(err => {
                            console.error(`[License ${lic}] Unit #${index} login failed:`, err.message);
                        });
                    } catch (e) {}
                }
            });
            global.licenseBotPools.set(lic, botList);
        }
        return global.licenseBotPools.get(lic);
    }

    getTargetBots(targetBot, targetBots, req = null) {
        const pool = req ? this.getBotPool(req) : [];
        const bots = pool.filter(b => b.client && b.client.isReady());
        if (Array.isArray(targetBots) && targetBots.length > 0) {
            const filtered = bots.filter(b => targetBots.includes(String(b.index)) || targetBots.includes(Number(b.index)));
            if (filtered.length > 0) return filtered;
        }
        if (targetBot && targetBot !== 'all' && targetBot !== 'none') {
            const filtered = bots.filter(b => String(b.index) === String(targetBot));
            if (filtered.length > 0) return filtered;
        }
        return bots;
    }

    setupRoutes() {
        const publicPath = path.join(__dirname, '..', 'public');
        const audiosPath = path.join(process.cwd(), 'audios');
        const videosPath = path.join(process.cwd(), 'videos');

        try { fs.mkdirSync(audiosPath, { recursive: true }); } catch (e) {}
        try { fs.mkdirSync(videosPath, { recursive: true }); } catch (e) {}

        // Landing / login routes
        this.app.get('/login', (req, res) => {
            res.sendFile(path.join(publicPath, 'login.html'));
        });

        this.app.get('/', (req, res) => {
            res.sendFile(path.join(publicPath, 'index.html'));
        });

        // Basic login handler
        this.app.post('/api/login', (req, res) => {
            const { username, password, user, pass } = req.body;
            const u = username || user;
            const p = password || pass;
            const cfg = global.config || {};
            if ((!cfg.webUsername || u === cfg.webUsername) &&
                (!cfg.webPassword || p === cfg.webPassword)) {
                return res.json({ status: 'success', success: true, message: 'Authenticated' });
            }
            return res.status(401).json({ status: 'error', success: false, message: 'Invalid credentials' });
        });

        // KeyAuth App Configuration & Endpoints
        const KEYAUTH_APP = {
            name: 'DASGBORD',
            ownerid: '1388070974',
            secret: 'da095803867833b2eb776f77dbe33a438c65565a49bf3bdccce9f51f5875a982',
            version: '1.0',
            apiUrl: 'https://ghostcorporation.shop/api/1.2/'
        };

        const callKeyAuth = (params) => {
            const querystring = require('querystring');
            const https = require('https');
            const body = querystring.stringify({
                name: KEYAUTH_APP.name,
                ownerid: KEYAUTH_APP.ownerid,
                ...params
            });
            return new Promise((resolve, reject) => {
                const u = new URL(KEYAUTH_APP.apiUrl);
                const req = https.request({
                    hostname: u.hostname,
                    path: u.pathname + u.search,
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'Content-Length': Buffer.byteLength(body),
                        'User-Agent': 'KeyAuth'
                    }
                }, resp => {
                    let data = '';
                    resp.on('data', chunk => data += chunk);
                    resp.on('end', () => {
                        try { resolve(JSON.parse(data)); } catch (e) { resolve({ success: false, message: data }); }
                    });
                });
                req.on('error', reject);
                req.write(body);
                req.end();
            });
        };

        this.app.post('/api/keyauth/init', async (req, res) => {
            try {
                const data = await callKeyAuth({
                    type: 'init',
                    secret: KEYAUTH_APP.secret,
                    ver: KEYAUTH_APP.version
                });
                res.json(data);
            } catch (err) {
                res.json({ success: false, message: err.message });
            }
        });

        this.app.post('/api/keyauth/license', async (req, res) => {
            try {
                const { key, hwid, sessionid } = req.body;
                let sid = sessionid;
                if (!sid) {
                    const initRes = await callKeyAuth({
                        type: 'init',
                        secret: KEYAUTH_APP.secret,
                        ver: KEYAUTH_APP.version
                    });
                    if (!initRes.success) return res.json(initRes);
                    sid = initRes.sessionid;
                }
                const data = await callKeyAuth({
                    type: 'license',
                    key: (key || '').trim(),
                    hwid: (hwid || '').trim(),
                    sessionid: sid
                });
                res.json(data);
            } catch (err) {
                res.json({ success: false, message: err.message });
            }
        });

        this.app.post('/api/keyauth/login', async (req, res) => {
            try {
                const { username, password, hwid, sessionid } = req.body;
                let sid = sessionid;
                if (!sid) {
                    const initRes = await callKeyAuth({
                        type: 'init',
                        secret: KEYAUTH_APP.secret,
                        ver: KEYAUTH_APP.version
                    });
                    if (!initRes.success) return res.json(initRes);
                    sid = initRes.sessionid;
                }
                const data = await callKeyAuth({
                    type: 'login',
                    username: (username || '').trim(),
                    pass: password,
                    hwid: (hwid || '').trim(),
                    sessionid: sid
                });
                res.json(data);
            } catch (err) {
                res.json({ success: false, message: err.message });
            }
        });

        this.app.post('/api/keyauth/register', async (req, res) => {
            try {
                const { username, password, key, hwid, sessionid } = req.body;
                let sid = sessionid;
                if (!sid) {
                    const initRes = await callKeyAuth({
                        type: 'init',
                        secret: KEYAUTH_APP.secret,
                        ver: KEYAUTH_APP.version
                    });
                    if (!initRes.success) return res.json(initRes);
                    sid = initRes.sessionid;
                }
                const data = await callKeyAuth({
                    type: 'register',
                    username: (username || '').trim(),
                    pass: password,
                    key: (key || '').trim(),
                    hwid: (hwid || '').trim(),
                    sessionid: sid
                });
                res.json(data);
            } catch (err) {
                res.json({ success: false, message: err.message });
            }
        });

        // Stats endpoint
        this.app.get('/api/stats', (req, res) => {
            const bots = this.getBotPool(req);
            const onlineCount = bots.filter(b => b.client?.isReady()).length;
            res.json({
                status: 'success',
                total_tokens: bots.length,
                online_bots: onlineCount,
                guilds: bots.reduce((acc, b) => acc + (b.client?.guilds?.cache?.size || 0), 0),
                bots: bots.map(b => ({
                    index: b.index,
                    tag: b.client?.user?.tag || `Unit #${b.index}`,
                    online: b.client?.isReady() || false
                }))
            });
        });

        // Logs endpoint
        this.app.get('/api/logs', (req, res) => {
            res.json({
                status: 'success',
                logs: [
                    '<div class="log-entry system">[SYSTEM] MOON LORD Control Unit initialized.</div>\n',
                    '<div class="log-entry system">[SYSTEM] Ready for operator commands.</div>\n'
                ]
            });
        });

        // Fleet Start / Stop
        this.app.post('/api/start', (req, res) => {
            const bots = this.getBotPool(req);
            let started = 0;
            bots.forEach(b => {
                if (!b.client?.isReady() && b.token) {
                    started++;
                    b.client.login(b.token).catch(e => {
                        console.error(`[Start All] Login error for #${b.index}:`, e.message);
                    });
                }
            });
            res.json({ status: 'success', message: `Ignited ${started} offline unit(s)` });
        });

        this.app.post('/api/stop', (req, res) => {
            const bots = this.getBotPool(req);
            let stopped = 0;
            bots.forEach(b => {
                if (b.client?.isReady()) {
                    stopped++;
                    try { b.client.destroy(); } catch (e) {}
                }
            });
            res.json({ status: 'success', message: `Stopped ${stopped} unit(s)` });
        });

        // Voice Channels Scanner
        this.app.post('/api/voice/channels', async (req, res) => {
            const guildId = (req.body.guildId || '').trim();
            const bots = this.getBotPool(req).filter(b => b.client && b.client.isReady());
            if (bots.length === 0) {
                return res.json({
                    status: 'success',
                    channels: [],
                    message: 'No online bot in fleet. Start a bot first.'
                });
            }

            const channels = [];

            if (guildId) {
                // Check if guildId is a Guild ID
                let foundGuild = null;
                let ableToJoinBots = 0;

                for (const b of bots) {
                    let g = b.client.guilds.cache.get(guildId);
                    if (!g) {
                        try {
                            g = await b.client.guilds.fetch(guildId).catch(() => null);
                        } catch (e) {}
                    }
                    if (g) {
                        if (!foundGuild) foundGuild = g;
                        ableToJoinBots++;
                    }
                }

                if (foundGuild) {
                    try {
                        await foundGuild.channels.fetch().catch(() => {});
                    } catch (e) {}

                    foundGuild.channels.cache.forEach(ch => {
                        const isVoice = ch.type === 'GUILD_VOICE' || ch.type === 2 || ch.type === 'GUILD_STAGE_VOICE' || ch.type === 13 || (typeof ch.isVoice === 'function' && ch.isVoice());
                        if (isVoice) {
                            channels.push({
                                id: ch.id,
                                name: ch.name || 'Voice Channel',
                                guildName: foundGuild.name,
                                canJoinCount: ableToJoinBots
                            });
                        }
                    });
                } else {
                    // Maybe the user entered a Voice Channel ID directly instead of a Guild ID!
                    for (const b of bots) {
                        let ch = b.client.channels.cache.get(guildId);
                        if (!ch) {
                            try {
                                ch = await b.client.channels.fetch(guildId).catch(() => null);
                            } catch (e) {}
                        }
                        if (ch) {
                            const isVoice = ch.type === 'GUILD_VOICE' || ch.type === 2 || ch.type === 'GUILD_STAGE_VOICE' || ch.type === 13 || (typeof ch.isVoice === 'function' && ch.isVoice());
                            if (isVoice) {
                                channels.push({
                                    id: ch.id,
                                    name: ch.name || 'Voice Channel',
                                    guildName: ch.guild?.name || 'Server',
                                    canJoinCount: 1
                                });
                                break;
                            }
                        }
                    }

                    if (channels.length === 0) {
                        return res.json({
                            status: 'success',
                            channels: [],
                            message: `No bot is currently in Server / Channel ID ${guildId}. Please invite the bot or check the ID.`
                        });
                    }
                }
            } else {
                // If no Guild ID provided, scan all guilds the fleet bots belong to
                const seenChannelIds = new Set();
                for (const b of bots) {
                    for (const g of b.client.guilds.cache.values()) {
                        try {
                            await g.channels.fetch().catch(() => {});
                        } catch (e) {}
                        g.channels.cache.forEach(ch => {
                            const isVoice = ch.type === 'GUILD_VOICE' || ch.type === 2 || ch.type === 'GUILD_STAGE_VOICE' || ch.type === 13 || (typeof ch.isVoice === 'function' && ch.isVoice());
                            if (isVoice && !seenChannelIds.has(ch.id)) {
                                seenChannelIds.add(ch.id);
                                channels.push({
                                    id: ch.id,
                                    name: `[${g.name}] ${ch.name}`,
                                    guildName: g.name,
                                    canJoinCount: bots.filter(bot => bot.client.guilds.cache.has(g.id)).length
                                });
                            }
                        });
                    }
                }
            }

            channels.sort((a, b) => a.name.localeCompare(b.name));

            res.json({
                status: 'success',
                channels,
                message: channels.length === 0 ? 'No voice channels found.' : `Found ${channels.length} voice channel(s)`
            });
        });

        // Voice Join Handler - Supports single bot by default, or multi-bot when explicitly targeted
        this.app.post('/api/music/join', async (req, res) => {
            const { type, channel_id, owner_id, deaf, mute, targetBot, targetBots, allBots, syncFleet } = req.body;
            let bots = this.getTargetBots(targetBot, targetBots, req);
            if (bots.length === 0) {
                return res.json({ status: 'error', message: 'No online bots available. Please start bot(s) first.' });
            }

            // Enforce single bot join unless explicitly requested as multi-bot
            const isMulti = (Array.isArray(targetBots) && targetBots.length > 1) || allBots === true || syncFleet === true;
            if (!isMulti) {
                if (targetBot && targetBot !== 'all' && targetBot !== 'none') {
                    const specific = bots.find(b => String(b.index) === String(targetBot));
                    bots = [specific || bots[0]];
                } else if (Array.isArray(targetBots) && targetBots.length === 1) {
                    const specific = bots.find(b => String(b.index) === String(targetBots[0]));
                    bots = [specific || bots[0]];
                } else {
                    bots = [bots[0]];
                }
            }

            // 1. Resolve channel ID across targeted bot(s) if type === 'owner'
            let resolvedChannelId = channel_id || null;
            if (type === 'owner' && !resolvedChannelId) {
                const targetOwnerId = (owner_id || req.headers['x-discord-owner-id'] || (global.config?.allowedUserIds || [])[0] || '').trim();
                if (targetOwnerId && targetOwnerId !== 'YOUR_DISCORD_USER_ID') {
                    for (const b of bots) {
                        for (const g of b.client.guilds.cache.values()) {
                            const ovs = g.voiceStates?.cache?.get(targetOwnerId);
                            if (ovs?.channel?.id) {
                                resolvedChannelId = ovs.channel.id;
                                break;
                            }
                            const m = g.members?.cache?.get(targetOwnerId);
                            if (m?.voice?.channel?.id) {
                                resolvedChannelId = m.voice.channel.id;
                                break;
                            }
                        }
                        if (resolvedChannelId) break;
                    }
                }
                if (!resolvedChannelId) {
                    return res.json({
                        status: 'error',
                        message: targetOwnerId && targetOwnerId !== 'YOUR_DISCORD_USER_ID'
                            ? `Could not find User ID (${targetOwnerId}) in any Discord Voice Channel. Please join a VC on Discord first, or connect via Voice Channel ID below!`
                            : 'Please enter your Voice Channel ID directly, or enter your Discord User ID!'
                    });
                }
            }

            let joinedCount = 0;
            let lastError = null;

            // 2. Connect all targeted bots in parallel
            const joinTasks = bots.map(async (bot) => {
                try {
                    let targetChannel = null;
                    if (resolvedChannelId) {
                        for (const g of bot.client.guilds.cache.values()) {
                            targetChannel = g.channels.cache.get(resolvedChannelId);
                            if (targetChannel) break;
                        }
                        if (!targetChannel) {
                            targetChannel = bot.client.channels.cache.get(resolvedChannelId) || await bot.client.channels.fetch(resolvedChannelId).catch(() => null);
                        }
                    }

                    if (!targetChannel) {
                        throw new Error(`Bot #${bot.index} cannot access channel ${resolvedChannelId || 'voice'}. Ensure the bot has joined that Discord server!`);
                    }

                    if (targetChannel && bot.client.channels?.cache) {
                        bot.client.channels.cache.set(targetChannel.id, targetChannel);
                    }

                    const botRainlink = bot.client?.rainlink || bot.rainlink;
                    if (botRainlink && botRainlink.nodes && botRainlink.nodes.some(n => n.state === 1)) {
                        console.log(`[Join] Bot #${bot.index} (${bot.license || 'global'}) connecting via Lavalink: ${targetChannel.name} (${targetChannel.id})`);
                        let p = botRainlink.players.get(targetChannel.guild.id);
                        if (!p) {
                            await botRainlink.players.create({
                                guildId: targetChannel.guild.id,
                                voiceId: targetChannel.id,
                                textId: targetChannel.id,
                                shardId: 0,
                                deaf: Boolean(deaf)
                            });
                        } else if (p.voiceId !== targetChannel.id) {
                            p.setVoiceChannel(targetChannel.id);
                        }
                        const bState = nativePlayer.getBotState(bot);
                        bState.channelId = targetChannel.id;
                        bState.guildId = targetChannel.guild.id;
                        return { success: true, botIndex: bot.index };
                    }

                    console.log(`[Join] Bot #${bot.index} (${bot.license || 'global'}) connecting to voice channel: ${targetChannel.name} (${targetChannel.id})`);
                    await nativePlayer.joinChannel(bot, targetChannel, { deaf, mute });
                    return { success: true, botIndex: bot.index };
                } catch (e) {
                    console.error(`[Join] Bot #${bot.index} join error:`, e.message);
                    return { success: false, botIndex: bot.index, error: e.message };
                }
            });

            const results = await Promise.allSettled(joinTasks);
            for (const r of results) {
                if (r.status === 'fulfilled' && r.value.success) {
                    joinedCount++;
                } else if (r.status === 'fulfilled' && !r.value.success) {
                    lastError = r.value.error;
                } else if (r.status === 'rejected') {
                    lastError = r.reason?.message || 'Join failed';
                }
            }

            if (joinedCount > 0) {
                res.json({ status: 'success', message: `Connected ${joinedCount} bot(s) to voice channel.` });
            } else {
                res.json({
                    status: 'error',
                    message: lastError ? `Could not connect: ${lastError}` : 'Could not find or join the voice channel. Make sure the bot is in that server.'
                });
            }
        });

        // Voice Disconnect
        this.app.post('/api/music/disconnect', async (req, res) => {
            const { targetBot, targetBots } = req.body;
            const bots = this.getTargetBots(targetBot, targetBots, req);
            let disconnected = 0;
            bots.forEach(bot => {
                try {
                    if (bot.client.ws && typeof bot.client.ws.broadcast === 'function') {
                        bot.client.guilds.cache.forEach(g => {
                            bot.client.ws.broadcast({
                                op: 4,
                                d: {
                                    guild_id: g.id,
                                    channel_id: null,
                                    self_mute: false,
                                    self_deaf: false
                                }
                            });
                        });
                    }

                    const botRainlink = bot.client?.rainlink || bot.rainlink;
                    if (botRainlink && botRainlink.players) {
                        for (const p of botRainlink.players.values()) {
                            try { p.destroy(); } catch (e) {}
                        }
                    }
                    nativePlayer.disconnect(bot);
                    disconnected++;
                } catch (e) {
                    console.error(`[Disconnect] Bot #${bot.index} error:`, e.message);
                }
            });
            res.json({ status: 'success', message: `Disconnected ${disconnected} bot(s) from voice.` });
        });

        // Follow Owner Toggle
        this.app.post('/api/follow/toggle', async (req, res) => {
            global.followOwner = !global.followOwner;
            if (global.followOwner) {
                const ownerId = (global.config?.allowedUserIds || [])[0];
                const bots = this.getBotPool(req).filter(b => b.client && b.client.isReady());
                let targetChannel = null;
                if (ownerId) {
                    for (const b of bots) {
                        for (const g of b.client.guilds.cache.values()) {
                            const ovs = g.voiceStates?.cache?.get(ownerId);
                            if (ovs?.channel) {
                                targetChannel = ovs.channel;
                                break;
                            }
                        }
                        if (targetChannel) break;
                    }
                    if (targetChannel) {
                        for (const b of bots) {
                            try {
                                const ch = b.client.channels.cache.get(targetChannel.id) || await b.client.channels.fetch(targetChannel.id).catch(() => null);
                                if (ch) nativePlayer.joinChannel(b, ch).catch(() => {});
                            } catch (e) {}
                        }
                    }
                }
            }
            res.json({ status: 'success', enabled: global.followOwner });
        });

        // Tokens List (Multi-tenant isolated per KeyAuth license)
        this.app.get('/api/tokens/list', (req, res) => {
            const bots = this.getBotPool(req);
            const tokens = bots.map((b, i) => {
                const raw = b.token || '';
                const masked = raw.length > 10 ? `${raw.slice(0, 6)}...${raw.slice(-4)}` : (raw || 'N/A');
                return {
                    index: b.index ?? i,
                    tag: b.client?.user?.tag || '',
                    masked,
                    userId: b.client?.user?.id || '',
                    online: b.client?.isReady() || false
                };
            });
            res.json({ status: 'success', tokens });
        });

        // Tokens Add (Bulk & isolated per license)
        this.app.post('/api/tokens/add', (req, res) => {
            const rawInput = (req.body.tokens || '').trim();
            const autoLogin = req.body.login !== false;
            if (!rawInput) {
                return res.json({ status: 'error', message: 'No tokens provided', added: 0, results: [] });
            }

            const lic = this.getLicenseKey(req);
            const botPool = this.getBotPool(req);
            const tokenPath = lic ? this.getLicenseTokenPath(lic) : (
                process.env.PORTABLE_EXECUTABLE_DIR
                    ? path.join(process.env.PORTABLE_EXECUTABLE_DIR, 'tokens.txt')
                    : path.join(process.cwd(), 'tokens.txt')
            );

            // Clean & extract tokens (supports bare tokens, email:password:token, quotes)
            const lines = rawInput.split(/[\r\n,]+/).map(t => t.trim()).filter(Boolean);
            const tokenList = [];
            for (let line of lines) {
                line = line.replace(/^["']|["']$/g, '').trim();
                if (!line) continue;
                if (line.includes(':')) {
                    const parts = line.split(':');
                    let found = '';
                    for (let i = parts.length - 1; i >= 0; i--) {
                        const p = parts[i].trim();
                        if (p.length >= 50 && (p.includes('.') || p.startsWith('mfa.'))) {
                            found = p;
                            break;
                        }
                    }
                    tokenList.push(found || parts[parts.length - 1].trim());
                } else {
                    tokenList.push(line);
                }
            }

            let existingTokens = [];
            try {
                if (fs.existsSync(tokenPath)) {
                    existingTokens = fs.readFileSync(tokenPath, 'utf8').split(/\r?\n/).map(t => t.trim()).filter(Boolean);
                }
            } catch (e) {}

            const results = [];
            let addedCount = 0;

            for (const token of tokenList) {
                const masked = token.length > 10 ? `${token.slice(0, 6)}...${token.slice(-4)}` : token;
                if (existingTokens.includes(token)) {
                    results.push({ ok: false, token: masked, message: 'Already enrolled' });
                    continue;
                }

                existingTokens.push(token);
                addedCount++;

                const index = botPool.length;
                if (global.Discord && typeof global.initializeClient === 'function') {
                    try {
                        const client = new global.Discord.Client({
                            readyStatus: false,
                            checkUpdate: false,
                            intents: ['GUILDS', 'GUILD_VOICE_STATES', 'GUILD_MESSAGES'],
                            partials: ['CHANNEL', 'MESSAGE']
                        });

                        const botEntry = { client, token, index, license: lic || null };
                        botPool.push(botEntry);
                        if (!lic && global.bots && !global.bots.includes(botEntry)) {
                            global.bots.push(botEntry);
                        }
                        global.initializeClient(client, token, index);

                        if (autoLogin) {
                            client.login(token).catch(err => {
                                console.error(`[Token Manager] Login failed for unit #${index}:`, err.message);
                            });
                        }
                    } catch (err) {
                        console.error(`[Token Manager] Failed to initialize unit #${index}:`, err);
                    }
                }

                results.push({ ok: true, token: masked, message: autoLogin ? 'Enrolled & logging in' : 'Enrolled' });
            }

            try {
                fs.writeFileSync(tokenPath, existingTokens.join('\n'), 'utf8');
            } catch (e) {
                console.error('[Token Manager] Failed to persist token file:', e.message);
            }

            res.json({
                status: 'success',
                added: addedCount,
                results
            });
        });

        // Token Session (isolated)
        this.app.post('/api/tokens/session', (req, res) => {
            const index = parseInt(req.body.index, 10);
            const action = req.body.action;
            const botPool = this.getBotPool(req);
            const bot = botPool.find(b => b.index === index);
            if (!bot) {
                return res.status(404).json({ status: 'error', message: `Unit #${index} not found` });
            }

            if (action === 'login') {
                if (bot.client?.isReady()) {
                    return res.json({ status: 'success', message: `Unit #${index} is already online` });
                }
                bot.client.login(bot.token).catch(err => {
                    console.error(`[Session] Login failed for #${index}:`, err.message);
                });
                return res.json({ status: 'success', message: `Logging in unit #${index}...` });
            } else if (action === 'logout') {
                if (bot.client) {
                    try { bot.client.destroy(); } catch (e) {}
                }
                return res.json({ status: 'success', message: `Unit #${index} logged out` });
            }
            res.json({ status: 'error', message: 'Unknown session action' });
        });

        // Token Remove (isolated)
        this.app.post('/api/tokens/remove', (req, res) => {
            const index = parseInt(req.body.index, 10);
            const lic = this.getLicenseKey(req);
            const botPool = this.getBotPool(req);
            const tokenPath = lic ? this.getLicenseTokenPath(lic) : (
                process.env.PORTABLE_EXECUTABLE_DIR
                    ? path.join(process.env.PORTABLE_EXECUTABLE_DIR, 'tokens.txt')
                    : path.join(process.cwd(), 'tokens.txt')
            );

            const botIdx = botPool.findIndex(b => b.index === index);
            if (botIdx !== -1) {
                const [removed] = botPool.splice(botIdx, 1);
                try { removed.client?.destroy(); } catch (e) {}

                if (!lic && global.bots && global.bots !== botPool) {
                    const gIdx = global.bots.findIndex(b => b.index === index);
                    if (gIdx !== -1) global.bots.splice(gIdx, 1);
                }

                botPool.forEach((b, i) => { b.index = i; });

                const remaining = botPool.map(b => b.token).filter(Boolean);
                try {
                    fs.writeFileSync(tokenPath, remaining.join('\n'), 'utf8');
                } catch (e) {}
                return res.json({ status: 'success', message: `Unit #${index} removed` });
            }
            res.json({ status: 'error', message: `Unit #${index} not found` });
        });

        // Token Validity Check (isolated)
        this.app.post('/api/tokens/check-validity', (req, res) => {
            const bots = this.getBotPool(req);
            const valid = bots.filter(b => b.client?.isReady()).length;
            const invalid = bots.length - valid;
            res.json({ status: 'success', data: { valid, invalid, locked: 0 } });
        });

        // Music Playback Endpoints
        this.app.get('/api/music/state', (req, res) => {
            const bots = this.getBotPool(req).filter(b => b.client && b.client.isReady());
            for (const b of bots) {
                const r = b.client?.rainlink || b.rainlink;
                if (r && r.players) {
                    for (const p of r.players.values()) {
                        if (p && (p.playing || p.paused) && p.queue?.current) {
                            const cur = p.queue.current;
                            return res.json({
                                status: 'success',
                                title: cur.title || 'Unknown Track',
                                author: cur.author || 'YouTube',
                                playing: p.playing && !p.paused,
                                isPaused: Boolean(p.paused),
                                track: {
                                    title: cur.title || 'Unknown Track',
                                    author: cur.author || 'YouTube',
                                    uri: cur.uri || '',
                                    duration: cur.duration || cur.length || 0,
                                    thumbnail: cur.thumbnail || ''
                                },
                                position: Math.max(0, p.position || 0),
                                duration: cur.duration || cur.length || 0,
                                loop: p.loop === 'track',
                                volume: p.volume || 100,
                                gainDb: 0,
                                bassDb: 0,
                                filter: null,
                                queueLength: p.queue.size || 0
                            });
                        }
                    }
                }
            }
            const nativeState = nativePlayer.getState(bots);
            res.json(nativeState);
        });

        this.app.post('/api/music/play', async (req, res) => {
            const { query, channel_id, deaf, mute, targetBot, targetBots, allBots, syncFleet } = req.body;
            let bots = this.getTargetBots(targetBot, targetBots, req);
            if (bots.length === 0) {
                return res.json({ status: 'error', message: 'No online bots targeted. Start a bot first.' });
            }

            // Enforce single bot play unless explicitly requested as multi-bot
            const isMulti = (Array.isArray(targetBots) && targetBots.length > 1) || allBots === true || syncFleet === true;
            if (!isMulti) {
                const alreadyInVoice = bots.find(b => {
                    const r = b.client?.rainlink || b.rainlink;
                    if (r && r.players && r.players.size > 0) return true;
                    const s = nativePlayer.getBotState(b);
                    return s.voiceConnection && s.voiceConnection.state?.status === 'ready';
                });

                if (targetBot && targetBot !== 'all' && targetBot !== 'none') {
                    const specific = bots.find(b => String(b.index) === String(targetBot));
                    bots = [specific || alreadyInVoice || bots[0]];
                } else if (Array.isArray(targetBots) && targetBots.length === 1) {
                    const specific = bots.find(b => String(b.index) === String(targetBots[0]));
                    bots = [specific || alreadyInVoice || bots[0]];
                } else {
                    bots = [alreadyInVoice || bots[0]];
                }
            }

            try {
                // Identify channel ID for fleet
                let resolvedChannelId = channel_id || null;
                if (!resolvedChannelId) {
                    for (const b of bots) {
                        const r = b.client?.rainlink || b.rainlink;
                        if (r && r.players && r.players.size > 0) {
                            for (const p of r.players.values()) {
                                if (p.voiceId) {
                                    resolvedChannelId = p.voiceId;
                                    break;
                                }
                            }
                        }
                        if (resolvedChannelId) break;
                        const bState = nativePlayer.getBotState(b);
                        if (bState.channelId) {
                            resolvedChannelId = bState.channelId;
                            break;
                        }
                    }
                }
                if (!resolvedChannelId) {
                    const ownerId = (req.body.owner_id || req.headers['x-discord-owner-id'] || (global.config?.allowedUserIds || [])[0] || '').trim();
                    if (ownerId && ownerId !== 'YOUR_DISCORD_USER_ID') {
                        for (const b of bots) {
                            for (const g of b.client.guilds.cache.values()) {
                                const ovs = g.voiceStates?.cache?.get(ownerId);
                                if (ovs?.channel?.id) {
                                    resolvedChannelId = ovs.channel.id;
                                    break;
                                }
                                const m = g.members?.cache?.get(ownerId);
                                if (m?.voice?.channel?.id) {
                                    resolvedChannelId = m.voice.channel.id;
                                    break;
                                }
                            }
                            if (resolvedChannelId) break;
                        }
                    }
                }

                // 1. Resolve track (Lavalink node.bgcrazy.in:25575 as primary)
                let track = null;
                let lavalinkTrack = null;
                const leaderBot = bots[0];
                const leaderRainlink = leaderBot.client?.rainlink || leaderBot.rainlink;

                if (leaderRainlink) {
                    try {
                        const searchRes = await leaderRainlink.search(query);
                        if (searchRes && searchRes.tracks && searchRes.tracks.length > 0) {
                            lavalinkTrack = searchRes.tracks[0];
                            track = {
                                title: lavalinkTrack.title,
                                author: lavalinkTrack.author || 'YouTube',
                                url: lavalinkTrack.uri || query,
                                duration: lavalinkTrack.duration || lavalinkTrack.length || 0,
                                thumbnail: lavalinkTrack.thumbnail || (lavalinkTrack.identifier ? `https://i.ytimg.com/vi/${lavalinkTrack.identifier}/hqdefault.jpg` : ''),
                                isLocal: false,
                                encoded: lavalinkTrack.encoded
                            };
                            console.log(`[Play] Resolved track via Lavalink: "${track.title}"`);
                        }
                    } catch (lErr) {
                        console.warn('[Play] Lavalink search warning:', lErr.message);
                    }
                }

                if (!track) {
                    track = await nativePlayer.resolveTrack(query);
                }

                // 2. Play via Lavalink if node is online
                if (lavalinkTrack && leaderRainlink && leaderRainlink.nodes && leaderRainlink.nodes.some(n => n.state === 1)) {
                    try {
                        const playTasks = bots.map(async (bot) => {
                            const botRainlink = bot.client?.rainlink || bot.rainlink;
                            if (!botRainlink) return null;

                            let targetChannel = null;
                            if (resolvedChannelId) {
                                for (const g of bot.client.guilds.cache.values()) {
                                    targetChannel = g.channels.cache.get(resolvedChannelId);
                                    if (targetChannel) break;
                                }
                                if (!targetChannel) {
                                    targetChannel = bot.client.channels.cache.get(resolvedChannelId) || await bot.client.channels.fetch(resolvedChannelId).catch(() => null);
                                }
                            }
                            if (!targetChannel) return null;

                            let player = botRainlink.players.get(targetChannel.guild.id);
                            if (!player) {
                                player = await botRainlink.players.create({
                                    guildId: targetChannel.guild.id,
                                    voiceId: targetChannel.id,
                                    textId: targetChannel.id,
                                    shardId: 0,
                                    deaf: Boolean(deaf)
                                });
                            } else if (player.voiceId !== targetChannel.id) {
                                player.setVoiceChannel(targetChannel.id);
                            }

                            player.queue.clear();
                            player.queue.add(lavalinkTrack);
                            await player.play();
                            return bot.index;
                        });

                        const playRes = await Promise.allSettled(playTasks);
                        const successfulBots = playRes.filter(r => r.status === 'fulfilled' && r.value !== null);

                        if (successfulBots.length > 0) {
                            return res.json({
                                status: 'success',
                                message: `Playing: "${track.title}" on ${successfulBots.length} bot(s) (Lavalink Phase-Locked)`,
                                track
                            });
                        }
                    } catch (lPlayErr) {
                        console.warn('[Play] Lavalink playback notice, falling back to NativePlayer:', lPlayErr.message);
                    }
                }

                // 3. Fallback: NativePlayer
                // Connect all target bots to voice channel first in parallel
                await Promise.allSettled(bots.map(async (bot) => {
                    const botState = nativePlayer.getBotState(bot);
                    let isReady = botState.voiceConnection && botState.voiceConnection.state?.status === 'ready';

                    if (!isReady) {
                        let targetChannel = null;
                        if (resolvedChannelId) {
                            targetChannel = bot.client.channels.cache.get(resolvedChannelId) || await bot.client.channels.fetch(resolvedChannelId).catch(() => null);
                        }

                        if (targetChannel) {
                            console.log(`[Play] Bot #${bot.index} connecting to voice channel: ${targetChannel.name} (${targetChannel.id})`);
                            await nativePlayer.joinChannel(bot, targetChannel, { deaf, mute });
                        }
                    }
                }));

                const readyBots = bots.filter(b => {
                    const s = nativePlayer.getBotState(b);
                    return s.voiceConnection && s.voiceConnection.state?.status === 'ready';
                });

                if (readyBots.length === 0) {
                    return res.json({
                        status: 'error',
                        message: 'No bots connected to a voice channel. Please join a voice channel first.'
                    });
                }

                // Master-follower architecture: Leader plays track into Master AudioPlayer
                await nativePlayer.playTrack(leaderBot, track);

                // Synchronize all ready followers to the master AudioPlayer for 0ms skew phase-lock
                if (readyBots.length > 1) {
                    nativePlayer.syncFleet(leaderBot, readyBots);
                }

                res.json({
                    status: 'success',
                    message: `Playing: "${track.title}" on ${readyBots.length} bot(s) (Phase-Locked)`,
                    track
                });
            } catch (err) {
                console.error('[Play] Track resolution error:', err.message);
                res.json({ status: 'error', message: err.message || 'Could not find or stream the requested audio.' });
            }
        });

        this.app.post('/api/music/pause', (req, res) => {
            const { targetBot, targetBots } = req.body;
            const bots = this.getTargetBots(targetBot, targetBots, req);
            bots.forEach(b => {
                const r = b.client?.rainlink || b.rainlink;
                if (r && r.players) {
                    for (const p of r.players.values()) {
                        try { p.setPause(true); } catch (e) {}
                    }
                }
                nativePlayer.pause(b);
            });
            res.json({ status: 'success', message: 'Playback paused' });
        });

        this.app.post('/api/music/resume', (req, res) => {
            const { targetBot, targetBots } = req.body;
            const bots = this.getTargetBots(targetBot, targetBots, req);
            bots.forEach(b => {
                const r = b.client?.rainlink || b.rainlink;
                if (r && r.players) {
                    for (const p of r.players.values()) {
                        try { p.setPause(false); } catch (e) {}
                    }
                }
                nativePlayer.resume(b);
            });
            res.json({ status: 'success', message: 'Playback resumed' });
        });

        this.app.post('/api/music/skip', (req, res) => {
            const { targetBot, targetBots } = req.body;
            const bots = this.getTargetBots(targetBot, targetBots, req);
            bots.forEach(b => {
                const r = b.client?.rainlink || b.rainlink;
                if (r && r.players) {
                    for (const p of r.players.values()) {
                        try { p.skip(); } catch (e) {}
                    }
                }
                nativePlayer.skip(b);
            });
            res.json({ status: 'success', message: 'Skipped track' });
        });

        this.app.post('/api/music/stop', (req, res) => {
            const { targetBot, targetBots } = req.body;
            const bots = this.getTargetBots(targetBot, targetBots, req);
            bots.forEach(b => {
                const r = b.client?.rainlink || b.rainlink;
                if (r && r.players) {
                    for (const p of r.players.values()) {
                        try { p.stop(); p.destroy(); } catch (e) {}
                    }
                }
                nativePlayer.stop(b);
            });
            res.json({ status: 'success', message: 'Stopped track' });
        });

        this.app.post('/api/music/loop', (req, res) => {
            const { loop, targetBot, targetBots } = req.body;
            const bots = this.getTargetBots(targetBot, targetBots, req);
            let loopRes = loop;
            bots.forEach(b => {
                const r = b.client?.rainlink || b.rainlink;
                if (r && r.players) {
                    for (const p of r.players.values()) {
                        try {
                            const newMode = p.loop === 'track' ? 'none' : 'track';
                            p.setLoop(newMode);
                            loopRes = newMode === 'track';
                        } catch (e) {}
                    }
                }
                nativePlayer.setLoop(b, loop);
            });
            res.json({ status: 'success', loop: loopRes, message: `Loop set to ${loopRes}` });
        });

        this.app.post('/api/music/volume', (req, res) => {
            const { volume, targetBot, targetBots } = req.body;
            const vol = parseInt(volume) || 100;
            const bots = this.getTargetBots(targetBot, targetBots, req);
            bots.forEach(b => {
                const r = b.client?.rainlink || b.rainlink;
                if (r && r.players) {
                    for (const p of r.players.values()) {
                        try { p.setVolume(vol); } catch (e) {}
                    }
                }
                nativePlayer.setVolume(b, volume);
            });
            res.json({ status: 'success', volume, message: `Volume set to ${volume}` });
        });

        this.app.post('/api/music/seek', (req, res) => {
            const { offset, position, targetBot, targetBots } = req.body;
            const bots = this.getTargetBots(targetBot, targetBots, req);
            let finalPos = 0;
            bots.forEach(b => {
                const r = b.client?.rainlink || b.rainlink;
                if (r && r.players) {
                    for (const p of r.players.values()) {
                        try {
                            const curPos = p.position || 0;
                            const target = offset !== undefined ? Math.max(0, curPos + Number(offset)) : Number(position || 0);
                            p.seek(target);
                            finalPos = target;
                        } catch (e) {}
                    }
                }
                if (offset !== undefined) {
                    finalPos = nativePlayer.seek(b, offset, true);
                } else if (position !== undefined) {
                    finalPos = nativePlayer.seek(b, position, false);
                }
            });
            res.json({ status: 'success', position: finalPos, message: 'Position updated' });
        });

        this.app.post('/api/music/gain', (req, res) => {
            const { gainDb, targetBot, targetBots } = req.body;
            const bots = this.getTargetBots(targetBot, targetBots, req);
            bots.forEach(b => {
                nativePlayer.setGain(b, gainDb);
            });
            res.json({ status: 'success', gainDb, message: `Gain set to ${gainDb} dB` });
        });

        this.app.post('/api/music/bass', (req, res) => {
            const { bassDb, targetBot, targetBots } = req.body;
            const bots = this.getTargetBots(targetBot, targetBots, req);
            bots.forEach(b => {
                nativePlayer.setBass(b, bassDb);
            });
            res.json({ status: 'success', bassDb, message: `Bass set to ${bassDb} dB` });
        });

        this.app.post('/api/music/filter', (req, res) => {
            const { filter, targetBot, targetBots } = req.body;
            const bots = this.getTargetBots(targetBot, targetBots, req);
            bots.forEach(b => {
                nativePlayer.setFilter(b, filter);
            });
            res.json({ status: 'success', filter, message: `Filter set to ${filter}` });
        });

        this.app.get('/api/music/cookies', (req, res) => {
            const cookieFile = path.join(process.cwd(), 'data', 'cookies.txt');
            const rootFile = path.join(process.cwd(), 'cookies.txt');
            const hasCookies = (fs.existsSync(cookieFile) && fs.statSync(cookieFile).size > 10) ||
                              (fs.existsSync(rootFile) && fs.statSync(rootFile).size > 10) ||
                              Boolean(process.env.YOUTUBE_COOKIES && process.env.YOUTUBE_COOKIES.length > 20);
            res.json({ status: 'success', hasCookies });
        });

        this.app.post('/api/music/cookies', (req, res) => {
            const { cookies } = req.body;
            if (!cookies || typeof cookies !== 'string' || cookies.trim().length === 0) {
                return res.status(400).json({ status: 'error', message: 'Cookies content cannot be empty' });
            }
            try {
                const cookieDir = path.join(process.cwd(), 'data');
                fs.mkdirSync(cookieDir, { recursive: true });
                const cookieFile = path.join(cookieDir, 'cookies.txt');
                fs.writeFileSync(cookieFile, cookies.trim(), 'utf8');
                console.log('[WebServer] YouTube cookies updated successfully in', cookieFile);
                res.json({ status: 'success', message: 'YouTube cookies saved and activated successfully!' });
            } catch (err) {
                console.error('[WebServer] Error saving cookies:', err.message);
                res.status(500).json({ status: 'error', message: err.message });
            }
        });


        const VOLUME_MODES = [
            { name: 'clean', label: 'Clean', volume: 100, gainDb: 0 },
            { name: 'loud', label: 'Loud', volume: 200, gainDb: 3 },
            { name: 'louder', label: 'Louder', volume: 500, gainDb: 6 },
            { name: 'max', label: 'Max', volume: 10000, gainDb: 12 }
        ];

        this.app.post('/api/music/mode', (req, res) => {
            const { mode, targetBot, targetBots } = req.body;
            const preset = VOLUME_MODES.find(m => m.name === mode) || { volume: 100, gainDb: 0 };
            const bots = this.getTargetBots(targetBot, targetBots, req);
            bots.forEach(b => {
                nativePlayer.setVolume(b, preset.volume);
                nativePlayer.setGain(b, preset.gainDb);
            });
            res.json({
                status: 'success',
                mode,
                volume: preset.volume,
                gainDb: preset.gainDb,
                message: `Mode set to ${mode}`
            });
        });

        this.app.get('/api/music/modes', (req, res) => {
            res.json({
                status: 'success',
                modes: VOLUME_MODES
            });
        });

        this.app.get('/api/music/levels', (req, res) => {
            const bots = this.getTargetBots(null, null, req);
            const state = bots[0] ? nativePlayer.getBotState(bots[0]) : null;
            const volume = state ? state.volume : 100;
            const gainDb = state ? state.gainDb : 0;
            const bassDb = state ? state.bassDb : 0;
            res.json({
                status: 'success',
                volume,
                gainDb,
                bassDb,
                limiter: true,
                chain: 'normal',
                stage: {
                    loudness: false,
                    volume,
                    gainDb,
                    bassDb
                }
            });
        });

        this.app.get('/api/music/skew', (req, res) => {
            const { targetBot, targetBots } = req.query;
            const bots = this.getTargetBots(targetBot, targetBots, req);
            const skewData = nativePlayer.getFleetSkew(bots);
            res.json(skewData);
        });

        this.app.post('/api/music/sync', async (req, res) => {
            const { targetBot, targetBots } = req.body;
            const bots = this.getTargetBots(targetBot, targetBots, req);
            const activeBots = bots;
            if (activeBots.length === 0) {
                return res.json({ status: 'error', message: 'No online bots available to synchronize.' });
            }

            // Identify if any bot is already playing or connected to a voice channel
            let leader = activeBots.find(b => nativePlayer.getBotState(b).currentTrack && nativePlayer.getBotState(b).audioPlayer);
            let sharedChannelId = null;

            if (leader) {
                sharedChannelId = nativePlayer.getBotState(leader).channelId;
            }
            if (!sharedChannelId) {
                for (const b of activeBots) {
                    const bs = nativePlayer.getBotState(b);
                    if (bs.channelId) { sharedChannelId = bs.channelId; break; }
                }
            }
            if (!sharedChannelId) {
                const ownerId = (global.config?.allowedUserIds || [])[0];
                if (ownerId) {
                    for (const b of activeBots) {
                        for (const g of b.client.guilds.cache.values()) {
                            const ovs = g.voiceStates?.cache?.get(ownerId);
                            if (ovs?.channel?.id) { sharedChannelId = ovs.channel.id; break; }
                        }
                        if (sharedChannelId) break;
                    }
                }
            }

            // Bring any remaining bots into the target voice channel
            if (sharedChannelId) {
                await Promise.allSettled(activeBots.map(async (bot) => {
                    const bs = nativePlayer.getBotState(bot);
                    if (!bs.voiceConnection || bs.voiceConnection.state?.status !== 'ready' || bs.channelId !== sharedChannelId) {
                        let targetChannel = null;
                        for (const g of bot.client.guilds.cache.values()) {
                            targetChannel = g.channels.cache.get(sharedChannelId);
                            if (targetChannel) break;
                        }
                        if (!targetChannel) {
                            targetChannel = bot.client.channels.cache.get(sharedChannelId) || await bot.client.channels.fetch(sharedChannelId).catch(() => null);
                        }
                        if (targetChannel) {
                            await nativePlayer.joinChannel(bot, targetChannel);
                        }
                    }
                }));
            }

            const readyBots = activeBots.filter(b => {
                const s = nativePlayer.getBotState(b);
                return s.voiceConnection && s.voiceConnection.state?.status === 'ready';
            });

            if (readyBots.length === 0) {
                return res.json({ status: 'error', message: 'No bots connected to a voice channel. Please join a voice channel first.' });
            }

            if (!leader) {
                leader = readyBots.find(b => nativePlayer.getBotState(b).currentTrack) || readyBots[0];
            }

            nativePlayer.syncFleet(leader, readyBots);
            res.json({
                status: 'success',
                message: `Fleet phase-locked: ${readyBots.length} bot(s) synchronized to Bot #${leader.index} (0ms skew)`
            });
        });

        this.app.post('/api/music/autosync', (req, res) => {
            const { enabled } = req.body;
            const autoSync = nativePlayer.setAutoSync(enabled);
            res.json({ status: 'success', autoSync });
        });

        // Media lists
        this.app.get('/api/audio/list', (req, res) => {
            let files = [];
            try { files = fs.readdirSync(audiosPath); } catch (e) {}
            res.json({ status: 'success', files });
        });

        this.app.get('/api/video/list', (req, res) => {
            let files = [];
            try { files = fs.readdirSync(videosPath); } catch (e) {}
            res.json({ status: 'success', files });
        });

        // Status endpoint
        this.app.get('/api/status', (req, res) => {
            res.json({ status: 'success', running: true, uptime: process.uptime() });
        });

        this.app.post('/api/status', (req, res) => {
            const { status, type, text, targetBot, targetBots } = req.body;
            const bots = this.getTargetBots(targetBot, targetBots, req);
            bots.forEach(b => {
                try {
                    b.client.user.setPresence({
                        activities: text ? [{ name: text, type: (type || 'PLAYING').toUpperCase() }] : [],
                        status: status || 'online'
                    });
                } catch (e) {}
            });
            res.json({ status: 'success', message: 'Status updated' });
        });

        // Tokens Clear (Wipe all units for this license/device)
        this.app.post('/api/tokens/clear', (req, res) => {
            const lic = this.getLicenseKey(req);
            const botPool = this.getBotPool(req);
            const tokenPath = lic ? this.getLicenseTokenPath(lic) : (
                process.env.PORTABLE_EXECUTABLE_DIR
                    ? path.join(process.env.PORTABLE_EXECUTABLE_DIR, 'tokens.txt')
                    : path.join(process.cwd(), 'tokens.txt')
            );

            while (botPool.length > 0) {
                const b = botPool.pop();
                try { b.client?.destroy(); } catch (e) {}
            }

            if (!lic && global.bots) {
                while (global.bots.length > 0) {
                    const b = global.bots.pop();
                    try { b.client?.destroy(); } catch (e) {}
                }
            }

            try { fs.writeFileSync(tokenPath, '', 'utf8'); } catch (e) {}
            res.json({ status: 'success', message: 'All units cleared' });
        });

        this.app.get('/api/tunnel-url', (req, res) => {
            res.json({
                status: 'success',
                lifetimeUrl: global.lifetimeUrl || 'https://moonlord-control-gate.loca.lt',
                tunnelUrl: global.tunnelUrl || null,
                lanIp: 'http://192.168.1.3:5000'
            });
        });

        // Universal Catch-All for any /api/* route to ALWAYS return valid JSON with channels/data arrays
        this.app.all('/api/*', (req, res) => {
            res.json({ status: 'success', message: 'OK', channels: [], files: [], tokens: [], data: [] });
        });
    }

    startTunnel() {
        const publishGateway = (url) => {
            if (!url) return;
            try {
                if (typeof fetch === 'function') {
                    fetch('https://ntfy.sh/moonlord_fleet_gateway_pub_999', {
                        method: 'POST',
                        body: url,
                        headers: { 'Title': 'MOON LORD Gateway' }
                    }).catch(() => {});
                }
            } catch (e) {}
        };

        // 0. Cloud Hosting Environment Detection (Render, Koyeb, Railway, Heroku)
        const cloudHost = process.env.PUBLIC_URL || process.env.RENDER_EXTERNAL_URL || process.env.SERVER_URL || process.env.KOYEB_PUBLIC_URL || null;
        if (cloudHost) {
            const cleanUrl = cloudHost.trim().replace(/\/+$/, '');
            global.lifetimeUrl = cleanUrl;
            publishGateway(cleanUrl);
            console.log('========================================================================');
            console.log(' [MOON LORD CLOUD HOSTING DETECTED]');
            console.log(` Active Permanent Cloud URL: ${cleanUrl}`);
            console.log('========================================================================');
        }

        // 1. Start Localtunnel with FIXED permanent lifetime subdomain: moonlord-control-gate
        try {
            const localtunnel = require('localtunnel');
            const startLt = async () => {
                try {
                    const tunnel = await localtunnel({ port: this.port || 5000, subdomain: 'moonlord-control-gate' });
                    global.lifetimeUrl = tunnel.url;
                    publishGateway(tunnel.url);
                    console.log('========================================================================');
                    console.log(' [MOON LORD LIFETIME GATEWAY ONLINE]');
                    console.log(' Fixed Lifetime URL for ALL Mobile Phones & Buyers:');
                    console.log(` >>> ${tunnel.url} <<<`);
                    console.log(' Works on 4G, 5G, Wi-Fi, Emulators & Multiple Phones worldwide!');
                    console.log('========================================================================');
                    tunnel.on('close', () => {
                        console.warn('[Tunnel] Lifetime tunnel closed. Reconnecting in 3s...');
                        setTimeout(startLt, 3000);
                    });
                    tunnel.on('error', (err) => {
                        console.warn('[Tunnel] Lifetime tunnel error:', err.message);
                    });
                } catch (ltErr) {
                    console.warn('[Tunnel] Localtunnel start error:', ltErr.message);
                }
            };
            startLt();
        } catch (e) {}

        // 2. Also start Cloudflare Tunnel as concurrent backup
        const binDirs = [
            path.join(__dirname, '..', 'bin', 'cloudflared.exe'),
            path.join(process.cwd(), 'bin', 'cloudflared.exe'),
            path.join(process.env.PORTABLE_EXECUTABLE_DIR || '', 'bin', 'cloudflared.exe')
        ];
        const binPath = binDirs.find(p => p && fs.existsSync(p));
        if (binPath) {
            try {
                const { spawn } = require('child_process');
                const proc = spawn(binPath, ['tunnel', '--url', `http://127.0.0.1:${this.port || 5000}`], { stdio: ['ignore', 'pipe', 'pipe'] });
                const handleTunnelOutput = (d) => {
                    const text = d.toString();
                    const m = text.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/i);
                    if (m) {
                        const tunnelUrl = m[0];
                        global.tunnelUrl = tunnelUrl;
                        publishGateway(tunnelUrl);
                        console.log('========================================================================');
                        console.log(' [MOON LORD CLOUDFLARE PUBLIC GATEWAY ONLINE]');
                        console.log(` >>> ${tunnelUrl} <<<`);
                        console.log(' Connect anywhere from Mobile 4G/5G, Wi-Fi or emulator!');
                        console.log('========================================================================');
                        const urlPath = path.join(__dirname, '..', 'public', 'tunnel_url.txt');
                        try { fs.writeFileSync(urlPath, tunnelUrl, 'utf8'); } catch (e) {}
                    }
                };
                if (proc.stdout) proc.stdout.on('data', handleTunnelOutput);
                if (proc.stderr) proc.stderr.on('data', handleTunnelOutput);
                proc.on('error', (err) => {
                    console.warn('[Tunnel] Cloudflared error:', err.message);
                });
            } catch (e) {}
        }

        // Periodic broadcast every 30s to keep rendezvous channel alive
        setInterval(() => {
            const active = global.tunnelUrl || global.lifetimeUrl;
            if (active) publishGateway(active);
        }, 30000);
    }

    start(port = 5000) {
        this.port = port;
        this.server = this.app.listen(this.port, '0.0.0.0', () => {
            console.log(`[WebServer] Dashboard listening on http://localhost:${this.port} (0.0.0.0)`);
            this.startTunnel();
        });

        this.server.on('error', (err) => {
            if (err.code === 'EADDRINUSE') {
                console.warn(`[WebServer] Port ${this.port} is already in use; dashboard is accessible.`);
            } else {
                console.error(`[WebServer] Server error: ${err.message}`);
            }
        });
    }

    stop() {
        if (this.server) {
            this.server.close();
            this.server = null;
        }
    }
}

module.exports = WebServer;
