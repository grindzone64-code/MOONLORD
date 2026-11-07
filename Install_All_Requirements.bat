@echo off
title Shravan Selfbot - All-in-One Installer
setlocal enabledelayedexpansion

echo ===================================================
echo   Shravan Selfbot - Automated Requirements Setup
echo ===================================================
echo.

:: 1. Check for Node.js
echo [1/4] Checking Node.js...
node -v >nul 2>&1
if !errorlevel! neq 0 (
    echo [ERROR] Node.js is NOT installed. Please install it from https://nodejs.org/
    pause
    exit /b
)
echo [OK] Node.js is installed.

:: 2. Install Node.js Dependencies
echo.
echo [2/4] Installing Node.js packages (npm install)...
call npm install
if !errorlevel! neq 0 (
    echo [ERROR] npm install failed. Check your internet connection.
) else (
    echo [OK] Node.js packages installed successfully.
)

:: 3. Check for Python and Install AI Solver Requirements
echo.
echo [3/4] Checking Python for Captcha Solver...
python --version >nul 2>&1
if !errorlevel! neq 0 (
    echo [SKIP] Python not found. Captcha Solver will NOT work.
    echo        (To use it, install Python from https://python.org/ and check "Add to PATH")
) else (
    echo [OK] Python found. Installing Python requirements...
    python -m pip install flask requests playwright flask_cors
    echo [OK] Installing Playwright browsers (Chromium)...
    python -m playwright install chromium
    echo [OK] Python dependencies setup complete.
)

:: 4. Check for Lavalink
echo.
echo [4/4] Finalizing Setup...
if exist "Lavalink\Lavalink.jar" (
    echo [OK] Lavalink.jar found.
) else (
    echo [WARNING] Lavalink.jar not found in \Lavalink folder. 
    echo           Make sure to copy it for music to work.
)

echo.
echo ===================================================
echo   SETUP COMPLETE! 
echo ===================================================
echo 1. Put your tokens in 'tokens.txt'
echo 2. Run 'run_lavalink.bat' (First window)
echo 3. Run 'run_hcap.bat' (Second window - optional)
echo 4. Run 'Start_Selfbot.bat' (Third window)
echo.
echo Open http://localhost:5000 in your browser.
echo ===================================================
pause
