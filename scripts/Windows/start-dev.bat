@echo off
setlocal enabledelayedexpansion
REM ===================================================================
REM ITSM-Sec Nexus - Windows Development Environment Startup Script
REM ===================================================================
REM Usage: scripts\Windows\start-dev.bat
REM ===================================================================

echo.
echo ========================================
echo  ITSM-Sec Nexus Development Startup
echo ========================================
echo.

REM Move to project root
cd /d "%~dp0"
cd ..\..

echo [1/5] Checking environment...

REM Check Node.js
where node >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js is not installed
    pause
    exit /b 1
)
echo [OK] Node.js found

REM Check npm
where npm >nul 2>&1
if errorlevel 1 (
    echo [ERROR] npm is not installed
    pause
    exit /b 1
)
echo [OK] npm found

echo.
echo [2/5] Checking dependencies...
if not exist node_modules (
    echo Installing dependencies...
    call npm install
    if errorlevel 1 (
        echo [ERROR] npm install failed
        pause
        exit /b 1
    )
)
echo [OK] Dependencies ready

echo.
echo [3/5] Running migrations...
call npm run migrate:latest
if errorlevel 1 (
    echo [WARN] Migrations may have failed
)
echo [OK] Migrations complete

REM Get local IP address
echo.
echo [4/5] Detecting IP address...

REM Try PowerShell method first (more reliable)
for /f "tokens=*" %%a in ('powershell -Command "(Get-NetIPAddress -AddressFamily IPv4 -InterfaceAlias 'Ethernet*','Wi-Fi*' | Where-Object {$_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.*'} | Select-Object -First 1).IPAddress"') do (
    set IP=%%a
)

REM If PowerShell fails, try ipconfig method
if not defined IP (
    for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr "IPv4"') do (
        set TEMP_IP=%%a
        set TEMP_IP=!TEMP_IP: =!
        REM Skip 127.0.0.1 and 169.254.x.x
        echo !TEMP_IP! | findstr /r "^127\." >nul
        if errorlevel 1 (
            echo !TEMP_IP! | findstr /r "^169\.254\." >nul
            if errorlevel 1 (
                set IP=!TEMP_IP!
                goto :ip_found
            )
        )
    )
)
:ip_found

if not defined IP (
    set IP=localhost
    echo [WARN] Could not detect IP address, using localhost
) else (
    echo [OK] Detected IP: !IP!
)

echo.
echo ========================================
echo  Access URLs
echo ========================================
echo.
echo Local Access:
echo   Frontend: http://localhost:8080/index.html
echo   Backend:  http://localhost:5000/api/v1
echo.
echo Network Access (Recommended):
echo   Frontend: http://!IP!:8080/index.html
echo   Backend:  http://!IP!:5000/api/v1
echo.
echo API Docs: http://!IP!:5000/api-docs
echo.
echo ========================================

REM Open browser with network IP
timeout /t 2 /nobreak >nul
start http://!IP!:8080/index.html

echo.
echo [5/5] Starting servers...
echo.
echo Starting Backend API (Port 5000) and Frontend (Port 8080)...
echo Press CTRL+C to stop all servers
echo.

REM Start development servers (both in one window)
npm run dev
