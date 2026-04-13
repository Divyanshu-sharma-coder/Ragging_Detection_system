@echo off
setlocal

cd /d "%~dp0"

set "PY310=C:\Users\hp\AppData\Local\Python\pythoncore-3.10-64\python.exe"

if not exist "%PY310%" (
    echo Python 3.10.11 interpreter not found at:
    echo %PY310%
    echo Update the PY310 path in start-all.bat to your python 3.10 executable.
    pause
    exit /b 1
)

echo Installing Python dependencies...
"%PY310%" -m pip install -r requirements.txt
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
start "Ragging Backend" /B cmd /c "cd /d %~dp0 & ""%PY310%"" -m uvicorn main:app --host 127.0.0.1 --port 8000 > ""%~dp0backend.log"" 2>&1"

echo Waiting for backend health check...
set "BACKEND_READY=0"
for /l %%I in (1,1,45) do (
    powershell -NoProfile -Command "try { $r = Invoke-WebRequest -UseBasicParsing http://127.0.0.1:8000/api/health -TimeoutSec 2; if ($r.StatusCode -eq 200) { Write-Output READY } } catch {}" | findstr /I "READY" >nul
    if not errorlevel 1 (
        set "BACKEND_READY=1"
        goto :backend_ready
    )
    timeout /t 1 /nobreak >nul
)

:backend_ready
if "%BACKEND_READY%"=="1" (
    echo Backend is healthy at http://127.0.0.1:8000
) else (
    echo Backend did not report healthy within 45 seconds. Frontend will still start.
)

echo Starting React Vite frontend...
start "Smart Eye Frontend" cmd /k "cd /d %~dp0frontend & set VITE_API_BASE_URL=http://127.0.0.1:8000 & npm run dev -- --host 127.0.0.1 --port 5173"

timeout /t 2 /nobreak >nul

echo Services started.
echo Backend: http://127.0.0.1:8000
echo Frontend: http://127.0.0.1:5173
echo To run OpenCV realtime manually:
echo "%PY310%" realtime\camera_detection.py --api-url http://127.0.0.1:8000/api/predict --process-every 12
endlocal
