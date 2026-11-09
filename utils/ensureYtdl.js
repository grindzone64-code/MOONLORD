const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function ensureYtdl() {
    if (process.platform === 'win32') {
        const binDir = path.join(__dirname, '..', 'bin');
        const winBin = path.join(binDir, 'yt-dlp.exe');
        if (fs.existsSync(winBin)) return winBin;
        const winRoot = path.join(__dirname, '..', 'yt-dlp.exe');
        if (fs.existsSync(winRoot)) return winRoot;
        try {
            if (!fs.existsSync(binDir)) fs.mkdirSync(binDir, { recursive: true });
            console.log('[ensureYtdl] Downloading standalone yt-dlp.exe for Windows...');
            execSync(`curl -sL https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe -o "${winBin}"`, { timeout: 60000 });
            if (fs.existsSync(winBin)) return winBin;
        } catch (e) {
            console.warn('[ensureYtdl] Windows download notice:', e.message);
        }
        return 'yt-dlp.exe';
    }

    const binDir = path.join(__dirname, '..', 'bin');
    if (!fs.existsSync(binDir)) {
        try { fs.mkdirSync(binDir, { recursive: true }); } catch (e) {}
    }

    const localBin = path.join(binDir, 'yt-dlp');
    const systemBins = [
        localBin,
        path.join(process.cwd(), 'bin', 'yt-dlp'),
        '/usr/local/bin/yt-dlp',
        '/usr/bin/yt-dlp',
        '/tmp/yt-dlp',
        path.join(__dirname, '..', 'yt-dlp')
    ];

    for (const b of systemBins) {
        if (fs.existsSync(b)) {
            try { fs.chmodSync(b, 0o755); } catch (e) {}
            return b;
        }
    }

    try {
        console.log('[ensureYtdl] Downloading standalone yt-dlp binary into project bin directory...');
        execSync(`curl -sL https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o "${localBin}" && chmod +x "${localBin}"`, { timeout: 45000 });
        if (fs.existsSync(localBin)) {
            try { fs.chmodSync(localBin, 0o755); } catch (e) {}
            console.log('[ensureYtdl] Successfully installed yt-dlp to', localBin);
            return localBin;
        }
    } catch (e) {
        console.warn('[ensureYtdl] Download to bin failed:', e.message);
    }

    try {
        execSync(`curl -sL https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /tmp/yt-dlp && chmod +x /tmp/yt-dlp`, { timeout: 45000 });
        if (fs.existsSync('/tmp/yt-dlp')) {
            try { fs.chmodSync('/tmp/yt-dlp', 0o755); } catch (e) {}
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


