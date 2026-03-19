from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from predictor import RaggingPredictor

BASE_DIR = Path(__file__).resolve().parent
MODEL_PATH = BASE_DIR.parent / "model" / "ragging_detection_model.h5"
MAX_IMAGE_SIZE_BYTES = 8 * 1024 * 1024

app = FastAPI(title="Ragging Detection API", version="1.0.0")
predictor = RaggingPredictor(model_path=MODEL_PATH)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup_event() -> None:
    if not MODEL_PATH.exists():
        raise RuntimeError(f"Model file not found at {MODEL_PATH}")
    predictor.load()


@app.get("/health")
def health() -> dict:
    return {"ok": True, "model_loaded": predictor.is_loaded}


@app.post("/predict")
async def predict(image: UploadFile = File(...)) -> dict:
    if not image.content_type or not image.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Only image files are allowed.")

    image_bytes = await image.read()
    if not image_bytes:
        raise HTTPException(status_code=400, detail="Uploaded image is empty.")

    if len(image_bytes) > MAX_IMAGE_SIZE_BYTES:
        raise HTTPException(status_code=413, detail="Image too large. Max allowed size is 8MB.")

    try:
        result = predictor.predict(image_bytes)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Prediction failed: {exc}") from exc

    return {"prediction": result.prediction, "confidence": result.confidence}
