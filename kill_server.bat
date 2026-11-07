@echo off
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :5000') do (
    taskkill /f /pid %%a
    echo Process ID %%a killed.
)
echo Port 5000 cleared.
pause
