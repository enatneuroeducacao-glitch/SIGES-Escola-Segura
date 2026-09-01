@echo off
cd /d "%~dp0"
echo ============================================
echo SIGES - ESCOLA SEGURA - AMBIENTE LOCAL
 echo ============================================
if not exist node_modules (
  echo Instalando dependencias iniciais...
  call npm install
)
echo.
echo Iniciando API e interface...
call npm run dev
pause
