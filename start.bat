@echo off
chcp 65001 >nul 2>nul
setlocal enabledelayedexpansion

:: Keep window open on error
if not defined BILANCIAMI_INNER (
    set "BILANCIAMI_INNER=1"
    cmd /k "%~f0" %*
    exit /b
)

echo.
echo ==========================================
echo   Bilanciami - Installation Script
echo ==========================================
echo.

:: Get script directory
set "SCRIPT_DIR=%~dp0"
echo Working directory: %SCRIPT_DIR%
cd /d "%SCRIPT_DIR%"
if errorlevel 1 (
    echo [ERROR] Cannot change to script directory
    goto :end
)

:: Check if Docker is installed
echo.
echo Checking Docker installation...

where docker >nul 2>nul
if errorlevel 1 (
    echo [WARNING] Docker is not installed or not in PATH
    echo.
    echo Please download and install Docker Desktop from:
    echo https://www.docker.com/products/docker-desktop/
    echo.
    echo After installation, restart this script.
    goto :end
)
echo [OK] Docker is installed

:: Check if Docker daemon is running
echo Checking if Docker daemon is running...
docker info >nul 2>nul
if errorlevel 1 (
    echo [WARNING] Docker daemon is not running
    echo.
    echo Attempting to start Docker Desktop...
    set "DOCKER_DESKTOP="
    if exist "C:\Program Files\Docker\Docker\Docker Desktop.exe" set "DOCKER_DESKTOP=C:\Program Files\Docker\Docker\Docker Desktop.exe"
    if exist "C:\Program Files (x86)\Docker\Docker\Docker Desktop.exe" set "DOCKER_DESKTOP=C:\Program Files (x86)\Docker\Docker\Docker Desktop.exe"
    if defined DOCKER_DESKTOP (
        start "" "!DOCKER_DESKTOP!"
        echo Docker Desktop is starting. Waiting for the daemon (up to 60 seconds)...
        set "RETRY=0"
        :wait_docker
        timeout /t 5 /nobreak >nul 2>nul
        set /a RETRY+=5
        docker info >nul 2>nul
        if not errorlevel 1 goto :docker_ready
        if !RETRY! lss 60 (
            echo Still waiting... !RETRY!s
            goto :wait_docker
        )
    )
    echo.
    echo [ERROR] Docker daemon is not running
    echo.
    echo Please start Docker Desktop manually and wait until the tray icon
    echo shows "Docker Desktop is running". Then run this script again.
    echo.
    echo If Docker Desktop is already open, wait a few more seconds for it
    echo to finish starting and run this script again.
    goto :end
)
:docker_ready
echo [OK] Docker daemon is running

:: Check Docker Compose
echo Checking Docker Compose...
docker compose version >nul 2>nul
if errorlevel 1 (
    docker-compose version >nul 2>nul
    if errorlevel 1 (
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
if errorlevel 1 goto :end

:: Create uploads directory
if not exist "%SCRIPT_DIR%uploads" (
    mkdir "%SCRIPT_DIR%uploads"
    if errorlevel 1 (
        echo [ERROR] Cannot create uploads directory
        goto :end
    )
)
echo [OK] Uploads directory ready

:: Start the application
echo.
echo ==========================================
echo   Building Bilanciami (this may take a few minutes)...
echo ==========================================
echo.

%COMPOSE_CMD% build
if errorlevel 1 (
    echo.
    echo [ERROR] Build failed. See errors above.
    goto :end
)

echo.
echo ==========================================
echo   Starting containers...
echo ==========================================
echo.

%COMPOSE_CMD% up -d
if errorlevel 1 (
    echo.
    echo [ERROR] Failed to start containers. See errors above.
    goto :end
)

echo.
echo ==========================================
echo   SUCCESS! Bilanciami is running!
echo ==========================================
echo.
echo   Open your browser and go to:
echo.
echo      http://localhost
echo.
echo ==========================================
echo.
echo   To view logs:     docker compose logs -f
echo   To stop:          docker compose down
echo.
goto :end

:setup_env
echo.
echo Setting up environment...

set "ENV_FILE=%SCRIPT_DIR%.env"

if exist "%ENV_FILE%" (
    findstr /c:"ENCRYPTION_KEY=" "%ENV_FILE%" >nul 2>nul
    if not errorlevel 1 (
        echo [OK] .env file already configured
        exit /b 0
    )
)

:: Generate encryption key using PowerShell
echo Generating encryption key...
set "ENCRYPTION_KEY="
for /f "usebackq delims=" %%a in (`powershell -NoProfile -ExecutionPolicy Bypass -Command "[System.BitConverter]::ToString([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32)).Replace('-','')" 2^>nul`) do set "ENCRYPTION_KEY=%%a"

if not defined ENCRYPTION_KEY (
    echo [WARNING] PowerShell failed, using alternative method...
    set "ENCRYPTION_KEY=%RANDOM%%RANDOM%%RANDOM%%RANDOM%%RANDOM%%RANDOM%%RANDOM%%RANDOM%"
)

:: Write .env file
echo Creating .env file...
(
    echo # Encryption key for sensitive data (auto-generated)
    echo ENCRYPTION_KEY=!ENCRYPTION_KEY!
) > "%ENV_FILE%"

if not exist "%ENV_FILE%" (
    echo [ERROR] Cannot create .env file
    exit /b 1
)

echo [OK] .env file created
echo.
echo Note: You can configure your OpenAI API key in the app settings after login.
exit /b 0

:end
echo.
echo ==========================================
echo   Press any key to close this window...
echo ==========================================
pause >nul
exit
