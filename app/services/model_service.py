from pathlib import Path
from threading import Lock

import cv2
import numpy as np
import tensorflow as tf


class RaggingModelService:
    def __init__(
        self,
        model_path: Path,
        class_names: list[str],
        image_size: int = 224,
        ragging_threshold: float = 0.75,
        min_confidence: float = 0.55,
    ) -> None:
        self.model_path = model_path
        self.class_names = class_names
        self.image_size = image_size
        self.ragging_threshold = float(ragging_threshold)
        self.min_confidence = float(min_confidence)
        self._model = None
        self._lock = Lock()

    @property
    def is_loaded(self) -> bool:
        return self._model is not None

    def load_model(self) -> None:
        if self._model is not None:
            return
        with self._lock:
            if self._model is None:
                self._model = tf.keras.models.load_model(self.model_path)

    def _preprocess_frame(self, frame_bgr: np.ndarray) -> np.ndarray:
        rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
        resized = cv2.resize(rgb, (self.image_size, self.image_size), interpolation=cv2.INTER_AREA)
        arr = resized.astype(np.float32)
        return np.expand_dims(arr, axis=0)

    def _decode_image_bytes(self, image_bytes: bytes) -> np.ndarray:
        image_arr = np.frombuffer(image_bytes, dtype=np.uint8)
        frame_bgr = cv2.imdecode(image_arr, cv2.IMREAD_COLOR)
        if frame_bgr is None:
            raise ValueError("Unable to decode image bytes. Upload a valid image.")
        return frame_bgr

    def predict(self, frame_bgr: np.ndarray) -> dict:
        if self._model is None:
            self.load_model()

        sample = self._preprocess_frame(frame_bgr)
        preds = self._model.predict(sample, verbose=0)[0]

        probs = np.asarray(preds, dtype=np.float32)
        probs = probs / (np.sum(probs) + 1e-8)

        idx = int(np.argmax(probs))
        top_label = self.class_names[idx] if idx < len(self.class_names) else f"class_{idx}"
        top_confidence = float(probs[idx])

        ragging_idx = None
        for i, name in enumerate(self.class_names):
            if name.lower() == "ragging":
                ragging_idx = i
                break

        ragging_probability = float(probs[ragging_idx]) if ragging_idx is not None and ragging_idx < len(probs) else (top_confidence if top_label.lower() == "ragging" else 0.0)

        # Conservative decision policy to avoid false positive "always ragging" behavior.
        is_ragging = ragging_probability >= self.ragging_threshold and top_confidence >= self.min_confidence
        label = "Ragging" if is_ragging else "Normal"
        confidence = ragging_probability if is_ragging else (1.0 - ragging_probability)

        return {
            "label": label,
            "confidence": confidence,
            "ragging_probability": ragging_probability,
            "top_label": top_label,
            "top_confidence": top_confidence,
            "class_probabilities": {
                self.class_names[i] if i < len(self.class_names) else f"class_{i}": float(probs[i])
                for i in range(len(probs))
            },
        }

    def predict_image_bytes(self, image_bytes: bytes) -> dict:
        frame_bgr = self._decode_image_bytes(image_bytes)
        return self.predict(frame_bgr)
