from app.config import CAMERA_INDEX, CLASS_NAMES, DB_PATH, FRAME_INTERVAL_SECONDS, IMG_SIZE, MIN_CONFIDENCE, MODEL_PATH, RAGGING_THRESHOLD, SMOOTHING_WINDOW
from app.services.camera_service import CameraInferenceService
from app.services.database import PredictionRepository
from app.services.model_service import RaggingModelService

repository = PredictionRepository(DB_PATH)
model_service = RaggingModelService(
    MODEL_PATH,
    CLASS_NAMES,
    IMG_SIZE,
    ragging_threshold=RAGGING_THRESHOLD,
    min_confidence=MIN_CONFIDENCE,
)
camera_service = CameraInferenceService(
    model_service=model_service,
    repository=repository,
    camera_index=CAMERA_INDEX,
    frame_interval_seconds=FRAME_INTERVAL_SECONDS,
    smoothing_window=SMOOTHING_WINDOW,
    ragging_threshold=RAGGING_THRESHOLD,
)
