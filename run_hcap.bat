@echo off
title Local AI Captcha Solver (hcap)
echo ====================================
echo Starting Local AI Captcha Solver (Port 5001)
echo Powered by Playwright and OpenRouter (GPT-4o)
echo ====================================

cd /d "%~dp0"
python -m hcap.app
pause
