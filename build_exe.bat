@echo off
title MOON LORD - EXE Builder
echo =====================================================
echo   Building MOON LORD (.exe desktop app)
echo =====================================================
echo.

:: Ensure dependencies are present
if not exist "node_modules\electron" (
    echo [SETUP] Installing dependencies...
    call npm install
)

echo [BUILD] Packaging portable .exe via electron-builder...
call npx electron-builder --win portable
if errorlevel 1 (
    echo.
    echo [ERROR] Build failed. Scroll up for details.
    pause
    exit /b 1
)

echo.
echo =====================================================
echo   DONE!  Your app is in:  dist_electron\
echo   Run: MOON-LORD-1.0.0.exe
echo.
echo   Keep tokens.txt, config\ and Lavalink next to the
echo   .exe (or run it from this project folder).
echo =====================================================
pause
