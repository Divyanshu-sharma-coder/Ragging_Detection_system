# Smart Eye Detection System

This project now uses a complete React + Vite + TypeScript frontend with Tailwind and shadcn-style component structure, plus a FastAPI backend for inference.

## Stack

- Backend: FastAPI + TensorFlow + OpenCV + SQLite
- Frontend: React + Vite + TypeScript + Tailwind CSS
- UI structure: shadcn-compatible (`src/components/ui`)

## Project Layout

- `main.py` -> FastAPI API service
- `app/api/routes.py` -> API endpoints
- `app/services/model_service.py` -> TensorFlow model inference logic
- `app/services/camera_service.py` -> live camera loop and smoothing
- `frontend/src/components/ui/spiral-animation.tsx` -> animated home background component
- `frontend/src/components/ui/demo.tsx` -> home hero + Activate Panel action
- `frontend/src/pages/HomePage.tsx` -> Home page
- `frontend/src/pages/AboutPage.tsx` -> About page
- `frontend/src/pages/PanelPage.tsx` -> Real-time monitoring panel
- `frontend/src/pages/LoginPage.tsx` -> Login page
- `start-all.bat` -> one-click backend + Vite startup

## Why `src/components/ui` Matters

shadcn components and aliases assume reusable primitives live under `src/components/ui`. Keeping this path stable avoids broken imports and makes future shadcn CLI additions straightforward.

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
C:/Users/hp/AppData/Local/Python/pythoncore-3.10-64/python.exe -m uvicorn main:app --host 127.0.0.1 --port 8000
```

## Run React Frontend

```bash
cd frontend
npm run dev -- --host 127.0.0.1 --port 5173
```

Open:

- `http://127.0.0.1:5173`

## One-Click Startup (Windows)

```bat
start-all.bat
```

This launches:

- Backend at `http://127.0.0.1:8000`
- React frontend at `http://127.0.0.1:5173`

## OpenCV Realtime Script (Optional)

```bash
C:/Users/hp/AppData/Local/Python/pythoncore-3.10-64/python.exe realtime/camera_detection.py --api-url http://127.0.0.1:8000/api/predict --process-every 12
```

Run this only if you want desktop OpenCV view. Avoid using multiple camera consumers on a single webcam at the same time.
