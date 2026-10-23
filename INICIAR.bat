@echo off
chcp 65001 >nul
cd /d "%~dp0"
title profesionalesok
echo.
echo  profesionalesok - iniciando el sitio...
echo.
where node >nul 2>nul
if errorlevel 1 (
  echo  Falta instalar Node.js. Descargalo de https://nodejs.org ^(version LTS^),
  echo  instalalo, y volve a hacer doble clic en este archivo.
  echo.
  pause
  exit /b 1
)
if not exist .env copy .env.example .env >nul
if not exist node_modules (
  echo  Primera vez: instalando dependencias. Puede tardar unos minutos...
  call npm install
  if errorlevel 1 (
    echo.
    echo  Fallo la instalacion. Revisa tu conexion a internet y volve a intentar.
    pause
    exit /b 1
  )
)
echo.
echo  Listo. En unos segundos se abre el navegador en http://localhost:3000
echo  NO CIERRES ESTA VENTANA mientras uses el sitio. Para apagarlo, cerrala.
echo.
start "" cmd /c "timeout /t 10 /nobreak >nul & start http://localhost:3000"
call npm run dev
pause
