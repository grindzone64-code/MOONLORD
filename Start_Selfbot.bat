@echo off
title MOON LORD Runner

echo ========================================================
echo    MOON LORD // Control Unit ^& Bot Runner
echo ========================================================
echo Local PC IP on Wi-Fi: http://192.168.1.3:5000
echo Mobile phones on same Wi-Fi can connect directly to:
echo   http://192.168.1.3:5000
echo.
echo Automatic Cloudflare Tunnel will start in background.
echo ========================================================
echo.

echo Starting Local AI Captcha Solver (Python)...
start "AI Captcha Solver" cmd /c "run_hcap.bat"

echo.
echo Starting Node.js Selfbot Dashboard (Port 5000)...
node index.js
pause
