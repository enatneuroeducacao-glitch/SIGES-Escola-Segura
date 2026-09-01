@echo off
title SIGES - Atualizador do Sistema
color 0B

echo.
echo ============================================================
echo              SIGES - ESCOLA SEGURA
echo              ATUALIZACAO DO SISTEMA
echo ============================================================
echo.

cd /d "%~dp0"

echo [1/5] Verificando pasta do sistema...
if not exist "package.json" (
    echo.
    echo ERRO: package.json nao encontrado.
    echo Execute este arquivo dentro da pasta principal do SIGES.
    echo.
    pause
    exit /b 1
)

echo OK.
echo.

echo [2/5] Verificando Node.js...
node --version >nul 2>&1
if errorlevel 1 (
    echo.
    echo ERRO: Node.js nao encontrado.
    echo Instale o Node.js antes de continuar.
    echo.
    pause
    exit /b 1
)

echo Node.js encontrado.
echo.

echo [3/5] Atualizando dependencias...
call npm install

if errorlevel 1 (
    echo.
    echo ERRO durante a atualizacao das dependencias.
    echo O sistema NAO foi iniciado.
    echo.
    pause
    exit /b 1
)

echo.
echo Dependencias atualizadas.
echo.

echo [4/5] Verificando estrutura do projeto...

if not exist "frontend" (
    echo AVISO: pasta frontend nao encontrada.
)

if not exist "backend" (
    echo AVISO: pasta backend nao encontrada.
)

echo.
echo [5/5] Iniciando SIGES...
echo.
echo ============================================================
echo   SIGES sera aberto em:
echo   http://localhost:5173
echo ============================================================
echo.
echo NAO feche esta janela enquanto estiver usando o sistema.
echo.

call npm run dev

pause