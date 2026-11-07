#!/data/data/com.termux/files/usr/bin/bash
# ============================================
# MOON LORD — Termux One-Click Mobile Starter
# ============================================
echo "=========================================="
echo "      MOON LORD Mobile Control Unit       "
echo "=========================================="
echo "[SYSTEM] Checking dependencies..."
if ! command -v node &> /dev/null; then
    echo "[SYSTEM] Installing Node.js & FFmpeg..."
    pkg update -y && pkg install -y nodejs ffmpeg python
fi

echo "[SYSTEM] Installing package dependencies..."
npm install --no-audit

echo "[SYSTEM] Launching MOON LORD Mobile Engine..."
echo "[SYSTEM] Dashboard will be live on http://127.0.0.1:5000"
echo "=========================================="
node index.js

