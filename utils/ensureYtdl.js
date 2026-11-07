const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function ensureYtdl() {
    if (process.platform === 'win32') return;

    const binDir = path.join(__dirname, '..', 'bin');
    if (!fs.existsSync(binDir)) {
        try { fs.mkdirSync(binDir, { recursive: true }); } catch (e) {}
    }

    const localBin = path.join(binDir, 'yt-dlp');
    const systemBins = ['/usr/local/bin/yt-dlp', '/usr/bin/yt-dlp', '/tmp/yt-dlp', localBin];

    for (const b of systemBins) {
        if (fs.existsSync(b)) {
            try { fs.chmodSync(b, 0o755); } catch (e) {}
            return b;
        }
    }

    try {
        console.log('[ensureYtdl] Downloading standalone yt-dlp binary for Linux...');
        execSync(`curl -sL https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o "${localBin}" && chmod +x "${localBin}"`, { timeout: 45000 });
        if (fs.existsSync(localBin)) {
            console.log('[ensureYtdl] Successfully installed yt-dlp to', localBin);
            return localBin;
        }
    } catch (e) {
        console.warn('[ensureYtdl] Download failed:', e.message);
    }

    try {
        execSync(`curl -sL https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /tmp/yt-dlp && chmod +x /tmp/yt-dlp`, { timeout: 45000 });
        if (fs.existsSync('/tmp/yt-dlp')) {
            console.log('[ensureYtdl] Successfully installed yt-dlp to /tmp/yt-dlp');
            return '/tmp/yt-dlp';
        }
    } catch (e) {
        console.warn('[ensureYtdl] /tmp fallback download failed:', e.message);
    }
}

if (require.main === module) {
    ensureYtdl();
}

module.exports = { ensureYtdl };
