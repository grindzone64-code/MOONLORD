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

// Helper: check YouTube title or detect unavailable/private status via yt-dlp
function checkYtDlpTitle(url) {
    const ytdlExe = getYtdlExecutable();
    return new Promise((resolve, reject) => {
        execFile(ytdlExe, [
            '--no-warnings',
            '--js-runtimes', 'node',
            '--extractor-args', 'youtube:player_client=android,ios,web',
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

// Helper: locate yt-dlp binary across environments (Windows, Linux Docker, Render cloud)
function getYtdlExecutable() {
    const isWin = process.platform === 'win32';
    const candidates = isWin ? [
        path.join(__dirname, '..', 'bin', 'yt-dlp.exe'),
        path.join(__dirname, '..', 'yt-dlp.exe'),
        path.join(process.cwd(), 'bin', 'yt-dlp.exe'),
        path.join(process.cwd(), 'yt-dlp.exe'),
        'C:\\Users\\chint\\AppData\\Local\\Programs\\Python\\Python312\\Scripts\\yt-dlp.exe'
    ] : [
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
        path.join(__dirname, '..', 'ffmpeg.exe'),
        path.join(process.cwd(), 'ffmpeg.exe'),
        path.join(__dirname, '..', 'bin', 'ffmpeg.exe'),
        path.join(process.cwd(), 'bin', 'ffmpeg.exe')
    ] : [
        '/usr/bin/ffmpeg',
        '/usr/local/bin/ffmpeg',
        path.join(__dirname, '..', 'bin', 'ffmpeg'),
        path.join(process.cwd(), 'bin', 'ffmpeg')
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

        console.log(`[NativePlayer] [${botLic}] Bot #${bot.index} joining voice channel: ${channel.name} (${channel.id})`);

        const botGroup = `bot-${bot.client?.user?.id || stateId}`;
        const connection = joinVoiceChannel({
            channelId: channel.id,
            guildId: guild.id,
            adapterCreator: guild.voiceAdapterCreator,
            selfDeaf: Boolean(options.selfDeaf ?? options.deaf),
            selfMute: false,
            group: botGroup,
            daveEncryption: false
        });

        state.voiceConnection = connection;
        state.channelId = channel.id;
        state.guildId = guild.id;

        connection.on('stateChange', (oldState, newState) => {
            console.log(`[NativePlayer] [${botLic}] Bot #${bot.index} voice status: ${oldState.status} -> ${newState.status}`);
            if (newState.status === VoiceConnectionStatus.Disconnected) {
                Promise.race([
                    entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
                    entersState(connection, VoiceConnectionStatus.Connecting, 5_000)
                ]).catch(() => {
                    if (state.voiceConnection === connection) {
                        try { connection.destroy(); } catch (e) {}
                        state.voiceConnection = null;
                    }
                });
            } else if (newState.status === VoiceConnectionStatus.Destroyed) {
                if (state.voiceConnection === connection) {
                    state.voiceConnection = null;
                }
            }
        });

        await entersState(connection, VoiceConnectionStatus.Ready, 15_000);
        console.log(`[NativePlayer] [${botLic}] Bot #${bot.index} Voice connection READY in ${channel.name}!`);

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

        try {
            if (videoId) {
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
            console.warn('[NativePlayer] ytSearch notice:', searchErr.message);
        }

        // For YouTube URLs where yt-search could not find metadata, validate via yt-dlp
        if (isYouTube) {
            try {
                const title = await checkYtDlpTitle(trimmed);
                return {
                    title: title || 'YouTube Audio',
                    author: 'YouTube',
                    url: trimmed,
                    duration: 0,
                    thumbnail: '',
                    isLocal: false
                };
            } catch (titleErr) {
                console.warn('[NativePlayer] checkYtDlpTitle fallback:', titleErr.message);
                return {
                    title: videoId ? `YouTube (${videoId})` : 'YouTube Audio',
                    author: 'YouTube',
                    url: trimmed,
                    duration: 0,
                    thumbnail: '',
                    isLocal: false
                };
            }
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
            if (af || seekSec > 0) {
                const args = [];
                if (seekSec > 0) args.push('-ss', seekSec.toFixed(2));
                args.push('-i', track.url);
                if (af) args.push('-af', af);
                args.push('-vn');
                args.push('-c:a', 'libopus', '-b:a', '128k', '-ar', '48000', '-ac', '2', '-f', 'ogg', 'pipe:1');

                const ff = spawn(ffmpegExe, args, { windowsHide: true });
                state.ffmpegProc = ff;
                ff.on('close', () => { if (state.ffmpegProc === ff) state.ffmpegProc = null; });
                ff.on('error', (err) => {
                    console.error('[NativePlayer] local ffmpeg error:', err.message);
                    if (state.ffmpegProc === ff) state.ffmpegProc = null;
                });
                return { stream: ff.stdout, type: StreamType.OggOpus };
            }
            return { stream: fs.createReadStream(track.url), type: StreamType.Arbitrary };
        }

        const ytdlExe = getYtdlExecutable();
        console.log(`[NativePlayer] Spawning yt-dlp audio stream using (${ytdlExe}) for: ${track.title} [filter=${state.filter || 'none'}, seek=${seekSec}s, gain=${state.gainDb}dB, bass=${state.bassDb}dB]`);

        const ytdlProc = spawn(ytdlExe, [
            '--no-warnings',
            '--extractor-args', 'youtube:player_client=android,web',
            '-f', 'ba/b',
            '-o', '-',
            '--no-playlist',
            '--quiet',
            track.url
        ], { windowsHide: true });

        state.ytdlProc = ytdlProc;

        ytdlProc.stderr.on('data', (d) => {
            const errStr = d.toString().trim();
            if (errStr && !errStr.includes('WARNING:')) {
                console.warn('[yt-dlp stderr]:', errStr.slice(0, 120));
            }
        });

        ytdlProc.on('close', () => {
            if (state.ytdlProc === ytdlProc) state.ytdlProc = null;
        });

        ytdlProc.on('error', (err) => {
            console.error('[NativePlayer] yt-dlp spawn error:', err.message);
            if (state.ytdlProc === ytdlProc) state.ytdlProc = null;
        });

        // Always pipe yt-dlp through ffmpeg to guarantee a valid Opus stream for Discord voice
        const ffArgs = [];
        if (seekSec > 0) ffArgs.push('-ss', seekSec.toFixed(2));
        ffArgs.push('-i', 'pipe:0');
        if (af) ffArgs.push('-af', af);
        ffArgs.push('-vn'); // Essential: discards video so Discord voice demuxer receives pure audio OggOpus stream
        ffArgs.push('-c:a', 'libopus', '-b:a', '128k', '-ar', '48000', '-ac', '2', '-f', 'ogg', 'pipe:1');

        const ffmpegProc = spawn(ffmpegExe, ffArgs, { windowsHide: true });
        state.ffmpegProc = ffmpegProc;

        ffmpegProc.stderr.on('data', () => {});
        ytdlProc.stdout.pipe(ffmpegProc.stdin);

        ytdlProc.stdout.on('error', () => {});
        ffmpegProc.stdin.on('error', () => {});

        ffmpegProc.on('close', () => {
            if (state.ffmpegProc === ffmpegProc) state.ffmpegProc = null;
            if (state.ytdlProc === ytdlProc) {
                try { ytdlProc.kill('SIGKILL'); } catch (e) {}
                state.ytdlProc = null;
            }
        });

        ffmpegProc.on('error', (err) => {
            console.error('[NativePlayer] ffmpeg filter error:', err.message);
            if (state.ffmpegProc === ffmpegProc) state.ffmpegProc = null;
        });

        return { stream: ffmpegProc.stdout, type: StreamType.OggOpus };
    }

    async playTrack(bot, track, seekMs = 0) {
        const state = this.getBotState(bot);
        const myStateId = this.getBotStateId(bot);

        if (!state.voiceConnection || state.voiceConnection.state.status !== VoiceConnectionStatus.Ready) {
            let targetChannel = null;
            for (const g of (bot.client.guilds?.cache?.values() || [])) {
                const vs = g.voiceStates?.cache?.get(bot.client.user?.id);
                if (vs?.channel) {
                    targetChannel = vs.channel;
                    break;
                }
                const me = g.me || g.members?.cache?.get(bot.client.user?.id);
                if (me?.voice?.channel) {
                    targetChannel = me.voice.channel;
                    break;
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

        if (state.voiceConnection && state.voiceConnection.state.subscription?.player !== state.audioPlayer) {
            state.voiceConnection.subscribe(state.audioPlayer);
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
