# Ragging Detection - Existing Project

This project now includes a complete real-time ragging/violence detection flow in the existing codebase:

- FastAPI backend with safe image-upload inference endpoint.
- OpenCV realtime detection client (process every N frames).
- Streamlit dashboard for modern UI control and monitoring.
- SQLite logging and system status APIs.

## Project Layout

- `main.py` -> FastAPI entrypoint.
- `app/api/routes.py` -> API endpoints including upload prediction.
- `app/services/model_service.py` -> TensorFlow model loading/inference.
- `app/services/camera_service.py` -> backend camera loop.
- `app/services/database.py` -> prediction storage.
- `frontend/index.html` -> UI page.
- `frontend/app.js` -> frontend logic.
- `frontend/package.json` -> npm frontend dependency.
- `streamlit_app.py` -> modern Streamlit dashboard.
- `realtime/camera_detection.py` -> OpenCV client script.
- `start_all.bat` -> Windows one-click startup.

## Install Dependencies

```bash
C:/Users/hp/AppData/Local/Python/pythoncore-3.10-64/python.exe -m pip install -r requirements.txt
```

```bash
cd frontend
npm install
cd ..
```

## Run Backend

```bash
C:/Users/hp/AppData/Local/Python/pythoncore-3.10-64/python.exe main.py
```

Open:

- `http://127.0.0.1:8000`

## Run Streamlit Dashboard

```bash
C:/Users/hp/AppData/Local/Python/pythoncore-3.10-64/python.exe -m streamlit run streamlit_app.py --server.port 8501
```

Open:

- `http://127.0.0.1:8501`

## API Endpoints

- `POST /api/predict` (multipart image form field name: `image`)
- `POST /api/system/activate`
- `POST /api/system/deactivate`
- `GET /api/system/status`
- `GET /api/predictions?limit=20`
- `GET /api/health`

`/api/predict` response:

```json
{
	"prediction": "Ragging",
	"confidence": 0.93
}
```

## Run Realtime OpenCV Client

```bash
C:/Users/hp/AppData/Local/Python/pythoncore-3.10-64/python.exe realtime/camera_detection.py --api-url http://127.0.0.1:8000/api/predict --process-every 12
```

- Uses webcam feed.
- Sends every Nth frame for performance.
- Overlays `Ragging Detected` warning for violence predictions.

## Run Frontend via npm

```bash
cd frontend
npm start
```

Open:

- `http://127.0.0.1:5500`

## One-Click Startup (Windows)

```bat
start_all.bat
```

This launches backend, frontend, and realtime OpenCV script.
This launches backend and Streamlit dashboard.
OpenCV realtime script is now manual so it does not lock the camera before activation.

## Practical Notes

- Verify Python version: `C:/Users/hp/AppData/Local/Python/pythoncore-3.10-64/python.exe --version`
- Model input is resized to `224x224` and passed as float32 to match training graph assumptions.
- Do not run multiple camera consumers at once on a single-camera system.
