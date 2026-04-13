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


class PredictResponse(BaseModel):
    prediction: str
    confidence: float
    ragging_probability: float
    top_label: str
    top_confidence: float
    threshold_ragging: float
    threshold_min_confidence: float


class SignUpPayload(BaseModel):
    name: str
    email: str
    password: str


class SignInPayload(BaseModel):
    email: str
    password: str


class SocialAuthPayload(BaseModel):
    provider: str
    email: str
    name: str
    mode: str = "signin"


class AuthUser(BaseModel):
    id: int
    name: str
    email: str
    auth_provider: str


class AuthResponse(BaseModel):
    message: str
    user: AuthUser
