from pathlib import Path
import os

BASE_DIR = Path(__file__).resolve().parent.parent
MODEL_PATH = BASE_DIR / "ragging_detection_model.h5"
DB_PATH = BASE_DIR / "predictions.db"
CAMERA_INDEX = int(os.getenv("CAMERA_INDEX", "0"))
FRAME_INTERVAL_SECONDS = float(os.getenv("FRAME_INTERVAL_SECONDS", "1.0"))

# Keep class names aligned with training directory names.
CLASS_NAMES = [name.strip() for name in os.getenv("CLASS_NAMES", "Normal,Ragging").split(",") if name.strip()]
IMG_SIZE = int(os.getenv("IMG_SIZE", "224"))
SMOOTHING_WINDOW = int(os.getenv("SMOOTHING_WINDOW", "7"))
RAGGING_THRESHOLD = float(os.getenv("RAGGING_THRESHOLD", "0.9"))
MIN_CONFIDENCE = float(os.getenv("MIN_CONFIDENCE", "0.8"))
