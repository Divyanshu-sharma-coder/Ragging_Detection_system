from __future__ import annotations

import io
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import tensorflow as tf
from PIL import Image


@dataclass
class PredictionResult:
    prediction: str
    confidence: float


class RaggingPredictor:
    """Loads TensorFlow model once and performs image inference."""

    def __init__(self, model_path: Path, image_size: tuple[int, int] = (224, 224)) -> None:
        self.model_path = model_path
        self.image_size = image_size
        self._model: tf.keras.Model | None = None
        self._class_names = ["Normal", "Ragging"]

    @property
    def is_loaded(self) -> bool:
        return self._model is not None

    def load(self) -> None:
        if self._model is None:
            self._model = tf.keras.models.load_model(self.model_path)

    def _preprocess(self, image_bytes: bytes) -> np.ndarray:
        image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        image = image.resize(self.image_size)
        arr = np.asarray(image, dtype=np.float32)

        # The training notebook applied EfficientNet preprocessing in-model.
        # Keep pixel range in [0,255] float32 so inference matches training graph.
        arr = np.expand_dims(arr, axis=0)
        return arr

    def predict(self, image_bytes: bytes) -> PredictionResult:
        if self._model is None:
            self.load()

        inputs = self._preprocess(image_bytes)
        probs = self._model.predict(inputs, verbose=0)[0]
        probs = np.asarray(probs, dtype=np.float32)
        probs = probs / (np.sum(probs) + 1e-8)

        idx = int(np.argmax(probs))
        prediction = self._class_names[idx] if idx < len(self._class_names) else "Normal"
        confidence = float(probs[idx])
        return PredictionResult(prediction=prediction, confidence=confidence)
