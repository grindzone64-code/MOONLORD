const ytSearch = require('yt-search');
const { spawn, execFile, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const {
    joinVoiceChannel,
    entersState,
    VoiceConnectionStatus,
    createAudioPlayer,
    createAudioResource,
    AudioPlayerStatus,
    NoSubscriberBehavior,
    StreamType
} = require('@discordjs/voice');

// Primary in-process YouTube streaming engine (@distube/ytdl-core)
let ytdlCoreClient = null;
try {
    const { Ytdl } = require('@distube/ytdl-core');
    ytdlCoreClient = new Ytdl();
} catch (e) {
    console.warn('[NativePlayer] YTDL Core initialization notice:', e.message);
}

// Helper: check YouTube title or detect unavailable/private status via yt-dlp
function checkYtDlpTitle(url) {
    const ytdlExe = getYtdlExecutable();
    const cookieArgs = getCookieArgs();
    return new Promise((resolve, reject) => {
        execFile(ytdlExe, [
            '--no-warnings',
            '--js-runtimes', 'node',
            '-4',
            ...cookieArgs,
            '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
            '--get-title',
            '--no-playlist',
            url
        ], { windowsHide: true }, (err, stdout, stderr) => {
            if (err) {
                const msg = (stderr || err.message).toString();
                if (/unavailable|private|removed|terminated|not available/i.test(msg)) {
                    return reject(new Error('This YouTube video is unavailable or private. Please check the URL or try searching by song title.'));
                }
                return reject(new Error(msg.slice(0, 120)));
            }
            resolve(stdout.trim());
        });
    });
}

// Helper: locate cookies file if provided by user
function getCookieArgs() {
    const possiblePaths = [
        path.join(process.cwd(), 'cookies.txt'),
        path.join(process.cwd(), 'data', 'cookies.txt'),
        path.join(__dirname, '..', 'cookies.txt'),
        path.join(__dirname, '..', 'data', 'cookies.txt'),
        process.env.PORTABLE_EXECUTABLE_DIR ? path.join(process.env.PORTABLE_EXECUTABLE_DIR, 'cookies.txt') : null
    ].filter(Boolean);

    for (const p of possiblePaths) {
        if (fs.existsSync(p) && fs.statSync(p).size > 10) {
            return ['--cookies', p];
        }
    }

    if (process.env.YOUTUBE_COOKIES && process.env.YOUTUBE_COOKIES.length > 20) {
        try {
            const target = path.join(process.cwd(), 'data', 'cookies.txt');
            fs.mkdirSync(path.dirname(target), { recursive: true });
            fs.writeFileSync(target, process.env.YOUTUBE_COOKIES, 'utf8');
            return ['--cookies', target];
        } catch (e) {}
    }

    return [];
}

// Helper: locate yt-dlp binary across environments (Windows, Linux Docker, Render cloud, Electron)
function getYtdlExecutable() {
    const isWin = process.platform === 'win32';
    const candidates = isWin ? [
        process.resourcesPath ? path.join(process.resourcesPath, 'bin', 'yt-dlp.exe') : null,
        process.resourcesPath ? path.join(process.resourcesPath, 'app', 'bin', 'yt-dlp.exe') : null,
        path.join(__dirname, '..', 'bin', 'yt-dlp.exe'),
        path.join(__dirname, '..', '..', 'bin', 'yt-dlp.exe'),
        path.join(__dirname, '..', 'yt-dlp.exe'),
        path.join(process.cwd(), 'bin', 'yt-dlp.exe'),
        path.join(process.cwd(), 'yt-dlp.exe'),
        path.join(process.cwd(), 'Self__bot-main', 'bin', 'yt-dlp.exe'),
        path.join(process.cwd(), 'Self__bot-main', 'yt-dlp.exe'),
        'C:\\Users\\chint\\AppData\\Local\\Programs\\Python\\Python312\\Scripts\\yt-dlp.exe'
    ].filter(Boolean) : [
        path.join(__dirname, '..', 'bin', 'yt-dlp'),
        path.join(process.cwd(), 'bin', 'yt-dlp'),
        '/usr/local/bin/yt-dlp',
        '/usr/bin/yt-dlp',
        '/tmp/yt-dlp',
        path.join(__dirname, '..', 'yt-dlp'),
        path.join(process.cwd(), 'yt-dlp')
    ];

    for (const c of candidates) {
        if (fs.existsSync(c)) {
            if (!isWin) {
                try { fs.chmodSync(c, 0o755); } catch (e) {}
            }
            return c;
        }
    }

    // On Linux/Cloud, if yt-dlp is missing, use ensureYtdl fallback
    if (!isWin) {
        try {
            const { ensureYtdl } = require('./ensureYtdl');
            const installed = ensureYtdl();
            if (installed && fs.existsSync(installed)) {
                return installed;
            }
        } catch (e) {}
    }

    return 'yt-dlp';
}

// Helper: locate ffmpeg binary across environments
function getFfmpegExecutable() {
    const isWin = process.platform === 'win32';
    const candidates = isWin ? [
        process.resourcesPath ? path.join(process.resourcesPath, 'bin', 'ffmpeg.exe') : null,
        process.resourcesPath ? path.join(process.resourcesPath, 'app', 'bin', 'ffmpeg.exe') : null,
        path.join(__dirname, '..', 'bin', 'ffmpeg.exe'),
        path.join(__dirname, '..', '..', 'bin', 'ffmpeg.exe'),
        path.join(__dirname, '..', 'ffmpeg.exe'),
        path.join(process.cwd(), 'bin', 'ffmpeg.exe'),
        path.join(process.cwd(), 'ffmpeg.exe'),
        path.join(process.cwd(), 'Self__bot-main', 'bin', 'ffmpeg.exe'),
        path.join(process.cwd(), 'Self__bot-main', 'ffmpeg.exe')
    ].filter(Boolean) : [
        path.join(__dirname, '..', 'bin', 'ffmpeg'),
        path.join(process.cwd(), 'bin', 'ffmpeg'),
        '/usr/bin/ffmpeg',
        '/usr/local/bin/ffmpeg',
        path.join(__dirname, '..', 'ffmpeg'),
        path.join(process.cwd(), 'ffmpeg')
    ];
    for (const c of candidates) {
        if (fs.existsSync(c)) {
            if (!isWin) {
                try { fs.chmodSync(c, 0o755); } catch (e) {}
            }
            return c;
        }
    }
    try {
        const ffStatic = require('ffmpeg-static');
        if (ffStatic && fs.existsSync(ffStatic)) return ffStatic;
    } catch (e) {}
    return 'ffmpeg';
}

class NativePlayer {
    constructor() {
        this.states = new Map(); // stateId (lic_idx) -> playerState
        this.autoSync = {
            on: false,
            interval: 15000,
            ticks: 0,
            corrections: 0,
            timer: null
        };
    }

    getBotLic(bot) {
        if (!bot) return 'default';
        return bot.license || (bot.client && bot.client.license) || 'default';
    }

    getBotStateId(bot) {
        const lic = this.getBotLic(bot);
        const idx = (typeof bot === 'object' && bot !== null) ? (bot.index ?? 0) : 0;
        return `${lic}_${idx}`;
    }

    getBotState(bot) {
        const id = (typeof bot === 'string') ? bot : this.getBotStateId(bot);
        if (!this.states.has(id)) {
            const lic = (typeof bot === 'object' && bot !== null) ? this.getBotLic(bot) : 'default';
            const idx = (typeof bot === 'object' && bot !== null) ? (bot.index ?? 0) : 0;
            this.states.set(id, {
                id,
                license: lic,
                botIndex: idx,
                botRef: (typeof bot === 'object' && bot !== null) ? bot : null,
                voiceConnection: null,
                audioPlayer: null,
                currentResource: null,
                channelId: null,
                guildId: null,
                queue: [],
                currentTrack: null,
                ytdlProc: null,
                ffmpegProc: null,
                startTime: 0,
                seekOffset: 0,
                pausedAt: 0,
                isPaused: false,
                loop: false,
                volume: 100,
                gainDb: 0,
                bassDb: 0,
                filter: null,
                masterBotId: null
            });
        }
        const st = this.states.get(id);
        if (typeof bot === 'object' && bot !== null && !st.botRef) {
            st.botRef = bot;
        }
        return st;
    }

    getPosition(state) {
        if (!state.currentTrack || state.startTime === 0) return 0;
        if (state.isPaused && state.pausedAt > 0) {
            return Math.max(0, (state.pausedAt - state.startTime) + (state.seekOffset || 0));
        }
        return Math.max(0, (Date.now() - state.startTime) + (state.seekOffset || 0));
    }

    buildAudioFilters(state) {
        const filters = [];
        const filter = (state.filter || '').toLowerCase();

        if (filter === 'nightcore') {
            filters.push('asetrate=48000*1.25,aresample=48000,atempo=1.0');
        } else if (filter === 'vaporwave') {
            filters.push('asetrate=48000*0.85,aresample=48000,atempo=1.0');
        } else if (filter === 'bassboost') {
            filters.push('bass=g=10:f=110:w=0.6');
        } else if (filter === 'vocal') {
            filters.push('equalizer=f=3000:t=q:w=1.5:g=6,highpass=f=200');
        } else if (filter === 'clearhigh') {
            filters.push('treble=g=6:f=5000,crystalizer=i=2');
        }

        const bassDb = Number(state.bassDb) || 0;
        if (bassDb !== 0 && filter !== 'bassboost') {
            filters.push(`bass=g=${bassDb.toFixed(1)}:f=100:w=0.5`);
        }

        const vol = Number(state.volume) || 100;
        const gainDb = Number(state.gainDb) || 0;
        const totalGain = (vol / 100) * Math.pow(10, gainDb / 20);
        if (Math.abs(totalGain - 1.0) > 0.02) {
            filters.push(`volume=${totalGain.toFixed(2)}`);
        }

        return filters.join(',');
    }

    async joinChannel(bot, channel, options = {}) {
        const state = this.getBotState(bot);
        const botLic = this.getBotLic(bot);
        const stateId = this.getBotStateId(bot);
        const guild = channel.guild || bot.client.guilds.cache.get(channel.guildId);
        if (!guild) throw new Error('Could not resolve guild for voice channel');

        if (state.voiceConnection &&
            state.channelId === channel.id &&
            state.voiceConnection.state.status === VoiceConnectionStatus.Ready) {
            return state.voiceConnection;
        }

        if (state.voiceConnection) {
            try { state.voiceConnection.destroy(); } catch (e) {}
            state.voiceConnection = null;
        }

        const botRainlink = bot.client?.rainlink || bot.rainlink;
        if (botRainlink) {
            try {
                const rp = botRainlink.players.get(guild.id);
                if (rp) rp.destroy();
            } catch (e) {}
        }

        console.log(`[NativePlayer] [${botLic}] Bot #${bot.index} joining voice channel: ${channel.name} (${channel.id})`);

        const botGroup = `bot-${bot.client?.user?.id || stateId}`;
        const connection = joinVoiceChannel({
            channelId: channel.id,
            guildId: guild.id,
            adapterCreator: guild.voiceAdapterCreator,
            selfDeaf: Boolean(options.selfDeaf ?? options.deaf),
            selfMute: false,
            group: botGroup
        });

        state.voiceConnection = connection;
        state.channelId = channel.id;
        state.guildId = guild.id;

        connection.on('stateChange', (oldState, newState) => {
            console.log(`[NativePlayer] [${botLic}] Bot #${bot.index} voice status: ${oldState.status} -> ${newState.status}`);
            if (newState.status === VoiceConnectionStatus.Disconnected) {
                if (newState.reason === 0) {
                    try { connection.rejoin(); } catch (e) {}
                } else if (connection.rejoinAttempts < 5) {
                    setTimeout(() => {
                        try { connection.rejoin(); } catch (e) {}
                    }, (connection.rejoinAttempts + 1) * 1000);
                } else {
                    try { connection.destroy(); } catch (e) {}
                }
            } else if (newState.status === VoiceConnectionStatus.Destroyed) {
                if (state.voiceConnection === connection) {
                    state.voiceConnection = null;
                }
            }
        });

        try {
            await entersState(connection, VoiceConnectionStatus.Ready, 30_000);
            console.log(`[NativePlayer] [${botLic}] Bot #${bot.index} Voice connection READY in ${channel.name}!`);
        } catch (connErr) {
            console.error(`[NativePlayer] [${botLic}] Bot #${bot.index} entersState notice:`, connErr.message);
            if (connection.state.status !== VoiceConnectionStatus.Ready) {
                try { connection.destroy(); } catch (e) {}
                state.voiceConnection = null;
                throw new Error(`Voice connection to ${channel.name} timed out or was rejected by Discord.`);
            }
        }

        // If another bot in the SAME fleet/license is already actively playing, auto-subscribe for instant phase-locked playback
        for (const [id, s] of this.states.entries()) {
            if (id !== stateId && s.license === botLic && s.audioPlayer && s.currentTrack && s.voiceConnection) {
                try {
                    connection.subscribe(s.audioPlayer);
                    state.audioPlayer = s.audioPlayer;
                    state.currentTrack = s.currentTrack;
                    state.startTime = s.startTime;
                    state.seekOffset = s.seekOffset;
                    state.isPaused = s.isPaused;
                    state.pausedAt = s.pausedAt;
                    state.filter = s.filter;
                    state.gainDb = s.gainDb;
                    state.bassDb = s.bassDb;
                    state.volume = s.volume;
                    state.masterBotId = id;
                    console.log(`[NativePlayer] [${botLic}] Bot #${bot.index} auto-subscribed to active AudioPlayer of ${id} (0ms skew)`);
                    break;
                } catch (subErr) {
                    console.warn(`[NativePlayer] Auto-subscribe notice:`, subErr.message);
                }
            }
        }

        return connection;
    }

    disconnect(bot) {
        const state = this.getBotState(bot);
        this.stop(bot);
        if (state.voiceConnection) {
            try { state.voiceConnection.destroy(); } catch (e) {}
            state.voiceConnection = null;
        }
        state.channelId = null;
        state.guildId = null;
        state.masterBotId = null;
    }

    async resolveTrack(query) {
        let trimmed = (query || '').trim();
        if (!trimmed) throw new Error('Search query or URL cannot be empty');

        const localAudioPath = path.join(process.cwd(), 'audios', trimmed);
        if (fs.existsSync(localAudioPath)) {
            return {
                title: path.basename(trimmed),
                author: 'Local Audio',
                url: localAudioPath,
                duration: 0,
                thumbnail: '',
                isLocal: true
            };
        }

        let videoId = null;
        let isYouTube = false;
        if (/^(https?:\/\/)?(www\.|m\.|music\.)?(youtube\.com|youtu\.be)\/.+/i.test(trimmed)) {
            isYouTube = true;
            try {
                const u = new URL(trimmed);
                if (u.searchParams.has('v')) {
                    videoId = u.searchParams.get('v');
                } else if (u.hostname.includes('youtu.be')) {
                    videoId = u.pathname.replace(/^\/+/, '').split('/')[0];
                } else if (u.pathname.includes('/shorts/')) {
                    videoId = u.pathname.split('/shorts/')[1]?.split('/')[0]?.split('?')[0];
                } else if (u.pathname.includes('/embed/')) {
                    videoId = u.pathname.split('/embed/')[1]?.split('/')[0]?.split('?')[0];
                }
                if (videoId) {
                    videoId = videoId.split('&')[0].split('?')[0];
                    trimmed = `https://www.youtube.com/watch?v=${videoId}`;
                }
            } catch (e) {}
        }

        // Primary: Query Local Lavalink (port 2333) or remote Lavalink for instant metadata resolution
        try {
            const axios = require('axios');
            const lavaIdent = isYouTube || trimmed.startsWith('http') ? trimmed : `ytsearch:${trimmed}`;
            const checkNodes = [
                { url: 'http://127.0.0.1:2333', auth: 'youshallnotpass' },
                { url: 'http://node.bgcrazy.in:25575', auth: 'Mark1234' }
            ];
            for (const n of checkNodes) {
                try {
                    const lavaRes = await axios.get(`${n.url}/v4/loadtracks?identifier=${encodeURIComponent(lavaIdent)}`, {
                        headers: { 'Authorization': n.auth },
                        timeout: 2000
                    });
                    if (lavaRes.data && lavaRes.data.data) {
                        const item = Array.isArray(lavaRes.data.data) ? lavaRes.data.data[0] : lavaRes.data.data;
                        if (item && item.info && item.info.title) {
                            return {
                                title: item.info.title,
                                author: item.info.author || 'YouTube',
                                url: item.info.uri || trimmed,
                                duration: item.info.length || 0,
                                thumbnail: item.info.artworkUrl || (item.info.identifier ? `https://i.ytimg.com/vi/${item.info.identifier}/hqdefault.jpg` : ''),
                                encoded: item.encoded,
                                isLocal: false
                            };
                        }
                    }
                } catch (e) {}
            }
        } catch (lavaErr) {}

        try {
            if (videoId) {
                // 1. Try public oEmbed first for instant zero-block metadata
                try {
                    const axios = require('axios');
                    const oEmbedRes = await axios.get(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`, { timeout: 3500 });
                    if (oEmbedRes.data && oEmbedRes.data.title) {
                        return {
                            title: oEmbedRes.data.title,
                            author: oEmbedRes.data.author_name || 'YouTube',
                            url: trimmed,
                            duration: 0,
                            thumbnail: oEmbedRes.data.thumbnail_url || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
                            isLocal: false
                        };
                    }
                } catch (oeErr) {}

                // 2. Try yt-search
                const res = await ytSearch({ videoId }).catch(() => null);
                if (res && res.title) {
                    return {
                        title: res.title || 'YouTube Audio',
                        author: res.author?.name || 'YouTube',
                        url: res.url || trimmed,
                        duration: (res.seconds || 0) * 1000,
                        thumbnail: res.thumbnail || res.image || '',
                        isLocal: false
                    };
                }
            }

            if (!isYouTube) {
                const searchRes = await ytSearch(trimmed).catch(() => null);
                const video = searchRes?.videos?.[0];
                if (video && video.title) {
                    return {
                        title: video.title || 'YouTube Audio',
                        author: video.author?.name || 'YouTube',
                        url: video.url || trimmed,
                        duration: (video.seconds || 0) * 1000,
                        thumbnail: video.thumbnail || video.image || '',
                        isLocal: false
                    };
                }
            }
        } catch (searchErr) {
            console.warn('[NativePlayer] search notice:', searchErr.message);
        }

        // For YouTube URLs, always construct a valid track object without failing or throwing bot block
        if (isYouTube) {
            return {
                title: videoId ? `YouTube (${videoId})` : 'YouTube Audio',
                author: 'YouTube',
                url: trimmed,
                duration: 0,
                thumbnail: videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : '',
                isLocal: false
            };
        }

        if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
            return {
                title: 'Web Audio Stream',
                author: 'Direct URL',
                url: trimmed,
                duration: 0,
                thumbnail: '',
                isLocal: false
            };
        }

        throw new Error(`Could not find or resolve any track for: "${trimmed}"`);
    }

    createStream(track, state, seekMs = 0) {
        // Clean previous child processes
        if (state.ffmpegProc) {
            try { state.ffmpegProc.kill('SIGKILL'); } catch (e) {}
            state.ffmpegProc = null;
        }
        if (state.ytdlProc) {
            try { state.ytdlProc.kill('SIGKILL'); } catch (e) {}
            state.ytdlProc = null;
        }

        if (seekMs > 0) {
            state.seekOffset = seekMs;
        }
        const seekSec = (state.seekOffset || 0) / 1000;
        const af = this.buildAudioFilters(state);
        const ffmpegExe = getFfmpegExecutable();

        if (track.isLocal) {
            const args = [
                '-fflags', '+genpts+discardcorrupt',
                '-avoid_negative_ts', 'make_zero'
            ];
            if (seekSec > 0) args.push('-ss', seekSec.toFixed(2));
            args.push('-i', track.url);
            if (af) args.push('-af', af);
            args.push('-vn');
            args.push('-f', 's16le', '-ar', '48000', '-ac', '2', 'pipe:1');

            const ff = spawn(ffmpegExe, args, { windowsHide: true });
            state.ffmpegProc = ff;
            ff.stdin?.on('error', () => {});
            ff.stdout?.on('error', () => {});
            ff.on('close', () => { if (state.ffmpegProc === ff) state.ffmpegProc = null; });
            ff.on('error', (err) => {
                console.error('[NativePlayer] local ffmpeg error:', err.message);
                if (state.ffmpegProc === ff) state.ffmpegProc = null;
            });
            return { stream: ff.stdout, type: StreamType.Raw };
        }

        const { PassThrough } = require('stream');
        const inputStream = new PassThrough();
        let hasOutputData = false;
        let fallbackTriggered = false;
        const ytdlExe = getYtdlExecutable();
        const cookieArgs = getCookieArgs();

        const isYouTubeUrl = /^(https?:\/\/)?(www\.|m\.|music\.)?(youtube\.com|youtu\.be)\/.+/i.test(track.url);
        const streamTarget = isYouTubeUrl ? track.url : (track.url?.startsWith('http') ? track.url : `ytsearch1:${track.title}`);

        const triggerFallback = (reason) => {
            if (fallbackTriggered || hasOutputData) return;
            fallbackTriggered = true;
            console.log(`[NativePlayer] Notice (${reason}). Activating secondary streaming engine for: "${track.title}"`);

            // Secondary: @distube/ytdl-core in-process pure JS engine
            if (isYouTubeUrl && ytdlCoreClient) {
                try {
                    console.log(`[NativePlayer] [Fallback YTDL-CORE] Streaming "${track.title}"...`);
                    const ytdlStream = ytdlCoreClient.download(track.url, {
                        filter: { hasAudio: true, hasVideo: false },
                        highWaterMark: 1 << 25
                    });
                    ytdlStream.on('data', () => { hasOutputData = true; });
                    ytdlStream.pipe(inputStream);
                    ytdlStream.on('error', (e) => console.warn('[NativePlayer] YTDL-core fallback notice:', e.message));
                    return;
                } catch (e) {}
            }

            // Tertiary: play-dl stream
            try {
                const playDl = require('play-dl');
                if (isYouTubeUrl && playDl) {
                    playDl.stream(track.url).then(source => {
                        source.stream.on('data', () => { hasOutputData = true; });
                        source.stream.pipe(inputStream);
                    }).catch(e => console.warn('[NativePlayer] play-dl fallback notice:', e.message));
                    return;
                }
            } catch (e) {}

            // Quaternary: SoundCloud fallback for datacenter/cloud IPs where YouTube blocks
            try {
                const scTarget = `scsearch1:${track.title || 'audio'}`;
                console.log(`[NativePlayer] [Fallback SoundCloud] Streaming via: "${scTarget}"`);
                const scArgs = ['--no-warnings', '-4', '--geo-bypass', '-f', 'ba/b', '-o', '-', '--no-playlist', '--quiet', scTarget];
                const scProc = spawn(ytdlExe, scArgs, { windowsHide: true });
                state.ytdlProc = scProc;
                scProc.stdout.on('data', () => { hasOutputData = true; });
                scProc.stdout.pipe(inputStream);
            } catch (e) {}
        };

        // 1. PRIMARY ENGINE: High-Speed yt-dlp binary (Fastest, bypasses YouTube bot verification)
        let primaryLaunched = false;
        if (ytdlExe) {
            try {
                console.log(`[NativePlayer] [YT-DLP] Streaming "${track.title}" via ${ytdlExe} [seek=${seekSec}s]`);
                const ytdlArgs = [
                    '--no-warnings',
                    '-4',
                    '--geo-bypass',
                    ...cookieArgs,
                    '--extractor-args', 'youtube:player_client=android,web,visionos',
                    '-f', 'ba/b',
                    '-o', '-',
                    '--no-playlist',
                    '--quiet',
                    streamTarget
                ];

                const ytdlProc = spawn(ytdlExe, ytdlArgs, { windowsHide: true });
                state.ytdlProc = ytdlProc;

                ytdlProc.stdout.on('data', () => {
                    hasOutputData = true;
                });
                ytdlProc.stdout.pipe(inputStream);

                ytdlProc.stderr.on('data', (d) => {
                    const errStr = d.toString().trim();
                    if (errStr && !errStr.includes('WARNING:')) {
                        console.warn('[yt-dlp stderr]:', errStr.slice(0, 120));
                    }
                });

                ytdlProc.on('close', (code) => {
                    if (!hasOutputData && code !== 0) {
                        triggerFallback(`yt-dlp exited with code ${code}`);
                    }
                    if (state.ytdlProc === ytdlProc && !fallbackTriggered) {
                        state.ytdlProc = null;
                    }
                });

                ytdlProc.on('error', (err) => {
                    console.error('[NativePlayer] yt-dlp spawn error:', err.message);
                    triggerFallback(err.message);
                });

                primaryLaunched = true;
            } catch (err) {
                console.warn('[NativePlayer] yt-dlp launch notice:', err.message);
            }
        }

        if (!primaryLaunched) {
            triggerFallback('yt-dlp not available');
        }

        // Always pipe inputStream through ffmpeg to guarantee clean 48kHz stereo 16-bit raw PCM for Discord voice
        const ffArgs = [
            '-fflags', '+genpts+discardcorrupt',
            '-avoid_negative_ts', 'make_zero'
        ];
        if (seekSec > 0) ffArgs.push('-ss', seekSec.toFixed(2));
        ffArgs.push('-i', 'pipe:0');
        if (af) ffArgs.push('-af', af);
        ffArgs.push('-vn');
        ffArgs.push('-f', 's16le', '-ar', '48000', '-ac', '2', 'pipe:1');

        const ffmpegProc = spawn(ffmpegExe, ffArgs, { windowsHide: true });
        state.ffmpegProc = ffmpegProc;

        ffmpegProc.stderr.on('data', () => {});
        inputStream.pipe(ffmpegProc.stdin);

        inputStream.on('error', () => {});
        ffmpegProc.stdin.on('error', () => {});
        ffmpegProc.stdout.on('error', () => {});

        ffmpegProc.on('close', () => {
            if (state.ffmpegProc === ffmpegProc) state.ffmpegProc = null;
            if (state.ytdlProc) {
                try { state.ytdlProc.kill('SIGKILL'); } catch (e) {}
                state.ytdlProc = null;
            }
        });

        ffmpegProc.on('error', (err) => {
            console.error('[NativePlayer] ffmpeg error:', err.message);
            if (state.ffmpegProc === ffmpegProc) state.ffmpegProc = null;
        });

        return { stream: ffmpegProc.stdout, type: StreamType.Raw };
    }

    async playTrack(bot, track, seekMs = 0) {
        const state = this.getBotState(bot);
        const myStateId = this.getBotStateId(bot);

        if (!state.voiceConnection || state.voiceConnection.state.status !== VoiceConnectionStatus.Ready) {
            let targetChannel = null;
            for (const g of (bot.client.guilds?.cache?.values() || [])) {
                const vs = g.voiceStates?.cache?.get(bot.client.user?.id);
                const cid = vs?.channelId || vs?.channel?.id;
                if (cid) {
                    targetChannel = g.channels?.cache?.get(cid) || (await bot.client.channels.fetch(cid).catch(() => null));
                    if (targetChannel) break;
                }
                const me = g.me || g.members?.cache?.get(bot.client.user?.id);
                const mCid = me?.voice?.channelId || me?.voice?.channel?.id;
                if (mCid) {
                    targetChannel = g.channels?.cache?.get(mCid) || (await bot.client.channels.fetch(mCid).catch(() => null));
                    if (targetChannel) break;
                }
            }

            if (targetChannel) {
                await this.joinChannel(bot, targetChannel);
            } else {
                throw new Error(`Bot #${bot.index} is not in a voice channel. Connect it to a voice channel first.`);
            }
        }

        const handleTrackEnd = () => {
            if (state.ffmpegProc) {
                try { state.ffmpegProc.kill('SIGKILL'); } catch (e) {}
                state.ffmpegProc = null;
            }
            if (state.ytdlProc) {
                try { state.ytdlProc.kill('SIGKILL'); } catch (e) {}
                state.ytdlProc = null;
            }

            if (state.loop && state.currentTrack) {
                this.playTrack(bot, state.currentTrack, 0).catch(console.error);
                return;
            }

            if (state.queue.length > 0) {
                const nextTrack = state.queue.shift();
                this.playTrack(bot, nextTrack, 0).catch(console.error);
            } else {
                state.currentTrack = null;
                state.currentResource = null;
                state.startTime = 0;
                state.seekOffset = 0;
                state.isPaused = false;
                state.pausedAt = 0;

                // Also clean up only followers phase-locked to this leader
                for (const [id, fState] of this.states.entries()) {
                    if (fState.masterBotId === myStateId) {
                        fState.currentTrack = null;
                        fState.currentResource = null;
                        fState.startTime = 0;
                        fState.seekOffset = 0;
                        fState.isPaused = false;
                        fState.pausedAt = 0;
                        fState.masterBotId = null;
                    }
                }
            }
        };

        if (!state.audioPlayer) {
            const player = createAudioPlayer({
                behaviors: {
                    noSubscriber: NoSubscriberBehavior.Play,
                    maxMissedFrames: 1000
                }
            });

            player.on('stateChange', (oldState, newState) => {
                console.log(`[NativePlayer] Bot #${bot.index} AudioPlayer: ${oldState.status} -> ${newState.status}`);
                if (oldState.status === AudioPlayerStatus.Playing && newState.status === AudioPlayerStatus.Idle) {
                    console.log(`[NativePlayer] Bot #${bot.index} finished track: ${state.currentTrack?.title || 'Unknown'}`);
                    handleTrackEnd();
                }
            });

            player.on('error', (err) => {
                console.error(`[NativePlayer] Bot #${bot.index} playback error:`, err.message);
                handleTrackEnd();
            });

            state.audioPlayer = player;
            if (state.voiceConnection) {
                state.voiceConnection.subscribe(player);
            }
        }

        const { stream, type } = this.createStream(track, state, seekMs);
        state.currentTrack = track;
        state.startTime = Date.now();
        state.seekOffset = seekMs || 0;
        state.pausedAt = 0;
        state.isPaused = false;

        const resource = createAudioResource(stream, {
            inputType: type,
            inlineVolume: false
        });

        state.currentResource = resource;
        state.audioPlayer.play(resource);

        if (state.voiceConnection) {
            try { state.voiceConnection.subscribe(state.audioPlayer); } catch (e) {}
            try {
                if (typeof state.voiceConnection.setSpeaking === 'function') {
                    state.voiceConnection.setSpeaking(true);
                }
            } catch (e) {}
        }

        // Re-subscribe any followers locked to this leader for 0ms phase-lock
        for (const [id, fState] of this.states.entries()) {
            if (fState.masterBotId === myStateId && fState.voiceConnection) {
                try {
                    fState.voiceConnection.subscribe(state.audioPlayer);
                    fState.audioPlayer = state.audioPlayer;
                    fState.currentTrack = state.currentTrack;
                    fState.startTime = state.startTime;
                    fState.seekOffset = state.seekOffset;
                    fState.isPaused = false;
                    fState.pausedAt = 0;
                    fState.filter = state.filter;
                    fState.gainDb = state.gainDb;
                    fState.bassDb = state.bassDb;
                    fState.volume = state.volume;
                } catch (subErr) {
                    console.warn(`[PlayTrack] Re-subscribe follower Bot #${id} notice:`, subErr.message);
                }
            }
        }

        return state.audioPlayer;
    }

    async enqueue(bot, track) {
        const state = this.getBotState(bot);
        if (!state.currentTrack || !state.audioPlayer || state.audioPlayer.state.status === AudioPlayerStatus.Idle) {
            await this.playTrack(bot, track, 0);
            return { action: 'playing', track, queueLength: state.queue.length };
        } else {
            state.queue.push(track);
            return { action: 'queued', track, queueLength: state.queue.length };
        }
    }

    pause(bot) {
        const state = this.getBotState(bot);
        const myStateId = this.getBotStateId(bot);
        if (state.audioPlayer && !state.isPaused) {
            try {
                state.audioPlayer.pause();
                state.isPaused = true;
                state.pausedAt = Date.now();
                // Sync pause state across all phase-locked followers of THIS leader
                for (const [id, fState] of this.states.entries()) {
                    if (fState.masterBotId === myStateId) {
                        fState.isPaused = true;
                        fState.pausedAt = state.pausedAt;
                    }
                }
                return true;
            } catch (e) {
                console.error(`[NativePlayer] Pause error:`, e.message);
            }
        }
        return false;
    }

    resume(bot) {
        const state = this.getBotState(bot);
        const myStateId = this.getBotStateId(bot);
        if (state.audioPlayer && state.isPaused) {
            try {
                state.audioPlayer.unpause();
                const now = Date.now();
                if (state.pausedAt > 0) {
                    state.startTime += (now - state.pausedAt);
                }
                state.isPaused = false;
                state.pausedAt = 0;
                // Sync resume state across all phase-locked followers of THIS leader
                for (const [id, fState] of this.states.entries()) {
                    if (fState.masterBotId === myStateId) {
                        fState.startTime = state.startTime;
                        fState.isPaused = false;
                        fState.pausedAt = 0;
                    }
                }
                return true;
            } catch (e) {
                console.error(`[NativePlayer] Resume error:`, e.message);
            }
        }
        return false;
    }

    stop(bot) {
        const state = this.getBotState(bot);
        const myStateId = this.getBotStateId(bot);
        state.queue = [];
        if (state.audioPlayer) {
            try { state.audioPlayer.stop(); } catch (e) {}
            state.audioPlayer = null;
        }
        if (state.ffmpegProc) {
            try { state.ffmpegProc.kill('SIGKILL'); } catch (e) {}
            state.ffmpegProc = null;
        }
        if (state.ytdlProc) {
            try { state.ytdlProc.kill('SIGKILL'); } catch (e) {}
            state.ytdlProc = null;
        }
        state.currentResource = null;
        state.currentTrack = null;
        state.isPaused = false;
        state.startTime = 0;
        state.seekOffset = 0;
        state.pausedAt = 0;
        state.masterBotId = null;

        // Clean up followers of THIS leader only
        for (const [id, fState] of this.states.entries()) {
            if (fState.masterBotId === myStateId) {
                fState.currentTrack = null;
                fState.currentResource = null;
                fState.startTime = 0;
                fState.seekOffset = 0;
                fState.isPaused = false;
                fState.pausedAt = 0;
                fState.audioPlayer = null;
                fState.masterBotId = null;
            }
        }
    }

    skip(bot) {
        const state = this.getBotState(bot);
        if (state.queue.length > 0) {
            const nextTrack = state.queue.shift();
            return this.playTrack(bot, nextTrack, 0);
        } else {
            this.stop(bot);
        }
    }

    setVolume(bot, volume) {
        const state = this.getBotState(bot);
        const myStateId = this.getBotStateId(bot);
        const vol = Math.max(0, Math.min(10000, Number(volume) || 100));
        state.volume = vol;
        if (state.masterBotId && state.masterBotId !== myStateId) return;
        if (state.currentTrack && !state.isPaused) {
            const pos = this.getPosition(state);
            this.playTrack(bot, state.currentTrack, pos).catch(console.error);
        }
    }

    setGain(bot, gainDb) {
        const state = this.getBotState(bot);
        const myStateId = this.getBotStateId(bot);
        state.gainDb = Math.max(-12, Math.min(12, Number(gainDb) || 0));
        if (state.masterBotId && state.masterBotId !== myStateId) return;
        if (state.currentTrack && !state.isPaused) {
            const pos = this.getPosition(state);
            this.playTrack(bot, state.currentTrack, pos).catch(console.error);
        }
    }

    setBass(bot, bassDb) {
        const state = this.getBotState(bot);
        const myStateId = this.getBotStateId(bot);
        state.bassDb = Math.max(-12, Math.min(6, Number(bassDb) || 0));
        if (state.masterBotId && state.masterBotId !== myStateId) return;
        if (state.currentTrack && !state.isPaused) {
            const pos = this.getPosition(state);
            this.playTrack(bot, state.currentTrack, pos).catch(console.error);
        }
    }

    setFilter(bot, filter) {
        const state = this.getBotState(bot);
        const myStateId = this.getBotStateId(bot);
        state.filter = (!filter || filter === 'clear') ? null : filter.toLowerCase();
        if (state.masterBotId && state.masterBotId !== myStateId) return;
        if (state.currentTrack && !state.isPaused) {
            const pos = this.getPosition(state);
            this.playTrack(bot, state.currentTrack, pos).catch(console.error);
        }
    }

    seek(bot, positionOrOffset, isOffset = false) {
        const state = this.getBotState(bot);
        const myStateId = this.getBotStateId(bot);
        if (!state.currentTrack) return 0;
        if (state.masterBotId && state.masterBotId !== myStateId) {
            const masterState = this.states.get(state.masterBotId);
            if (masterState && masterState.botRef) {
                return this.seek(masterState.botRef, positionOrOffset, isOffset);
            }
            return 0;
        }

        const currentPos = this.getPosition(state);
        let targetPos = isOffset ? (currentPos + Number(positionOrOffset)) : Number(positionOrOffset);
        targetPos = Math.max(0, targetPos);
        if (state.currentTrack.duration > 0) {
            targetPos = Math.min(state.currentTrack.duration - 500, targetPos);
        }

        this.playTrack(bot, state.currentTrack, targetPos).catch(console.error);
        return targetPos;
    }

    setLoop(bot, loop) {
        const state = this.getBotState(bot);
        state.loop = Boolean(loop);
    }

    syncFleet(leaderBot, targetBots) {
        const leaderState = this.getBotState(leaderBot);
        const leaderStateId = this.getBotStateId(leaderBot);
        const leaderLic = this.getBotLic(leaderBot);
        if (!leaderState.currentTrack || !leaderState.audioPlayer) return;

        for (const follower of targetBots) {
            const followerStateId = this.getBotStateId(follower);
            if (followerStateId === leaderStateId) continue;
            const fState = this.getBotState(follower);
            if (!fState.voiceConnection) continue;

            if (fState.ffmpegProc) {
                try { fState.ffmpegProc.kill('SIGKILL'); } catch (e) {}
                fState.ffmpegProc = null;
            }
            if (fState.ytdlProc) {
                try { fState.ytdlProc.kill('SIGKILL'); } catch (e) {}
                fState.ytdlProc = null;
            }

            try {
                fState.voiceConnection.subscribe(leaderState.audioPlayer);
            } catch (subErr) {
                console.warn(`[SyncFleet] Bot #${follower.index} subscribe notice:`, subErr.message);
            }

            fState.audioPlayer = leaderState.audioPlayer;
            fState.currentTrack = leaderState.currentTrack;
            fState.startTime = leaderState.startTime;
            fState.seekOffset = leaderState.seekOffset;
            fState.isPaused = leaderState.isPaused;
            fState.pausedAt = leaderState.pausedAt;
            fState.filter = leaderState.filter;
            fState.gainDb = leaderState.gainDb;
            fState.bassDb = leaderState.bassDb;
            fState.volume = leaderState.volume;
            fState.masterBotId = leaderStateId;
            console.log(`[SyncFleet] [${leaderLic}] Phase-locked Bot #${follower.index} to master AudioPlayer of ${leaderStateId} (0ms skew)`);
        }
    }

    getAutoSyncInfo() {
        return {
            on: this.autoSync.on,
            interval: this.autoSync.interval,
            ticks: this.autoSync.ticks,
            corrections: this.autoSync.corrections
        };
    }

    getFleetSkew(bots) {
        const playingUnits = [];
        const distinctTracks = new Set();

        for (const bot of bots) {
            const state = this.getBotState(bot);
            if (state.currentTrack) {
                distinctTracks.add(state.currentTrack.url || state.currentTrack.title);
                playingUnits.push({
                    index: bot.index,
                    track: state.currentTrack.title || 'Unknown Track',
                    pos: this.getPosition(state),
                    paused: state.isPaused
                });
            }
        }

        const count = playingUnits.length;
        if (count === 0) {
            return {
                status: 'success',
                playing: 0,
                units: [],
                skew: 0,
                tolerance: 80,
                coherentGainDb: 0,
                incoherentGainDb: 0,
                tracks: 0,
                autoSync: this.getAutoSyncInfo()
            };
        }

        // Leader is the unit with index 0, or lowest index
        const leaderPos = playingUnits[0].pos;
        const units = playingUnits.map(u => ({
            index: u.index,
            track: u.track,
            offset: Math.round(u.pos - leaderPos),
            paused: u.paused
        }));

        const skew = count > 1 ? Math.max(0, ...units.map(u => Math.abs(u.offset))) : 0;
        const coherentGainDb = 20 * Math.log10(Math.max(1, count));
        const incoherentGainDb = 10 * Math.log10(Math.max(1, count));

        return {
            status: 'success',
            playing: count,
            units,
            skew,
            tolerance: 80,
            coherentGainDb: Math.round(coherentGainDb * 10) / 10,
            incoherentGainDb: Math.round(incoherentGainDb * 10) / 10,
            tracks: distinctTracks.size,
            autoSync: this.getAutoSyncInfo()
        };
    }

    setAutoSync(enabled, bots = []) {
        this.autoSync.on = Boolean(enabled);
        if (this.autoSync.on && !this.autoSync.timer) {
            this.autoSync.timer = setInterval(() => {
                this.autoSync.ticks++;
                const onlineBots = (global.bots || []).filter(b => b.client && b.client.isReady());
                const skewData = this.getFleetSkew(onlineBots);
                if (skewData.playing > 1 && skewData.skew > 80 && skewData.tracks === 1) {
                    const leader = onlineBots[0];
                    if (leader) {
                        this.syncFleet(leader, onlineBots);
                        this.autoSync.corrections++;
                    }
                }
            }, this.autoSync.interval);
        } else if (!this.autoSync.on && this.autoSync.timer) {
            clearInterval(this.autoSync.timer);
            this.autoSync.timer = null;
        }
        return this.getAutoSyncInfo();
    }

    getState(bots) {
        for (const bot of bots) {
            const state = this.getBotState(bot);
            if (state.currentTrack) {
                const position = this.getPosition(state);
                return {
                    status: 'success',
                    title: state.currentTrack.title || 'Unknown Track',
                    author: state.currentTrack.author || 'YouTube',
                    playing: !state.isPaused,
                    isPaused: state.isPaused,
                    track: {
                        title: state.currentTrack.title || 'Unknown Track',
                        author: state.currentTrack.author || 'YouTube',
                        uri: state.currentTrack.url || '',
                        duration: state.currentTrack.duration || 0,
                        thumbnail: state.currentTrack.thumbnail || ''
                    },
                    position: Math.max(0, position),
                    duration: state.currentTrack.duration || 0,
                    loop: state.loop,
                    volume: state.volume || 100,
                    gainDb: state.gainDb || 0,
                    bassDb: state.bassDb || 0,
                    filter: state.filter || null,
                    queueLength: state.queue.length
                };
            }
        }

        return {
            status: 'success',
            title: null,
            author: null,
            playing: false,
            isPaused: false,
            track: null,
            position: 0,
            duration: 0,
            loop: false,
            volume: 100,
            gainDb: 0,
            bassDb: 0,
            filter: null,
            queueLength: 0
        };
    }
}

module.exports = new NativePlayer();
