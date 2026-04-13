import sqlite3
from hashlib import sha256
from hmac import compare_digest
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
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL,
                    email TEXT NOT NULL UNIQUE,
                    password_hash TEXT,
                    auth_provider TEXT NOT NULL DEFAULT 'local',
                    created_at TEXT NOT NULL,
                    last_login_at TEXT NOT NULL
                )
                """
            )
            conn.commit()

    def _hash_password(self, password: str) -> str:
        return sha256(password.encode("utf-8")).hexdigest()

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

    def create_user(self, name: str, email: str, password: str) -> dict:
        normalized_email = email.strip().lower()
        now = datetime.now(timezone.utc).isoformat()
        password_hash = self._hash_password(password)

        with self._lock, self._connect() as conn:
            existing = conn.execute("SELECT id FROM users WHERE email = ?", (normalized_email,)).fetchone()
            if existing is not None:
                raise ValueError("An account with this email already exists. Please sign in.")

            cur = conn.execute(
                """
                INSERT INTO users (name, email, password_hash, auth_provider, created_at, last_login_at)
                VALUES (?, ?, ?, 'local', ?, ?)
                """,
                (name.strip(), normalized_email, password_hash, now, now),
            )
            conn.commit()
            user_id = cur.lastrowid

        return {
            "id": user_id,
            "name": name.strip(),
            "email": normalized_email,
            "auth_provider": "local",
            "created_at": datetime.fromisoformat(now),
            "last_login_at": datetime.fromisoformat(now),
        }

    def verify_user(self, email: str, password: str) -> dict | None:
        normalized_email = email.strip().lower()
        now = datetime.now(timezone.utc).isoformat()
        supplied_hash = self._hash_password(password)

        with self._lock, self._connect() as conn:
            row = conn.execute(
                """
                SELECT id, name, email, password_hash, auth_provider, created_at, last_login_at
                FROM users
                WHERE email = ?
                """,
                (normalized_email,),
            ).fetchone()

            if row is None or not row["password_hash"]:
                return None

            if not compare_digest(row["password_hash"], supplied_hash):
                return None

            conn.execute("UPDATE users SET last_login_at = ? WHERE id = ?", (now, row["id"]))
            conn.commit()

        return {
            "id": row["id"],
            "name": row["name"],
            "email": row["email"],
            "auth_provider": row["auth_provider"],
            "created_at": datetime.fromisoformat(row["created_at"]),
            "last_login_at": datetime.fromisoformat(now),
        }

    def social_login(self, provider: str, email: str, name: str) -> tuple[dict, bool]:
        normalized_email = email.strip().lower()
        now = datetime.now(timezone.utc).isoformat()
        normalized_provider = provider.strip().lower()

        with self._lock, self._connect() as conn:
            row = conn.execute(
                """
                SELECT id, name, email, auth_provider, created_at, last_login_at
                FROM users
                WHERE email = ?
                """,
                (normalized_email,),
            ).fetchone()

            if row is None:
                cur = conn.execute(
                    """
                    INSERT INTO users (name, email, password_hash, auth_provider, created_at, last_login_at)
                    VALUES (?, ?, NULL, ?, ?, ?)
                    """,
                    (name.strip(), normalized_email, normalized_provider, now, now),
                )
                conn.commit()
                created = True
                user = {
                    "id": cur.lastrowid,
                    "name": name.strip(),
                    "email": normalized_email,
                    "auth_provider": normalized_provider,
                    "created_at": datetime.fromisoformat(now),
                    "last_login_at": datetime.fromisoformat(now),
                }
                return user, created

            conn.execute(
                """
                UPDATE users
                SET name = ?, auth_provider = ?, last_login_at = ?
                WHERE id = ?
                """,
                (name.strip() or row["name"], normalized_provider, now, row["id"]),
            )
            conn.commit()

        return {
            "id": row["id"],
            "name": name.strip() or row["name"],
            "email": row["email"],
            "auth_provider": normalized_provider,
            "created_at": datetime.fromisoformat(row["created_at"]),
            "last_login_at": datetime.fromisoformat(now),
        }, False
