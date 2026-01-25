@echo off
REM ITSM-System Production Server Startup Script
REM Port: 6443 (HTTPS)

REM Wait for dev server to start first
timeout /t 10 /nobreak > nul

cd /d Z:\ITSM-System
set NODE_ENV=production

REM Create logs directory if not exists
if not exist "logs" mkdir logs

REM Start server with logging
echo [%date% %time%] Starting Production Server (Port 6443)... >> logs\prod-server.log
node backend\server.js >> logs\prod-server.log 2>&1
