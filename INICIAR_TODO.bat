@echo off
title NEXIA - Iniciar Plataforma Completa
echo ====================================================
echo           INICIANDO NEXIA - GRUPO NEXUS
echo ====================================================
echo.

echo [1/2] Iniciando Servidor Backend (FastAPI - Puerto 8000)...
start "NEXIA Backend" cmd /k "cd /d %~dp0backend && (if exist ..\.venv\Scripts\activate.bat (call ..\.venv\Scripts\activate.bat) else (if exist venv\Scripts\activate.bat (call venv\Scripts\activate.bat))) && python -m uvicorn app.main:app --host 127.0.0.1 --port 8000"

timeout /t 2 /nobreak > nul

echo [2/2] Iniciando Servidor Frontend (Vite - Puerto 5173)...
start "NEXIA Frontend" cmd /k "cd /d %~dp0frontend && call npm run dev -- --host 127.0.0.1 --port 5173"

timeout /t 3 /nobreak > nul

echo.
echo ====================================================
echo   NEXIA esta listo! Abriendo navegador...
echo   Frontend: http://localhost:5173
echo   Backend:  http://127.0.0.1:8000
echo ====================================================
start http://localhost:5173
exit