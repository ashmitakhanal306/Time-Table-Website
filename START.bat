@echo off
title School Timetable System - Launcher
color 0A

echo ============================================
echo   SCHOOL TIMETABLE SYSTEM - STARTING UP
echo ============================================
echo.

if not exist "backend\main.py" (
    echo [ERROR] Run this script from the school-timetable-system folder!
    pause
    exit /b 1
)

echo [1/2] Starting Backend (FastAPI on port 8000)...
start "Backend - FastAPI" cmd /k "title Backend && color 0B && venv\Scripts\python.exe -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload"

timeout /t 3 /nobreak >nul

echo [2/2] Starting Frontend (Vite on port 5173)...
start "Frontend - Vite" cmd /k "title Frontend && color 0E && cd frontend && npm run dev"

timeout /t 4 /nobreak >nul

echo [3/3] Opening browser...
start http://localhost:5173

echo.
echo ============================================
echo   Both servers are running!
echo   Frontend : http://localhost:5173
echo   Backend  : http://localhost:8000
echo   API Docs : http://localhost:8000/docs
echo   Close the two terminal windows to stop.
echo ============================================
pause
