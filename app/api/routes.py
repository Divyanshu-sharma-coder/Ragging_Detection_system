from fastapi import APIRouter, File, HTTPException, Query, UploadFile

from app.schemas import PredictionRecord, SystemStatus
from app.state import camera_service, model_service, repository

router = APIRouter(prefix="/api", tags=["ragging-detection"])
MAX_IMAGE_SIZE_BYTES = 8 * 1024 * 1024


@router.get("/health")
def health() -> dict:
    return {"ok": True}


@router.post("/predict")
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
