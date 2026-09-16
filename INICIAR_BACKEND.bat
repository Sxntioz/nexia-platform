@echo off
title NEXIA - Backend (FastAPI)
cd /d "%~dp0backend"
if exist "..\.venv\Scripts\activate.bat" (
    call "..\.venv\Scripts\activate.bat"
) else if exist "venv\Scripts\activate.bat" (
    call "venv\Scripts\activate.bat"
)
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
pause