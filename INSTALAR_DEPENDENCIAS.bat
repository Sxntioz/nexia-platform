@echo off
title NEXIA - Instalador de Dependencias
echo ====================================================
echo      INSTALACION DE DEPENDENCIAS - NEXIA
echo ====================================================
echo.

echo [1/3] Verificando Python...
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] No se encontro Python en tu sistema.
    echo Por favor instala Python 3.10 o superior desde https://www.python.org/
    echo IMPORTANTE: Marca la casilla 'Add python.exe to PATH' durante la instalacion.
    pause
    exit /b 1
)
python --version

echo.
echo [2/3] Configurando entorno virtual e instalando Backend...
cd /d "%~dp0"
if not exist ".venv" (
    echo Creando entorno virtual .venv...
    python -m venv .venv
)
call .venv\Scripts\activate.bat
python -m pip install --upgrade pip
pip install -r backend\requirements.txt

echo.
echo [3/3] Verificando Node.js e instalando Frontend...
cd /d "%~dp0frontend"
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] No se encontro Node.js en tu sistema.
    echo Por favor instala Node.js (version LTS) desde https://nodejs.org/
    pause
    exit /b 1
)
node --version
echo Instalando paquetes de Node...
call npm install

echo.
echo ====================================================
echo   TODO INSTALADO CON EXITO!
echo   Ya puedes ejecutar 'INICIAR_TODO.bat' para abrir NEXIA.
echo ====================================================
pause
exit /b 0