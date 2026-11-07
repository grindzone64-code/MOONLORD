@echo off
title Push MOON LORD to GitHub
color 0b
echo ===================================================
echo   MOON LORD // GITHUB DEPLOYMENT (NO SIZE LIMITS)
echo ===================================================
echo.
echo GitHub web drag-and-drop fails because .exe files are over 25 MB.
echo This script uploads your code directly through Git with NO limits!
echo.
echo Step 1: Open this link to create a token:
echo https://github.com/settings/tokens/new?scopes=repo^&description=render
echo.
echo Step 2: Click 'Generate token' and copy it (ghp_...).
echo.
set /p GHP_TOKEN="Step 3: Paste your GitHub Token here and press Enter: "

if "%GHP_TOKEN%"=="" (
    echo No token provided.
    pause
    exit /b
)

cd /d "%~dp0"
git remote remove origin 2>nul
git remote add origin https://%GHP_TOKEN%@github.com/grindzone64-code/MOONLORD.git
git branch -M main

echo.
echo Uploading clean project files to GitHub...
git push -u origin main --force

echo.
echo ===================================================
if %ERRORLEVEL% EQU 0 (
    echo   SUCCESS! All code uploaded to GitHub!
    echo   Now go to https://dashboard.render.com and click:
    echo   'Manual Deploy' -^> 'Deploy latest commit'
) else (
    echo   Push failed. Please make sure the token is valid and has 'repo' checked.
)
echo ===================================================
echo.
pause
