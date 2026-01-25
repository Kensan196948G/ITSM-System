@echo off
REM ITSM-System Development Server Startup Script
REM Port: 5443 (HTTPS)

cd /d Z:\ITSM-System
set NODE_ENV=development

REM Create logs directory if not exists
if not exist "logs" mkdir logs

REM Start server with logging
echo [%date% %time%] Starting Development Server (Port 5443)... >> logs\dev-server.log
node backend\server.js >> logs\dev-server.log 2>&1
