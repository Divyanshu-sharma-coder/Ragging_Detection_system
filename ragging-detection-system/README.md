# Ragging / Violence Detection System

Production-ready project for real-time ragging detection using a trained TensorFlow model (`ragging_detection_model.h5`) with FastAPI, OpenCV, and a browser frontend.

## Project Structure

```text
ragging-detection-system/
│
├── model/
│   └── ragging_detection_model.h5
│
├── backend/
│   ├── main.py
│   ├── predictor.py
│   └── requirements.txt
│
├── realtime/
│   └── camera_detection.py
│
├── frontend/
│   ├── index.html
│   ├── app.js
│   └── package.json
│
├── start_all.bat
└── README.md
```

## 1) Install Dependencies

### Python (backend + realtime script)

From project root:

```bash
pip install -r backend/requirements.txt
```

### Frontend (npm)

```bash
cd frontend
npm install
cd ..
```

## 2) Run FastAPI Backend

```bash
cd backend
uvicorn main:app --host 0.0.0.0 --port 8000
```

Health check:

- `GET http://127.0.0.1:8000/health`

Prediction endpoint:

- `POST http://127.0.0.1:8000/predict`
- Form field name: `image`

Response format:

```json
{
  "prediction": "Ragging",
  "confidence": 0.93
}
```

## 3) Run Real-time OpenCV Client

```bash
python realtime/camera_detection.py --api-url http://127.0.0.1:8000/predict --process-every 12
```

- The script captures webcam frames.
- It sends every Nth frame (default `12`) for inference to improve performance.
- It overlays prediction and shows `Ragging Detected` warning when needed.
- Press `Q` to close window.

## 4) Run Frontend

```bash
cd frontend
npm start
```

Open:

- `http://127.0.0.1:5500`

Steps in UI:

1. Click **Start Webcam Detection**.
2. Frames are sent to FastAPI every N frames.
3. Prediction and confidence are shown in real time.

## 5) One-click Windows Startup

Use:

```bat
start_all.bat
```

This script launches:

- FastAPI backend
- Frontend server (`npm start`)
- OpenCV realtime client

## Notes

- Model is loaded once at backend startup for low-latency inference.
- Input is resized to `224x224` and sent as float32 to match the EfficientNet pipeline saved in the model graph.
- Do not run frontend webcam and OpenCV webcam script at the same time if your system has a single camera device; both may compete for camera access.
