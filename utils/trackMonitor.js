const { triggerAutoplay, autoplayStatus } = require('./autoplay');

const activeTrackMonitors = new Map();
const lastKnownStates = new Map();

function startTrackMonitor(player, track, token, rainlink, index, monitors) {
    if (!player || !track?.identifier) return;

    const guildId = player.guildId;
    const key = `${token}-${guildId}`;

    stopTrackMonitor(key, monitors);

    console.log(`[Client ${index}] [TRACK MONITOR] Starting monitor for: ${track.title}`);

    const length = track.length || track.info?.length || 0;
    const timeToEnd = Math.max(1000, length - 10000);

    const monitorId = setTimeout(() => {
        console.log(`[Client ${index}] [TRACK MONITOR] Track about to end: ${track.title}`);

        const endCheckInterval = setInterval(() => {
            const currentPlayer = rainlink.players.get(guildId);
            if (!currentPlayer) {
                clearInterval(endCheckInterval);
                return;
            }

            const currentTrack = currentPlayer.queue.current;
            if (!currentPlayer.playing || currentTrack?.identifier !== track.identifier) {
                clearInterval(endCheckInterval);

                if (autoplayStatus.get(`${token}-${guildId}`) && currentPlayer.queue.size === 0) {
                    console.log(`[Client ${index}] [TRACK MONITOR] End detected for: ${track.title}`);
                    const { triggerAutoplay } = require('./autoplay');
                    triggerAutoplay(`${token}-${guildId}`, currentPlayer, track, rainlink, token, player.client, index).catch(err => {
                        console.error(`[Client ${index}] [ENDCHECK AUTOPLAY ERROR]`, err);
                    });
                }
            }
        }, 500);

        monitors.set(key, endCheckInterval);
    }, timeToEnd);

    monitors.set(key, monitorId);
}

function stopTrackMonitor(key, monitors) {
    const monitorId = monitors.get(key);
    if (monitorId) {
        clearTimeout(monitorId);
        clearInterval(monitorId);
        monitors.delete(key);
    }
}

function checkPlayerState(player, guildId, token, rainlink, index) {
    if (!player || !guildId) return;

    const currentTrack = player.queue.current;
    const isPlaying = player.playing;
    const queueSize = player.queue.size;

    const key = `${token}-${guildId}`;
    const lastState = lastKnownStates.get(key) || {};
    const newState = {
        trackId: currentTrack?.identifier,
        isPlaying,
        queueSize,
        position: player.position,
        lastUpdate: Date.now()
    };

    if (!lastState.trackId) {
        lastKnownStates.set(key, newState);
        return;
    }

    if (lastState.trackId !== newState.trackId) {
        console.log(`[Client ${index}] [MONITOR] Track changed in guild ${guildId}`);
        lastKnownStates.set(key, newState);
        return;
    }

    if (lastState.isPlaying && !newState.isPlaying && newState.queueSize === 0) {
        console.log(`[Client ${index}] [MONITOR] Track ended detection in guild ${guildId}: ${currentTrack?.title}`);

        if (autoplayStatus.get(key) && currentTrack?.identifier) {
            console.log(`[Client ${index}] [MONITOR] Triggering autoplay for ended track: ${currentTrack.title}`);

            const seedTrack = player.queue.previous || currentTrack;
            triggerAutoplay(key, player, seedTrack, rainlink, token, player.client, index).catch(err => {
                console.error(`[Client ${index}] [MONITOR AUTOPLAY ERROR]`, err);
            });
        }
    }

    lastKnownStates.set(key, newState);
}

module.exports = {
    startTrackMonitor,
    stopTrackMonitor,
    checkPlayerState,
    activeTrackMonitors,
    lastKnownStates
};
