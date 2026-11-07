@echo off
title MOON LORD - Cloudflare Cloud Tunnel
echo ========================================================
echo    MOON LORD // Public Cloud Tunnel (Port-Free)
echo ========================================================
echo Starting Cloudflare Tunnel connected to local port 5000...
echo This gives you a public HTTPS URL with NO PORT for mobile!
echo.
"%~dp0bin\cloudflared.exe" tunnel --url http://127.0.0.1:5000
pause

