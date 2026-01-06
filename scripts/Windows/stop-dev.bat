@echo off
REM ===================================================================
REM ITSM-Sec Nexus - Windows Development Environment Stop Script
REM ===================================================================
REM This script stops all running backend and frontend servers
REM Usage: scripts\startup\stop-dev.bat
REM ===================================================================

echo.
echo ========================================
echo  ITSM-Sec Nexus - Stopping Servers
echo ========================================
echo.

REM -------------------------------------------------------------------
REM Kill processes using port 5000 (Backend API)
REM -------------------------------------------------------------------
echo [1/2] Stopping Backend API Server (Port 5000)...

netstat -ano | findstr :5000 | findstr LISTENING >nul 2>&1
if %errorlevel% equ 0 (
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5000 ^| findstr LISTENING') do (
        echo Killing process PID: %%a
        taskkill /F /PID %%a >nul 2>&1
    )
    echo [OK] Backend API Server stopped
) else (
    echo [INFO] No process found on port 5000
)

REM -------------------------------------------------------------------
REM Kill processes using port 8080 (Frontend HTTP)
REM -------------------------------------------------------------------
echo.
echo [2/2] Stopping Frontend HTTP Server (Port 8080)...

netstat -ano | findstr :8080 | findstr LISTENING >nul 2>&1
if %errorlevel% equ 0 (
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr :8080 ^| findstr LISTENING') do (
        echo Killing process PID: %%a
        taskkill /F /PID %%a >nul 2>&1
    )
    echo [OK] Frontend HTTP Server stopped
) else (
    echo [INFO] No process found on port 8080
)

REM -------------------------------------------------------------------
REM Kill all Node.js processes related to this project (optional)
REM -------------------------------------------------------------------
REM Uncomment below to kill ALL Node.js processes (use with caution)
REM echo.
REM echo [3/3] Stopping all Node.js processes...
REM taskkill /F /IM node.exe >nul 2>&1
REM echo [OK] All Node.js processes stopped

echo.
echo ========================================
echo  All servers stopped successfully
echo ========================================
echo.

pause
