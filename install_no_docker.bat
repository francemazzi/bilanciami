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
echo   Bilanciami - Installation (No Docker)
echo   Using SQLite Database
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

:: Check if Node.js is installed
echo.
echo Checking Node.js installation...

where node >nul 2>nul
if errorlevel 1 (
    echo [WARNING] Node.js is not installed
    echo.

    :: Try to install with winget
    where winget >nul 2>nul
    if not errorlevel 1 (
        echo Found winget. Installing Node.js automatically...
        echo.
        winget install OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements
        if not errorlevel 1 (
            echo.
            echo [OK] Node.js installed successfully!
            echo.
            echo IMPORTANT: You need to restart this script in a NEW terminal
            echo for Node.js to be available.
            echo.
            echo Please close this window and run install_no_docker.bat again.
            goto :end
        ) else (
            echo [WARNING] Winget installation failed. Trying manual method...
        )
    )

    :: Fallback to manual download
    echo.
    echo Node.js is required to run Bilanciami.
    echo.
    set /p "INSTALL_NODE=Do you want to open the download page? (Y/N): "
    if /i "!INSTALL_NODE!"=="Y" (
        echo.
        echo Opening Node.js download page...
        start https://nodejs.org/en/download/
        echo.
        echo Please install Node.js 22 LTS, then run this script again.
    ) else (
        echo.
        echo Please download and install Node.js 22 LTS from:
        echo https://nodejs.org/
    )
    echo.
    echo After installation, open a NEW terminal and run this script again.
    goto :end
)

:: Check Node.js version
for /f "tokens=1 delims=v" %%a in ('node -v 2^>nul') do set "NODE_VERSION=%%a"
for /f "tokens=1 delims=." %%a in ('node -v 2^>nul') do set "NODE_MAJOR=%%a"
set "NODE_MAJOR=%NODE_MAJOR:v=%"
echo [OK] Node.js is installed (version: %NODE_MAJOR%)

if %NODE_MAJOR% LSS 20 (
    echo [WARNING] Node.js version 20 or higher is recommended
    echo Current version: %NODE_MAJOR%
)

:: Check npm
where npm >nul 2>nul
if errorlevel 1 (
    echo [ERROR] npm is not installed or not in PATH
    goto :end
)
echo [OK] npm is available

:: Setup environment
call :setup_env
if errorlevel 1 goto :end

:: Create directories
if not exist "%SCRIPT_DIR%uploads" mkdir "%SCRIPT_DIR%uploads"
if not exist "%SCRIPT_DIR%data" mkdir "%SCRIPT_DIR%data"
echo [OK] Directories ready

:: Switch to SQLite schema
echo.
echo ==========================================
echo   Configuring SQLite Database...
echo ==========================================
echo.

if exist "%SCRIPT_DIR%server\prisma\schema.sqlite.prisma" (
    copy /y "%SCRIPT_DIR%server\prisma\schema.sqlite.prisma" "%SCRIPT_DIR%server\prisma\schema.prisma" >nul
    if errorlevel 1 (
        echo [ERROR] Cannot copy SQLite schema
        goto :end
    )
    echo [OK] SQLite schema configured
) else (
    echo [ERROR] SQLite schema file not found
    echo Expected: server\prisma\schema.sqlite.prisma
    goto :end
)

:: Install server dependencies
echo.
echo ==========================================
echo   Installing Server Dependencies...
echo ==========================================
echo.

cd /d "%SCRIPT_DIR%server"
if errorlevel 1 (
    echo [ERROR] Cannot change to server directory
    goto :end
)

call npm install
if errorlevel 1 (
    echo [ERROR] Failed to install server dependencies
    goto :end
)
echo [OK] Server dependencies installed

:: Generate Prisma client
echo.
echo Generating Prisma client...
call npx prisma generate
if errorlevel 1 (
    echo [ERROR] Failed to generate Prisma client
    goto :end
)
echo [OK] Prisma client generated

:: Run database migrations
echo.
echo Creating SQLite database and running migrations...
call npx prisma db push
if errorlevel 1 (
    echo [ERROR] Failed to setup database
    goto :end
)
echo [OK] Database ready

:: Install client dependencies
echo.
echo ==========================================
echo   Installing Client Dependencies...
echo ==========================================
echo.

cd /d "%SCRIPT_DIR%client"
if errorlevel 1 (
    echo [ERROR] Cannot change to client directory
    goto :end
)

call npm install
if errorlevel 1 (
    echo [ERROR] Failed to install client dependencies
    goto :end
)
echo [OK] Client dependencies installed

:: Build client
echo.
echo ==========================================
echo   Building Frontend...
echo ==========================================
echo.

call npm run build
if errorlevel 1 (
    echo [ERROR] Failed to build frontend
    goto :end
)
echo [OK] Frontend built

cd /d "%SCRIPT_DIR%"

echo.
echo ==========================================
echo   SUCCESS! Installation Complete!
echo ==========================================
echo.
echo   To start the application, run:
echo.
echo      start_no_docker.bat
echo.
echo   Or manually:
echo      cd server ^&^& npm run dev
echo      cd client ^&^& npm run dev (for development)
echo.
echo ==========================================
echo.
goto :end

:setup_env
echo.
echo Setting up environment...

set "ENV_FILE=%SCRIPT_DIR%.env"

:: Generate encryption key if needed
set "NEED_KEY=0"
if not exist "%ENV_FILE%" set "NEED_KEY=1"
if exist "%ENV_FILE%" (
    findstr /c:"ENCRYPTION_KEY=" "%ENV_FILE%" >nul 2>nul
    if errorlevel 1 set "NEED_KEY=1"
)

if "%NEED_KEY%"=="1" (
    echo Generating encryption key...
    set "ENCRYPTION_KEY="
    for /f "usebackq delims=" %%a in (`powershell -NoProfile -ExecutionPolicy Bypass -Command "[System.BitConverter]::ToString([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32)).Replace('-','')" 2^>nul`) do set "ENCRYPTION_KEY=%%a"

    if not defined ENCRYPTION_KEY (
        echo [WARNING] PowerShell failed, using alternative method...
        set "ENCRYPTION_KEY=%RANDOM%%RANDOM%%RANDOM%%RANDOM%%RANDOM%%RANDOM%%RANDOM%%RANDOM%"
    )
)

:: Create or update .env file for SQLite
(
    echo # SQLite Database (no Docker^)
    echo DATABASE_URL=file:../data/bilanciami.db
    echo.
    echo # Encryption key for sensitive data
    if defined ENCRYPTION_KEY (
        echo ENCRYPTION_KEY=!ENCRYPTION_KEY!
    ) else (
        for /f "tokens=2 delims==" %%a in ('findstr /c:"ENCRYPTION_KEY=" "%ENV_FILE%" 2^>nul') do echo ENCRYPTION_KEY=%%a
    )
    echo.
    echo # Ollama Configuration (optional, for local LLM^)
    echo OLLAMA_BASE_URL=http://localhost:11434
    echo OLLAMA_TEXT_MODEL=llama3.2:3b
    echo OLLAMA_VISION_MODEL=llava:7b-v1.6-mistral-q4_K_M
) > "%ENV_FILE%"

:: Copy .env to server folder (Prisma needs it there)
copy /y "%ENV_FILE%" "%SCRIPT_DIR%server\.env" >nul 2>nul

if not exist "%ENV_FILE%" (
    echo [ERROR] Cannot create .env file
    exit /b 1
)

echo [OK] .env file configured for SQLite
exit /b 0

:end
echo.
echo ==========================================
echo   Press any key to close this window...
echo ==========================================
pause >nul
exit
