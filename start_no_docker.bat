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
echo   Bilanciami - Start (No Docker)
echo ==========================================
echo.

:: Get script directory
set "SCRIPT_DIR=%~dp0"
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

:: Check if installation exists
if not exist "%SCRIPT_DIR%server\node_modules" (
    echo [ERROR] Server not installed. Run install_no_docker.bat first.
    goto :end
)
if not exist "%SCRIPT_DIR%client\node_modules" (
    echo [ERROR] Client not installed. Run install_no_docker.bat first.
    goto :end
)

:: Check if database exists
if not exist "%SCRIPT_DIR%data\bilanciami.db" (
    echo [WARNING] Database not found. Running installation...
    call "%SCRIPT_DIR%install_no_docker.bat"
    exit /b
)

:: Ensure SQLite schema is active
if exist "%SCRIPT_DIR%server\prisma\schema.sqlite.prisma" (
    copy /y "%SCRIPT_DIR%server\prisma\schema.sqlite.prisma" "%SCRIPT_DIR%server\prisma\schema.prisma" >nul
)

echo [OK] Installation found
echo.

:: Ask user which mode to run
echo Choose startup mode:
echo.
echo   1. Production mode (serve built frontend)
echo   2. Development mode (live reload)
echo.
set /p "MODE=Enter choice (1 or 2): "

if "%MODE%"=="2" (
    goto :dev_mode
) else (
    goto :prod_mode
)

:prod_mode
echo.
echo ==========================================
echo   Starting in Production Mode...
echo ==========================================
echo.

:: Check if frontend is built
if not exist "%SCRIPT_DIR%client\dist\index.html" (
    echo [WARNING] Frontend not built. Building now...
    cd /d "%SCRIPT_DIR%client"
    call npm run build
    cd /d "%SCRIPT_DIR%"
)

:: Install serve globally if not present
where serve >nul 2>nul
if errorlevel 1 (
    echo Installing static file server...
    call npm install -g serve
)

:: Start backend server in new window
echo Starting backend server...
start "Bilanciami Backend" cmd /k "cd /d "%SCRIPT_DIR%server" && npm run start"

:: Wait for backend to start
timeout /t 3 /nobreak >nul

:: Start frontend server in new window
echo Starting frontend server...
start "Bilanciami Frontend" cmd /k "cd /d "%SCRIPT_DIR%client" && serve -s dist -l 5173"

echo.
echo ==========================================
echo   SUCCESS! Bilanciami is running!
echo ==========================================
echo.
echo   Frontend: http://localhost:5173
echo   Backend:  http://localhost:3000
echo   API Docs: http://localhost:3000/docs
echo.
echo   Two new windows have been opened:
echo   - Bilanciami Backend (API server)
echo   - Bilanciami Frontend (Web server)
echo.
echo   Close those windows to stop the application.
echo ==========================================
echo.
goto :end

:dev_mode
echo.
echo ==========================================
echo   Starting in Development Mode...
echo ==========================================
echo.

:: Start backend server in new window with watch mode
echo Starting backend server (dev mode)...
start "Bilanciami Backend (Dev)" cmd /k "cd /d "%SCRIPT_DIR%server" && npm run dev"

:: Wait for backend to start
timeout /t 3 /nobreak >nul

:: Start frontend dev server in new window
echo Starting frontend server (dev mode)...
start "Bilanciami Frontend (Dev)" cmd /k "cd /d "%SCRIPT_DIR%client" && npm run dev"

echo.
echo ==========================================
echo   SUCCESS! Bilanciami is running (Dev Mode)!
echo ==========================================
echo.
echo   Frontend: http://localhost:5173
echo   Backend:  http://localhost:3000
echo   API Docs: http://localhost:3000/docs
echo.
echo   Two new windows have been opened:
echo   - Bilanciami Backend (Dev) - with hot reload
echo   - Bilanciami Frontend (Dev) - with hot reload
echo.
echo   Close those windows to stop the application.
echo ==========================================
echo.
goto :end

:end
echo.
echo Press any key to close this window...
pause >nul
exit
