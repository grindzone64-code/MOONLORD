const path = require('path');
const fs = require('fs');

class VideoStreamHandler {
    constructor(client, guildId, channelId) {
        this.client = client;
        this.guildId = guildId;
        this.channelId = channelId;
        this.videoDispatcher = null;
        this.audioDispatcher = null;
    }

    async play(filePath) {
        console.log(`[VideoStream] Starting native stream for ${filePath} on bot ${this.client.user.id}`);

        // Ensure the library finds ffmpeg across environments
        const localFfmpeg = path.join(process.cwd(), process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg');
        if (fs.existsSync(localFfmpeg)) {
            process.env.FFMPEG_PATH = localFfmpeg;
        } else {
            process.env.FFMPEG_PATH = 'ffmpeg';
        }

        try {
            const channel = this.client.channels.cache.get(this.channelId);
            if (!channel) throw new Error("Channel not found.");

            console.log(`[VideoStream] Bot joining ${this.channelId} with video support...`);
            const connection = await this.client.voice.joinChannel(channel, {
                selfVideo: true,
                selfDeaf: true,
                videoCodec: 'H264'
            });

            // The aiko-chan-ai fork has built-in playVideo and playAudio
            // We use standard options for compatibility
            console.log(`[VideoStream] Initiating playVideo for ${filePath}`);
            this.videoDispatcher = connection.playVideo(filePath, {
                fps: 30,
                presetH26x: 'ultrafast',
                bitrate: 1000
            });

            console.log(`[VideoStream] Initiating playAudio for ${filePath}`);
            this.audioDispatcher = connection.playAudio(filePath);

            this.videoDispatcher.on('start', () => console.log(`[VideoStream] Video started for ${filePath}`));
            this.videoDispatcher.on('error', (err) => console.error(`[VideoStream] Video Error:`, err));
            this.videoDispatcher.on('finish', () => console.log(`[VideoStream] Video finished.`));

            this.audioDispatcher.on('error', (err) => console.error(`[VideoStream] Audio Error:`, err));

        } catch (e) {
            console.error(`[VideoStream] Native Play Error:`, e.message);
            this.stop();
        }
    }

    stop() {
        if (this.videoDispatcher) {
            this.videoDispatcher.destroy();
            this.videoDispatcher = null;
        }
        if (this.audioDispatcher) {
            this.audioDispatcher.destroy();
            this.audioDispatcher = null;
        }
    }
}

module.exports = VideoStreamHandler;
