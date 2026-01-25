@echo off
REM ITSM-System Server Stop Script
REM Stops both development and production servers

echo Stopping ITSM-System servers...

REM Find and kill Node.js processes on ports 5443, 6443, 8080, 9080
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":5443" ^| findstr "LISTENING"') do (
    echo Stopping Development Server HTTPS (PID: %%a)
    taskkill /F /PID %%a 2>nul
)

for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8080" ^| findstr "LISTENING"') do (
    echo Stopping Development Server HTTP (PID: %%a)
    taskkill /F /PID %%a 2>nul
)

for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":6443" ^| findstr "LISTENING"') do (
    echo Stopping Production Server HTTPS (PID: %%a)
    taskkill /F /PID %%a 2>nul
)

for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":9080" ^| findstr "LISTENING"') do (
    echo Stopping Production Server HTTP (PID: %%a)
    taskkill /F /PID %%a 2>nul
)

echo Done.
pause
