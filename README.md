# Self__bot - Discord Selfbot & Control Unit

A powerful Discord selfbot control unit and web dashboard featuring high-performance Lavalink v4 music streaming, multi-token management, real-time track monitoring, and optional automated AI captcha solving.

> **Disclaimer:** This software is for educational and research purposes only. Automating user accounts violates Discord's Terms of Service and may lead to account termination. Use at your own risk.

---

## Features

- **Web Dashboard & Control Panel:** Modern web interface (port 5000) with authentication, real-time system monitoring, and player controls.
- **Lavalink v4 Audio Streaming:** High-fidelity voice streaming powered by Lavalink v4 and Rainlink with audio filters and real-time state management.
- **Multi-Token Support:** Manage and run multiple Discord tokens simultaneously with hot-reloading.
- **Autoplay & Track Monitor:** Automatic track recommendations and queue management when songs end.
- **AI Captcha Solver (hcap):** Optional Python-based hCaptcha solver using Playwright and AI integration.
- **Desktop Application:** Electron-based desktop control unit support.

---

## Project Structure

```
selfbot/
├── config/
│   └── config.js              # Bot configuration, credentials & Lavalink nodes
├── Lavalink/
│   └── application.yml        # Lavalink server configuration & plugin definitions
├── public/                    # Web dashboard frontend (HTML, CSS, JS)
├── utils/                     # Core backend utilities (WebServer, Autoplay, TrackMonitor)
├── hcap/                      # Python AI Captcha Solver server
├── electron-main.js           # Electron desktop wrapper
├── index.js                   # Main application entry point
├── launcher.js                # Portable entry point
├── Start_Selfbot.bat          # All-in-one startup script
├── run_lavalink.bat           # Lavalink server launcher & auto-installer
└── run_hcap.bat               # Python Captcha Solver launcher
```

---

## Getting Started

### Prerequisites

- **Node.js** (v18 or newer)
- **Python** (3.10+ recommended for Captcha Solver)
- **Java 17** (for Lavalink - automatically installed if missing by `run_lavalink.bat`)
- **FFmpeg** (place `ffmpeg.exe` in the root folder or have it in your system PATH)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/ShravanDDeotale/Self__bot.git
   cd Self__bot
   ```

2. Install Node.js dependencies:
   ```bash
   npm install
   ```

3. (Optional) Install Python solver dependencies:
   ```bash
   pip install -r requirements.txt
   playwright install chromium
   ```

4. Or run the automated installer:
   ```bash
   Install_All_Requirements.bat
   ```

---

## Configuration

1. **Bot & Web Settings:**
   Open `config/config.js` and configure:
   - `webUsername` & `webPassword`: Dashboard login credentials.
   - `lookupToken`: Discord bot/user token for user lookup.
   - `openRouterKey`: (Optional) OpenRouter API key for AI captcha solving.
   - `allowedUserIds`: Discord user IDs authorized to use bot commands.

2. **Discord Tokens:**
   Create a `tokens.txt` file in the root directory and add your Discord tokens (one per line). Tokens can also be added live via the Web Dashboard.

---

## Running the Bot

### Option 1: All-in-One
Run `Start_Selfbot.bat` to automatically launch the Lavalink server, AI captcha solver, and dashboard backend.

### Option 2: Individual Services
1. **Lavalink Server:**
   ```bash
   run_lavalink.bat
   ```
2. **AI Captcha Solver (Optional):**
   ```bash
   run_hcap.bat
   ```
3. **Bot Dashboard Backend:**
   ```bash
   node index.js
   ```

Once running, access the web control panel at **`http://localhost:5000`**.

---

## License

ISC License. Made for educational purposes.

<!-- Deployment trigger: 2026-11-07 13:12:04 -->
