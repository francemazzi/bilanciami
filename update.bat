@echo off
setlocal enabledelayedexpansion

echo ==========================================
echo   Bilanciami - Update Script
echo ==========================================
echo.

:: Get script directory
set "SCRIPT_DIR=%~dp0"
cd /d "%SCRIPT_DIR%"

:: Determine compose command
docker compose version >nul 2>nul
if %errorlevel% neq 0 (
    set "COMPOSE_CMD=docker-compose"
) else (
    set "COMPOSE_CMD=docker compose"
)

:: Check if we're in a git repository
if not exist ".git" (
    echo [ERROR] This is not a git repository
    echo Please clone the repository first or run this script from the project root.
    pause
    exit /b 1
)

:: Check for uncommitted changes
for /f %%i in ('git status --porcelain') do (
    echo [WARNING] You have uncommitted changes
    set /p "stash_changes=Do you want to stash them and continue? (y/N): "
    if /i "!stash_changes!"=="y" (
        git stash
        echo [OK] Changes stashed
        set "STASHED=1"
    ) else (
        echo [ERROR] Please commit or stash your changes before updating
        pause
        exit /b 1
    )
    goto :after_stash_check
)
:after_stash_check

echo.
echo Pulling latest changes from GitHub...
git fetch origin main
git pull origin main
echo [OK] Code updated to latest version

:: Restore stashed changes if any
if "!STASHED!"=="1" (
    echo.
    echo Restoring stashed changes...
    git stash pop || echo [WARNING] Could not restore stashed changes automatically
)

echo.
echo Stopping current services...
%COMPOSE_CMD% down
echo [OK] Services stopped

echo.
echo Rebuilding containers...
%COMPOSE_CMD% build --no-cache
echo [OK] Containers rebuilt

echo.
echo Starting services...
%COMPOSE_CMD% up -d
echo [OK] Services started

echo.
echo ==========================================
echo   Update Complete!
echo ==========================================
echo   Frontend:  http://localhost
echo   API:       http://localhost:8372
echo ==========================================
echo.
echo Use 'docker compose logs -f' to view logs
echo.

pause
