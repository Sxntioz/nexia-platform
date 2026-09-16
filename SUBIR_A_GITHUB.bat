@echo off
title NEXIA - Subir a GitHub
cd /d "%~dp0"
set "PATH=C:\Users\santi\.tools\mingit\cmd;%PATH%"

echo ========================================================
echo   NEXIA - SUBIR PROYECTO A GITHUB (Sxntioz/nexia-platform)
echo ========================================================
echo.
echo 1. Verificando estado del repositorio...
git status
echo.
echo 2. Subiendo tus archivos a GitHub...
echo (Si se abre una ventana en tu navegador, haz clic en Autorizar / Sign in)
echo.
git push -u origin main
echo.
if %ERRORLEVEL% EQU 0 (
    echo ========================================================
    echo   EXITO: Tu codigo ya esta subido en GitHub!
    echo   Visita: https://github.com/Sxntioz/nexia-platform
    echo ========================================================
) else (
    echo Hubo un detalle al subir. Revisa el mensaje arriba.
)
echo.
pause
