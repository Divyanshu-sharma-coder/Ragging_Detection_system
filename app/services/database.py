import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from threading import Lock


class PredictionRepository:
    def __init__(self, db_path: Path) -> None:
        self.db_path = db_path
        self._lock = Lock()
        self._init_db()

    def _connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_db(self) -> None:
        with self._lock, self._connect() as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS predictions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    timestamp TEXT NOT NULL,
                    label TEXT NOT NULL,
                    confidence REAL NOT NULL,
                    ragging_probability REAL NOT NULL
                )
                """
            )
            conn.commit()

    def add_prediction(self, label: str, confidence: float, ragging_probability: float) -> dict:
        timestamp = datetime.now(timezone.utc).isoformat()
        with self._lock, self._connect() as conn:
            cur = conn.execute(
                """
                INSERT INTO predictions (timestamp, label, confidence, ragging_probability)
                VALUES (?, ?, ?, ?)
                """,
                (timestamp, label, confidence, ragging_probability),
            )
            conn.commit()
            prediction_id = cur.lastrowid

        return {
            "id": prediction_id,
            "timestamp": datetime.fromisoformat(timestamp),
            "label": label,
            "confidence": float(confidence),
            "ragging_probability": float(ragging_probability),
        }

    def list_predictions(self, limit: int = 20) -> list[dict]:
        with self._lock, self._connect() as conn:
            rows = conn.execute(
                """
                SELECT id, timestamp, label, confidence, ragging_probability
                FROM predictions
                ORDER BY id DESC
                LIMIT ?
                """,
                (limit,),
            ).fetchall()

        results = []
        for row in rows:
            results.append(
                {
                    "id": row["id"],
                    "timestamp": datetime.fromisoformat(row["timestamp"]),
                    "label": row["label"],
                    "confidence": float(row["confidence"]),
                    "ragging_probability": float(row["ragging_probability"]),
                }
            )
        return results
