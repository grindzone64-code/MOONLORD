@echo off
title Push MOON LORD to GitHub for 24/7 Hosting
color 0b
echo ===================================================
echo   MOON LORD // PUSHING TO GITHUB REPOSITORY
echo   Repo: https://github.com/grindzone64-code/MOONLORD.git
echo ===================================================
echo.

cd /d "%~dp0"
git remote remove origin 2>nul
git remote add origin https://github.com/grindzone64-code/MOONLORD.git
git branch -M main

echo Uploading 61 files to GitHub...
echo A browser window may open to sign in to GitHub if not already logged in.
echo.
git push -u origin main

echo.
echo ===================================================
if %ERRORLEVEL% EQU 0 (
    echo   SUCCESS! All files uploaded to GitHub!
    echo   Now go to https://dashboard.render.com and deploy!
) else (
    echo   Push encountered an error. Please check your GitHub login.
)
echo ===================================================
echo.
pause
