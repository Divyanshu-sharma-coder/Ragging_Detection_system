from __future__ import annotations

from datetime import datetime

import pandas as pd
import requests
import streamlit as st

API_BASE_DEFAULT = "http://127.0.0.1:8000"

st.set_page_config(page_title="Campus Safety Intelligence", page_icon="🛡️", layout="wide")

st.markdown(
    """
    <style>
    .main-title { font-size: 2.2rem; font-weight: 800; margin-bottom: 0.2rem; }
    .subtitle { color: #475569; margin-bottom: 1.25rem; }
    .card {
        border: 1px solid #e2e8f0;
        border-radius: 16px;
        padding: 14px 16px;
        background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
    }
    .warn {
        border-left: 5px solid #dc2626;
        background: #fef2f2;
        color: #7f1d1d;
        padding: 10px 12px;
        border-radius: 8px;
        font-weight: 600;
    }
    </style>
    """,
    unsafe_allow_html=True,
)

st.markdown('<div class="main-title">Campus Safety Intelligence</div>', unsafe_allow_html=True)
st.markdown("### This System is made by AADI JAIN")
st.markdown('<div class="subtitle">Real-time Ragging Detection with FastAPI, OpenCV, and your trained TensorFlow model.</div>', unsafe_allow_html=True)

with st.sidebar:
    st.header("System Controls")
    api_base = st.text_input("Backend URL", value=API_BASE_DEFAULT).strip().rstrip("/")
    camera_index = st.number_input("Preferred Camera Index", min_value=0, max_value=10, value=0, step=1)
    pred_limit = st.slider("Prediction rows", min_value=5, max_value=100, value=20, step=5)

    col_a, col_b = st.columns(2)
    with col_a:
        if st.button("Activate", use_container_width=True, type="primary"):
            try:
                r = requests.post(f"{api_base}/api/system/activate", params={"camera_index": int(camera_index)}, timeout=20)
                data = r.json()
                st.success(data.get("message", "Activation request sent."))
            except Exception as exc:
                st.error(f"Activate failed: {exc}")
    with col_b:
        if st.button("Deactivate", use_container_width=True):
            try:
                r = requests.post(f"{api_base}/api/system/deactivate", timeout=20)
                data = r.json()
                st.info(data.get("message", "Deactivation request sent."))
            except Exception as exc:
                st.error(f"Deactivate failed: {exc}")

    if st.button("Refresh Now", use_container_width=True):
        st.rerun()

status_col, latest_col = st.columns([1, 1])

status_payload: dict = {}
predictions_payload: list[dict] = []
api_error: str | None = None

try:
    status_payload = requests.get(f"{api_base}/api/system/status", timeout=20).json()
    predictions_payload = requests.get(f"{api_base}/api/predictions", params={"limit": pred_limit}, timeout=20).json()
except Exception as exc:
    api_error = str(exc)

with status_col:
    st.subheader("Live Status")
    with st.container(border=True):
        if api_error:
            st.error(f"Backend unavailable: {api_error}")
            st.info("Backend may still be starting. Wait 30-90 seconds, then click 'Refresh Now' in the sidebar.")
        else:
            active = bool(status_payload.get("active", False))
            camera_open = bool(status_payload.get("camera_open", False))
            st.metric("Backend", "Running" if active else "Stopped")
            st.metric("Camera", "Open" if camera_open else "Closed")

            latest = status_payload.get("latest_prediction")
            if latest:
                st.metric("Latest Label", latest.get("label", "-"))
                st.metric("Confidence", f"{float(latest.get('confidence', 0)) * 100:.2f}%")
                rag_prob = float(latest.get("ragging_probability", 0))
                st.metric("Ragging Probability", f"{rag_prob * 100:.2f}%")
                if latest.get("label", "").lower() == "ragging":
                    st.markdown('<div class="warn">Ragging Detected - immediate review recommended.</div>', unsafe_allow_html=True)
            else:
                st.info("No predictions available yet.")

with latest_col:
    st.subheader("Recent Predictions")
    with st.container(border=True):
        if api_error:
            st.warning("Prediction table unavailable while backend is offline.")
        elif not predictions_payload:
            st.info("No prediction history found.")
        else:
            rows = []
            for row in predictions_payload:
                ts = row.get("timestamp")
                ts_text = ts
                try:
                    ts_text = datetime.fromisoformat(ts.replace("Z", "+00:00")).isoformat() if isinstance(ts, str) else str(ts)
                except Exception:
                    ts_text = str(ts)

                rows.append(
                    {
                        "Time (UTC)": ts_text,
                        "Label": row.get("label", "-"),
                        "Confidence": f"{float(row.get('confidence', 0)) * 100:.2f}%",
                        "Ragging Prob": f"{float(row.get('ragging_probability', 0)) * 100:.2f}%",
                    }
                )

            st.dataframe(pd.DataFrame(rows), use_container_width=True, hide_index=True)

st.caption("Tip: If activation fails, close other camera apps and retry with camera index 1 or 2.")
