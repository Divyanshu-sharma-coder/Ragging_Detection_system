@echo off
setlocal

REM Run from project root regardless of where script is called.
cd /d "%~dp0"

echo Installing Python dependencies...
pip install -r backend\requirements.txt
if errorlevel 1 (
    echo Failed to install Python dependencies.
    pause
    exit /b 1
)

echo Installing frontend npm dependencies...
cd frontend
call npm install
if errorlevel 1 (
    echo Failed to install npm dependencies.
    pause
    exit /b 1
)
cd ..

echo Starting FastAPI backend...
start "Ragging Backend" cmd /k "cd /d %~dp0backend && uvicorn main:app --host 0.0.0.0 --port 8000"

timeout /t 3 /nobreak >nul

echo Starting frontend server...
start "Ragging Frontend" cmd /k "cd /d %~dp0frontend && npm start"

timeout /t 3 /nobreak >nul

echo Starting OpenCV realtime detection...
start "Ragging Realtime" cmd /k "cd /d %~dp0 && python realtime\camera_detection.py --api-url http://127.0.0.1:8000/predict --process-every 12"

echo All services started.
endlocal
