const axios = require('axios');

/**
 * Update voice channel status
 */
async function updateVoiceChannelStatus(channelId, status, token, index) {
    if (!channelId || !status || !token) {
        console.log(`[Client ${index}] [VOICE STATUS] Missing required parameters`);
        return;
    }

    try {
        await axios.put(`https://discord.com/api/v9/channels/${channelId}/voice-status`, {
            status: status
        }, {
            headers: {
                'Authorization': token,
                'Content-Type': 'application/json'
            }
        });
        console.log(`[Client ${index}] Voice channel status updated to: ${status}`);
    } catch (error) {
        console.error(`[Client ${index}] Error updating voice channel status:`, error.response ? error.response.data : error.message);
    }
}

/**
 * Fetch YouTube video duration
 */
async function fetchYouTubeDuration(videoId, index) {
    if (!videoId) return 0;

    try {
        const response = await axios.get(`https://www.youtube.com/watch?v=${videoId}`, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept-Language': 'en-US,en;q=0.9',
                'Cookie': 'CONSENT=YES+cb; YSC=BiCUU3t5Xco'
            },
            timeout: 5000
        });

        const playerResponseMatch = response.data.match(/ytInitialPlayerResponse\s*=\s*({.+?})\s*;/s);
        if (playerResponseMatch) {
            const playerResponse = JSON.parse(playerResponseMatch[1]);
            const durationSeconds = playerResponse?.videoDetails?.lengthSeconds;
            if (durationSeconds) return parseInt(durationSeconds) * 1000;
        }

        const durationMatch = response.data.match(/"approxDurationMs":"(\d+)"/);
        if (durationMatch) return parseInt(durationMatch[1]);

        const isoMatch = response.data.match(/PT(\d+H)?(\d+M)?(\d+S)?/);
        if (isoMatch) {
            const hours = parseInt(isoMatch[1]) || 0;
            const minutes = parseInt(isoMatch[2]) || 0;
            const seconds = parseInt(isoMatch[3]) || 0;
            return ((hours * 3600) + (minutes * 60) + seconds) * 1000;
        }

        return 0;
    } catch (err) {
        console.error(`[Client ${index}] [DURATION FETCH] Error:`, err.message);
        return 0;
    }
}

/**
 * Create progress bar for now playing
 */
function createProgressBar(current, duration) {
    const length = 15;
    if (!duration || duration <= 0) {
        return '▬'.repeat(length - 1) + '⚪';
    }

    const progress = Math.min(1, current / duration);
    const filled = Math.round(progress * length);
    return '▬'.repeat(filled) + '⚪' + '▬'.repeat(length - filled - 1);
}

/**
 * Format time in ms to readable format
 */
function formatTime(ms) {
    if (!ms || isNaN(ms)) return '0:00';
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    return hours > 0
        ? `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
        : `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Fetch autoplay recommendations from YouTube
 */
async function fetchAutoplayRecommendations(videoId, cap = 7, index) {
    if (!videoId) {
        console.log(`[Client ${index}] [AUTOPLAY] No video ID provided for recommendations`);
        return [];
    }

    const autoplayUrl = `https://www.youtube.com/watch?v=${videoId}&list=RD${videoId}`;
    const headers = {
        'User-Agent': 'Mozilla/5.0',
        'Accept-Language': 'en-US,en;q=0.9'
    };

    try {
        const res = await axios.get(autoplayUrl, { headers });
        const match = res.data.match(/ytInitialData\s*=\s*(\{.*?\});/s);
        if (!match) return [];

        const ytData = JSON.parse(match[1]);
        const playlistItems = ytData?.contents?.twoColumnWatchNextResults?.playlist?.playlist?.contents || [];

        const trackPool = [];

        for (const item of playlistItems) {
            if (trackPool.length >= cap) break;

            const v = item.playlistPanelVideoRenderer;
            if (!v || !v.videoId || v.videoId === videoId) continue;

            const title = v.title?.runs?.[0]?.text || v.title?.simpleText || 'Unknown';
            trackPool.push({
                title,
                identifier: v.videoId,
                url: `https://www.youtube.com/watch?v=${v.videoId}`
            });
        }

        return trackPool;
    } catch (err) {
        console.error(`[Client ${index}] Autoplay RD playlist fetch error:`, err);
        return [];
    }
}

module.exports = {
    updateVoiceChannelStatus,
    fetchYouTubeDuration,
    createProgressBar,
    formatTime,
    fetchAutoplayRecommendations
};
