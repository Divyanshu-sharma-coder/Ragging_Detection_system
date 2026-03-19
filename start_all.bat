@echo off
setlocal

cd /d "%~dp0"

set "PY310=C:/Users/hp/AppData/Local/Python/pythoncore-3.10-64/python.exe"
set "BACKEND_URL=http://127.0.0.1:8000/api/health"

if not exist "%PY310%" (
    echo Python 3.10.11 interpreter not found at:
    echo %PY310%
    echo Update the PY310 path in start_all.bat to your python 3.10 executable.
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
start "Ragging Backend" cmd /k "cd /d %~dp0 && ""%PY310%"" -m uvicorn main:app --host 127.0.0.1 --port 8000"

echo Waiting for backend to become healthy... (first run can take 1-2 minutes)
set "READY=0"
for /L %%i in (1,1,120) do (
    powershell -NoProfile -Command "try { $r = Invoke-RestMethod -Method GET -Uri '%BACKEND_URL%' -TimeoutSec 2; if ($r.ok -eq $true) { exit 0 } else { exit 1 } } catch { exit 1 }"
    if not errorlevel 1 (
        set "READY=1"
        goto :backend_ready
    )
    timeout /t 1 /nobreak >nul
)

:backend_ready
if "%READY%"=="1" (
    echo Backend is ready.
) else (
    echo Backend did not become ready in time.
    echo You can still inspect the "Ragging Backend" window for startup errors.
)

echo Starting Streamlit dashboard...
start "Ragging Dashboard" cmd /k "cd /d %~dp0 && ""%PY310%"" -m streamlit run streamlit_app.py --server.port 8501"

timeout /t 2 /nobreak >nul

echo Services started.
echo Backend: http://127.0.0.1:8000
echo Dashboard: http://127.0.0.1:8501
echo To run OpenCV realtime manually:
echo "%PY310%" realtime\camera_detection.py --api-url http://127.0.0.1:8000/api/predict --process-every 12
endlocal
