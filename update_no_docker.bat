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
echo   Bilanciami - Update (No Docker)
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
where node >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Node.js is not installed. Run install_no_docker.bat first.
    goto :end
)
echo [OK] Node.js found

:: Check if installation exists
if not exist "%SCRIPT_DIR%server\node_modules" (
    echo [ERROR] Server not installed. Run install_no_docker.bat first.
    goto :end
)
if not exist "%SCRIPT_DIR%client\node_modules" (
    echo [ERROR] Client not installed. Run install_no_docker.bat first.
    goto :end
)
echo [OK] Previous installation found

:: Pull latest changes (if git repo)
echo.
echo ==========================================
echo   Pulling Latest Changes...
echo ==========================================
echo.

where git >nul 2>nul
if not errorlevel 1 (
    git pull
    if errorlevel 1 (
        echo [WARNING] Git pull failed or no changes
    ) else (
        echo [OK] Latest code pulled
    )
) else (
    echo [SKIP] Git not found, skipping pull
)

:: Ensure SQLite schema is in place
echo.
echo ==========================================
echo   Checking SQLite Configuration...
echo ==========================================
echo.

if exist "%SCRIPT_DIR%server\prisma\schema.sqlite.prisma" (
    copy /y "%SCRIPT_DIR%server\prisma\schema.sqlite.prisma" "%SCRIPT_DIR%server\prisma\schema.prisma" >nul
    echo [OK] SQLite schema configured
) else (
    echo [ERROR] SQLite schema file not found
    goto :end
)

:: Update server dependencies
echo.
echo ==========================================
echo   Updating Server Dependencies...
echo ==========================================
echo.

cd /d "%SCRIPT_DIR%server"
if errorlevel 1 (
    echo [ERROR] Cannot change to server directory
    goto :end
)

call npm install
if errorlevel 1 (
    echo [ERROR] Failed to update server dependencies
    goto :end
)
echo [OK] Server dependencies updated

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
echo Updating database schema...
call npx prisma db push
if errorlevel 1 (
    echo [ERROR] Failed to update database
    goto :end
)
echo [OK] Database updated

:: Update client dependencies
echo.
echo ==========================================
echo   Updating Client Dependencies...
echo ==========================================
echo.

cd /d "%SCRIPT_DIR%client"
if errorlevel 1 (
    echo [ERROR] Cannot change to client directory
    goto :end
)

call npm install
if errorlevel 1 (
    echo [ERROR] Failed to update client dependencies
    goto :end
)
echo [OK] Client dependencies updated

:: Rebuild client
echo.
echo ==========================================
echo   Rebuilding Frontend...
echo ==========================================
echo.

call npm run build
if errorlevel 1 (
    echo [ERROR] Failed to rebuild frontend
    goto :end
)
echo [OK] Frontend rebuilt

cd /d "%SCRIPT_DIR%"

echo.
echo ==========================================
echo   SUCCESS! Update Complete!
echo ==========================================
echo.
echo   To start the application, run:
echo.
echo      start_no_docker.bat
echo.
echo ==========================================
echo.
goto :end

:end
echo.
echo ==========================================
echo   Press any key to close this window...
echo ==========================================
pause >nul
exit
