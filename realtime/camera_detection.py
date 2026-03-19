from __future__ import annotations

import argparse
from typing import Any

import cv2
import requests


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Real-time ragging detection via FastAPI endpoint")
    parser.add_argument("--api-url", default="http://127.0.0.1:8000/api/predict", help="FastAPI predict endpoint")
    parser.add_argument("--camera-index", type=int, default=0, help="OpenCV camera index")
    parser.add_argument("--process-every", type=int, default=12, help="Run inference every N frames")
    parser.add_argument("--timeout", type=float, default=8.0, help="HTTP timeout seconds")
    return parser.parse_args()


def request_prediction(frame: Any, api_url: str, timeout: float) -> tuple[str, float] | None:
    ok, encoded = cv2.imencode(".jpg", frame, [int(cv2.IMWRITE_JPEG_QUALITY), 85])
    if not ok:
        return None

    files = {"image": ("frame.jpg", encoded.tobytes(), "image/jpeg")}
    try:
        response = requests.post(api_url, files=files, timeout=timeout)
        response.raise_for_status()
        data = response.json()
        return str(data.get("prediction", "Unknown")), float(data.get("confidence", 0.0))
    except requests.RequestException:
        return None


def main() -> None:
    args = parse_args()
    process_every = max(1, args.process_every)

    cap = cv2.VideoCapture(args.camera_index)
    if not cap.isOpened():
        raise RuntimeError("Cannot open webcam. Check camera index/permissions.")

    last_prediction = "Unknown"
    last_confidence = 0.0
    frame_count = 0

    while True:
        ok, frame = cap.read()
        if not ok:
            break

        frame_count += 1
        if frame_count % process_every == 0:
            pred = request_prediction(frame, args.api_url, args.timeout)
            if pred is not None:
                last_prediction, last_confidence = pred

        is_ragging = last_prediction.lower() == "ragging"
        banner_color = (0, 0, 255) if is_ragging else (0, 180, 0)
        text = f"Prediction: {last_prediction} ({last_confidence * 100:.2f}%)"

        cv2.rectangle(frame, (10, 10), (620, 90), banner_color, -1)
        cv2.putText(frame, text, (20, 50), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255, 255, 255), 2)

        if is_ragging:
            cv2.putText(
                frame,
                "Ragging Detected",
                (20, 80),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.7,
                (255, 255, 255),
                2,
            )

        cv2.imshow("Ragging Detection - Press Q to Exit", frame)
        if cv2.waitKey(1) & 0xFF == ord("q"):
            break

    cap.release()
    cv2.destroyAllWindows()


if __name__ == "__main__":
    main()
