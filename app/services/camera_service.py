from collections import deque
from threading import Event, Thread
from time import sleep
from typing import Any

import cv2

from app.services.database import PredictionRepository
from app.services.model_service import RaggingModelService


class CameraInferenceService:
    def __init__(
        self,
        model_service: RaggingModelService,
        repository: PredictionRepository,
        camera_index: int = 0,
        frame_interval_seconds: float = 1.0,
        smoothing_window: int = 5,
        ragging_threshold: float = 0.75,
    ) -> None:
        self.model_service = model_service
        self.repository = repository
        self.camera_index = camera_index
        self.frame_interval_seconds = frame_interval_seconds
        self.smoothing_window = max(1, smoothing_window)
        self.ragging_threshold = float(ragging_threshold)

        self._camera = None
        self._thread = None
        self._stop_event = Event()
        self._active = False
        self._latest_prediction = None
        self._probs = deque(maxlen=self.smoothing_window)

    def _open_camera_with_fallback(self, preferred_index: int | None = None) -> tuple[cv2.VideoCapture | None, int | None, list[int]]:
        tried: list[int] = []
        candidates: list[int] = []

        if preferred_index is not None:
            candidates.append(int(preferred_index))
        candidates.extend([self.camera_index, 0, 1, 2, 3])

        unique_candidates: list[int] = []
        for idx in candidates:
            if idx not in unique_candidates:
                unique_candidates.append(idx)

        for idx in unique_candidates:
            tried.append(idx)
            camera = cv2.VideoCapture(idx)
            if camera.isOpened():
                return camera, idx, tried
            camera.release()

        return None, None, tried

    def activate(self, camera_index: int | None = None) -> dict[str, Any]:
        if self._active:
            return {"active": True, "message": "System is already active."}

        self.model_service.load_model()
        self._camera, selected_index, tried = self._open_camera_with_fallback(camera_index)
        if self._camera is None:
            return {
                "active": False,
                "message": f"Unable to open camera. Tried indexes: {tried}. Check permissions or close other camera apps.",
            }

        self.camera_index = int(selected_index)
        self._probs.clear()

        self._stop_event.clear()
        self._active = True
        self._thread = Thread(target=self._run_loop, daemon=True)
        self._thread.start()

        return {"active": True, "message": f"System activated on camera index {self.camera_index}."}

    def deactivate(self) -> dict[str, Any]:
        if not self._active:
            return {"active": False, "message": "System is already stopped."}

        self._stop_event.set()
        if self._thread and self._thread.is_alive():
            self._thread.join(timeout=2)

        if self._camera is not None:
            self._camera.release()
            self._camera = None

        self._active = False
        return {"active": False, "message": "System deactivated."}

    def _run_loop(self) -> None:
        while not self._stop_event.is_set():
            ok, frame = self._camera.read() if self._camera is not None else (False, None)
            if not ok or frame is None:
                sleep(self.frame_interval_seconds)
                continue

            raw_prediction = self.model_service.predict(frame)
            self._probs.append(float(raw_prediction["ragging_probability"]))

            smooth_ragging_prob = sum(self._probs) / len(self._probs)
            label = "Ragging" if smooth_ragging_prob >= self.ragging_threshold else "Normal"
            confidence = smooth_ragging_prob if label == "Ragging" else 1.0 - smooth_ragging_prob

            saved = self.repository.add_prediction(
                label=label,
                confidence=confidence,
                ragging_probability=smooth_ragging_prob,
            )

            saved["raw_class_probabilities"] = raw_prediction["class_probabilities"]
            self._latest_prediction = saved
            sleep(self.frame_interval_seconds)

    def get_status(self) -> dict[str, Any]:
        camera_open = bool(self._camera is not None and self._camera.isOpened())
        return {
            "active": self._active,
            "camera_open": camera_open,
            "frame_interval_seconds": self.frame_interval_seconds,
            "model_loaded": self.model_service.is_loaded,
            "latest_prediction": self._latest_prediction,
        }
