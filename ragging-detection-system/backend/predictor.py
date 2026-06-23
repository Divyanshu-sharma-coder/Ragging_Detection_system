from __future__ import annotations
import io
from dataclasses import dataclass
from pathlib import Path
import numpy as np
import tensorflow as tf
from PIL import Image

# ==============================================================================
# 1. NEW PRODUCTION IMPORTS
# ==============================================================================
import logging
import gc
import threading
from typing import Optional

# Set up logging for tracking system performance and exceptions
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger("RaggingPredictor")

# ==============================================================================
# 2. YOUR ORIGINAL CODE (Exactly as provided, formatting intact)
# ==============================================================================
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

# ==============================================================================
# 3. ADVANCED ENHANCEMENTS (Added on top via Subclassing)
# ==============================================================================
class AdvancedRaggingPredictor(RaggingPredictor):
    """
    An advanced wrapper implementing Thread Safety, Warm-up, 
    and Resource Management over the base RaggingPredictor.
    """
    
    def __init__(self, model_path: Path, image_size: tuple[int, int] = (224, 224)) -> None:
        super().__init__(model_path, image_size)
        # Thread lock prevents multiple API requests from breaking during concurrent load/predict
        self._lock = threading.Lock() 
    
    def load(self) -> None:
        """Enhanced load with thread safety and automated model warm-up."""
        with self._lock:
            if not self.is_loaded:
                logger.info(f"Loading TensorFlow model from: {self.model_path}")
                super().load()
                self._warm_up()

    def _warm_up(self) -> None:
        """Runs a fake prediction to compile the CUDA/TF graph before production hits."""
        logger.info("Warming up TensorFlow computation graph...")
        try:
            dummy_img = Image.new("RGB", self.image_size, color="white")
            buffer = io.BytesIO()
            dummy_img.save(buffer, format="JPEG")
            super().predict(buffer.getvalue())
            logger.info("Model warm-up complete. Ready for requests.")
        except Exception as e:
            logger.error(f"Warm-up failed, but model is loaded: {e}")

    def predict(self, image_bytes: bytes) -> PredictionResult:
        """Enhanced prediction featuring thread-locking and explicit memory freeing."""
        with self._lock:
            try:
                result = super().predict(image_bytes)
                return result
            except Exception as e:
                logger.error(f"Prediction pipeline failure: {e}")
                raise e
            finally:
                # Forces Python to clear out unmanaged heap objects left by numpy/TF arrays
                gc.collect()

    def unload(self) -> None:
        """Safely unloads the model from RAM/VRAM without needing a server reboot."""
        with self._lock:
            if self.is_loaded:
                logger.info("Unloading model to reclaim system resources...")
                self._model = None
                gc.collect()
                logger.info("Model successfully unloaded.")
