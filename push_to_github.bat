@echo off
title Push MOON LORD to GitHub for 24/7 Hosting
color 0b
echo ===================================================
echo   MOON LORD // 24/7 CLOUD HOSTING DEPLOYMENT SETUP
echo ===================================================
echo.

cd /d "%~dp0"

echo [1/3] Initializing local git repository...
git init
git add .
git commit -m "Deploy MOON LORD Control Unit to 24/7 Cloud"
git branch -M main

echo.
echo [2/3] Repository initialized successfully!
echo.
echo ---------------------------------------------------
echo NEXT STEPS TO DEPLOY TO RENDER (24/7 CLOUD):
echo 1. Open https://github.com/new and create a new repository (name: moon-lord).
echo 2. Copy your GitHub repository URL (e.g. https://github.com/USERNAME/moon-lord.git).
echo ---------------------------------------------------
echo.
set /p REPO_URL="Enter your GitHub Repository URL (or press Enter to skip): "

if not "%REPO_URL%"=="" (
    git remote remove origin 2>nul
    git remote add origin %REPO_URL%
    echo.
    echo [3/3] Pushing code to GitHub...
    git push -u origin main
    echo.
    echo ===================================================
    echo   SUCCESS! Code pushed to GitHub!
    echo   Now connect this repo in your Render dashboard:
    echo   https://dashboard.render.com
    echo ===================================================
) else (
    echo.
    echo To push manually later, run:
    echo git remote add origin ^<YOUR_GITHUB_REPO_URL^>
    echo git push -u origin main
)

echo.
pause

