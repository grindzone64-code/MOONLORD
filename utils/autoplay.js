const { fetchAutoplayRecommendations } = require('../utils/helpers');

const autoplayStatus = new Map();
const autoplayHistory = new Map();
const autoplayInProgress = new Map();

/**
 * Trigger autoplay for a player
 */
async function triggerAutoplay(key, player, seedTrack, rainlink, token, client, index) {
    if (autoplayInProgress.get(key)) return;
    if (!player || !player.guildId) {
        console.log(`[Client ${index}] [AUTOPLAY] Invalid player for autoplay`);
        return;
    }

    autoplayInProgress.set(key, true);

    try {
        if (!seedTrack?.identifier) {
            console.log(`[Client ${index}] [AUTOPLAY] No valid seed track for autoplay`);
            autoplayInProgress.set(key, false);
            return;
        }

        const history = autoplayHistory.get(key) || [];
        const prevTracks = player.queue.previousTracks?.slice(-5) || [];

        console.log(`[Client ${index}] [AUTOPLAY] Seed: ${seedTrack.title} (${seedTrack.identifier})`);

        const seedList = await fetchAutoplayRecommendations(seedTrack.identifier, 7, index);
        const seedMap = new Map(seedList.map(t => [t.identifier, t]));

        let allRelated = [...seedMap.keys()];

        const otherRDs = [];
        for (const track of prevTracks) {
            if (!track?.identifier || track.identifier === seedTrack.identifier) continue;

            const list = await fetchAutoplayRecommendations(track.identifier, 7, index);
            otherRDs.push(list.map(t => t.identifier));
        }

        const countMap = new Map();
        for (const id of allRelated) countMap.set(id, 1);

        for (const rd of otherRDs) {
            for (const id of rd) {
                countMap.set(id, (countMap.get(id) || 0) + 1);
            }
        }

        const weightedPool = [...countMap.entries()]
            .filter(([id, count]) =>
                count >= 2 &&
                id !== seedTrack.identifier &&
                !history.includes(id) &&
                seedMap.has(id)
            )
            .map(([id]) => seedMap.get(id));

        const finalPool = weightedPool.length >= 4 ? weightedPool : seedList;

        // Shuffle
        for (let i = finalPool.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [finalPool[i], finalPool[j]] = [finalPool[j], finalPool[i]];
        }

        let selected = null;
        for (const r of finalPool) {
            try {
                if (!r?.url) continue;
                const found = await player.search(r.url);
                if (found?.tracks?.[0]) {
                    selected = found.tracks[0];
                    break;
                }
            } catch (err) {
                console.error(`[Client ${index}] [SEARCH ERROR] ${r?.url}`, err);
            }
        }

        if (!selected) {
            console.log(`[Client ${index}] No valid autoplay track found.`);
            autoplayInProgress.set(key, false);
            return;
        }

        player.queue.add(selected);
        if (!player.playing) await player.play();

        history.push(selected.identifier);
        if (history.length > 20) history.shift();
        autoplayHistory.set(key, history);

        try {
            const textChannel = await client.channels.fetch(player.textId);
            if (textChannel) {
                const msg = `**↻** Now Autoplaying: **${selected.title}**\n\n-# • Powered by Ansh`;

                const voiceChannelId = player.voiceId;
                if (voiceChannelId) {
                    const { updateVoiceChannelStatus } = require('../utils/helpers');
                    updateVoiceChannelStatus(voiceChannelId, `↻ ${selected.title} - Ansh AutoPlay ↻`, token, index);
                }

                await textChannel.send(msg);
            }
        } catch (err) {
            console.error(`[Client ${index}] [AUTOPLAY] Error sending message:`, err);
        }

        console.log(`[Client ${index}] 🎵 Autoplay triggered: ${selected.title}`);
    } catch (err) {
        console.error(`[Client ${index}] [AUTOPLAY] Error in autoplay process:`, err);
    } finally {
        setTimeout(() => {
            autoplayInProgress.set(key, false);
        }, 5000);
    }
}

module.exports = {
    triggerAutoplay,
    autoplayStatus,
    autoplayHistory,
    autoplayInProgress
};
