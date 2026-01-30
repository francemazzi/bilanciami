@echo off
setlocal enabledelayedexpansion

echo ==========================================
echo   Bilanciami - Installation Script
echo ==========================================
echo.
echo If Windows asks to allow this script, choose "Run" or "Allow".
echo Only ONE window should open. Please wait...
echo.

:: Get script directory
set "SCRIPT_DIR=%~dp0"
cd /d "%SCRIPT_DIR%"

:: Check if Docker is installed
echo Checking Docker installation...

where docker >nul 2>nul
if %errorlevel% neq 0 (
    echo [WARNING] Docker is not installed
    echo.
    echo Please download and install Docker Desktop from:
    echo https://www.docker.com/products/docker-desktop/
    echo.
    echo After installation, restart this script.
    echo.
    goto :end
)
echo [OK] Docker is installed

:: Check if Docker daemon is running
docker info >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Docker daemon is not running
    echo Please start Docker Desktop and try again.
    goto :end
)
echo [OK] Docker daemon is running

:: Check Docker Compose
docker compose version >nul 2>nul
if %errorlevel% neq 0 (
    docker-compose version >nul 2>nul
    if %errorlevel% neq 0 (
        echo [ERROR] Docker Compose is not available
        echo Please install Docker Compose and try again.
        goto :end
    ) else (
        set "COMPOSE_CMD=docker-compose"
        echo [OK] Docker Compose (standalone) is available
    )
) else (
    set "COMPOSE_CMD=docker compose"
    echo [OK] Docker Compose is available
)

:: Setup environment
call :setup_env

:: Create uploads directory
if not exist "%SCRIPT_DIR%uploads" mkdir "%SCRIPT_DIR%uploads"
echo [OK] Uploads directory ready

:: Start the application
echo.
echo Starting Bilanciami...
echo.

%COMPOSE_CMD% build
if %errorlevel% neq 0 (
    echo [ERROR] Build failed
    goto :end
)

%COMPOSE_CMD% up -d
if %errorlevel% neq 0 (
    echo [ERROR] Failed to start containers
    goto :end
)

echo.
echo [OK] Bilanciami is starting!
echo.
echo ==========================================
echo   Application URLs:
echo ==========================================
echo   Frontend:  http://localhost
echo   API:       http://localhost:8372
echo ==========================================
echo.
echo Use 'docker compose logs -f' to view logs
echo Use 'docker compose down' to stop
echo.
goto :end

:setup_env
echo.
echo Setting up environment...

set "ENV_FILE=%SCRIPT_DIR%.env"

if exist "%ENV_FILE%" (
    findstr /r "^ENCRYPTION_KEY=." "%ENV_FILE%" >nul 2>nul
    if !errorlevel! equ 0 (
        echo [OK] .env file already configured
        goto :eof
    )
)

:: Generate encryption key using PowerShell (hidden window to avoid extra console)
echo Generating encryption key...
for /f "delims=" %%a in ('powershell -NoProfile -WindowStyle Hidden -Command "[System.BitConverter]::ToString([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32)).Replace('-','')"') do set "ENCRYPTION_KEY=%%a"
if not defined ENCRYPTION_KEY (
    echo [WARNING] PowerShell key generation failed, using fallback...
    set "ENCRYPTION_KEY=%RANDOM%%RANDOM%%RANDOM%%RANDOM%%RANDOM%%RANDOM%%RANDOM%%RANDOM%"
)

:: Write .env file
(
    echo # Encryption key for sensitive data ^(auto-generated^)
    echo ENCRYPTION_KEY=!ENCRYPTION_KEY!
) > "%ENV_FILE%"

echo [OK] .env file created
echo.
echo Note: You can configure your OpenAI API key in the app settings after login.
goto :eof

:end
echo.
echo Press any key to close...
pause >nul
