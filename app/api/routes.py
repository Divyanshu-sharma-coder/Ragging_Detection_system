from fastapi import APIRouter, File, HTTPException, Query, UploadFile

from app.schemas import AuthResponse, PredictResponse, PredictionRecord, SignInPayload, SignUpPayload, SocialAuthPayload, SystemStatus
from app.state import camera_service, model_service, repository

router = APIRouter(prefix="/api", tags=["ragging-detection"])
MAX_IMAGE_SIZE_BYTES = 8 * 1024 * 1024


@router.get("/health")
def health() -> dict:
    return {"ok": True}


@router.post("/predict", response_model=PredictResponse)
async def predict(image: UploadFile = File(...)) -> dict:
    if not image.content_type or not image.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Only image files are allowed.")

    image_bytes = await image.read()
    if not image_bytes:
        raise HTTPException(status_code=400, detail="Uploaded image is empty.")

    if len(image_bytes) > MAX_IMAGE_SIZE_BYTES:
        raise HTTPException(status_code=413, detail="Image too large. Max allowed size is 8MB.")

    try:
        result = model_service.predict_image_bytes(image_bytes)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Prediction failed: {exc}") from exc

    return {
        "prediction": result["label"],
        "confidence": result["confidence"],
        "ragging_probability": result["ragging_probability"],
        "top_label": result["top_label"],
        "top_confidence": result["top_confidence"],
        "threshold_ragging": model_service.ragging_threshold,
        "threshold_min_confidence": model_service.min_confidence,
    }


@router.post("/auth/signup", response_model=AuthResponse)
def signup(payload: SignUpPayload) -> dict:
    name = payload.name.strip()
    email = payload.email.strip().lower()
    password = payload.password

    if len(name) < 2:
        raise HTTPException(status_code=400, detail="Name must be at least 2 characters.")
    if "@" not in email or "." not in email.split("@")[-1]:
        raise HTTPException(status_code=400, detail="Please enter a valid email address.")
    if len(password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters.")

    try:
        user = repository.create_user(name=name, email=email, password=password)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc

    return {
        "message": "Account created successfully.",
        "user": {
            "id": user["id"],
            "name": user["name"],
            "email": user["email"],
            "auth_provider": user["auth_provider"],
        },
    }


@router.post("/auth/login", response_model=AuthResponse)
def login(payload: SignInPayload) -> dict:
    email = payload.email.strip().lower()
    password = payload.password

    if not email or not password:
        raise HTTPException(status_code=400, detail="Email and password are required.")

    user = repository.verify_user(email=email, password=password)
    if user is None:
        raise HTTPException(status_code=401, detail="Invalid credentials. Please try again.")

    return {
        "message": "Sign in successful.",
        "user": {
            "id": user["id"],
            "name": user["name"],
            "email": user["email"],
            "auth_provider": user["auth_provider"],
        },
    }


@router.post("/auth/social", response_model=AuthResponse)
def social_auth(payload: SocialAuthPayload) -> dict:
    provider = payload.provider.strip().lower()
    if provider not in {"google", "github"}:
        raise HTTPException(status_code=400, detail="Unsupported provider.")

    email = payload.email.strip().lower()
    name = payload.name.strip() or f"{provider.title()} User"
    if not email:
        raise HTTPException(status_code=400, detail="Email is required for social sign-in.")

    user, created = repository.social_login(provider=provider, email=email, name=name)
    action = "created and signed in" if created else "signed in"

    return {
        "message": f"Account {action} with {provider.title()}.",
        "user": {
            "id": user["id"],
            "name": user["name"],
            "email": user["email"],
            "auth_provider": user["auth_provider"],
        },
    }


@router.post("/system/activate")
def activate_system(camera_index: int | None = Query(default=None, ge=0, le=10)) -> dict:
    return camera_service.activate(camera_index=camera_index)


@router.post("/system/deactivate")
def deactivate_system() -> dict:
    return camera_service.deactivate()


@router.get("/system/status", response_model=SystemStatus)
def system_status() -> dict:
    return camera_service.get_status()


@router.get("/predictions", response_model=list[PredictionRecord])
def get_predictions(limit: int = Query(default=20, ge=1, le=500)) -> list[dict]:
    return repository.list_predictions(limit=limit)
