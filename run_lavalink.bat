@echo off
title MOON LORD - Local Lavalink Audio Engine
cd /d "%~dp0\Lavalink"

echo ========================================================
echo       MOON LORD // Local Lavalink v4 Audio Engine
echo ========================================================
echo Host: 127.0.0.1 ^| Port: 2333 ^| Password: youshallnotpass
echo YouTube Engine: Enabled (High-Speed YouTube Streamer)
echo ========================================================
echo.

where java >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Java 17+ is not installed or not in PATH.
    echo Download and install Java 17 from: https://adoptium.net/
    echo The bot will continue using its built-in Native Audio Engine.
    pause
    exit /b 1
)

if not exist "Lavalink.jar" (
    echo [INFO] Lavalink.jar not found. Downloading Lavalink v4.0.8...
    curl.exe -L -o "Lavalink.jar" "https://github.com/lavalink-devs/Lavalink/releases/download/4.0.8/Lavalink.jar"
    if %errorlevel% neq 0 (
        echo [ERROR] Failed to download Lavalink.jar.
        pause
        exit /b 1
    )
)

echo Starting Local Lavalink Server on 127.0.0.1:2333...
java -jar Lavalink.jar
if %errorlevel% neq 0 (
    echo.
    echo [NOTICE] Lavalink server stopped.
    pause
)
