@echo off
title NEXIA - Frontend (Vite)
cd /d "%~dp0frontend"
call npm run dev -- --host 127.0.0.1 --port 5173
pause