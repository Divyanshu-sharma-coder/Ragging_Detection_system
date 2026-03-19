from datetime import datetime
from pydantic import BaseModel


class PredictionRecord(BaseModel):
    id: int
    timestamp: datetime
    label: str
    confidence: float
    ragging_probability: float


class SystemStatus(BaseModel):
    active: bool
    camera_open: bool
    frame_interval_seconds: float
    model_loaded: bool
    latest_prediction: PredictionRecord | None = None
