import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Activity, Camera, ShieldAlert, Siren } from "lucide-react";

import { Button } from "@/components/ui/button";

type PredictionRow = {
  id: string;
  timestamp: string;
  strict_label: "Ragging" | "Normal";
  backend_label: string;
  confidence: number;
  ragging_probability: number;
};

type PredictPayload = {
  prediction: string;
  confidence: number;
  ragging_probability: number;
  top_label: string;
  top_confidence: number;
  threshold_ragging: number;
  threshold_min_confidence: number;
};

const API_BASE = (
  import.meta.env.VITE_API_BASE_URL?.trim() ||
  `${window.location.protocol}//${window.location.hostname}:8000`
).replace(/\/$/, "");
const PREDICTION_INTERVAL_MS = 1300;
const STRICT_CLIENT_CONFIDENCE = 0.92;
const MAX_MANUAL_CAMERA_INDEX = 10;

const isNetworkFetchError = (error: unknown) => error instanceof TypeError && /fetch/i.test(error.message);

const readActivationError = (error: unknown): string => {
  if (error instanceof DOMException) {
    if (error.name === "NotAllowedError") {
      return "Camera permission denied. Allow camera access in your browser and try again.";
    }
    if (error.name === "NotFoundError") {
      return "No camera device found. Connect a camera and try again.";
    }
    if (error.name === "NotReadableError") {
      return "Camera is busy in another app. Close other camera apps and try again.";
    }
    if (error.name === "OverconstrainedError") {
      return "Selected camera is unavailable. Try a different camera index.";
    }
    if (error.name === "SecurityError") {
      return "Browser blocked camera access. Open the app on localhost and allow camera permission.";
    }
    if (error.message?.trim()) {
      return error.message;
    }
  }

  if (error instanceof Error && error.message?.trim()) {
    return error.message;
  }

  if (typeof error === "string" && error.trim()) {
    return error;
  }

  return "Unable to start camera. Check permission and camera availability, then try again.";
};

const readErrorMessage = async (res: Response): Promise<string> => {
  try {
    const payload = await res.json();
    if (payload?.detail) return String(payload.detail);
    if (payload?.message) return String(payload.message);
  } catch {
    // Fall through to status-based fallback.
  }

  return `${res.status} ${res.statusText}`.trim();
};

export function PanelPage() {
  const [cameraIndex, setCameraIndex] = useState(0);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [predictions, setPredictions] = useState<PredictionRow[]>([]);
  const [message, setMessage] = useState("Panel ready. Click Activate System to start webcam inference.");
  const [isActive, setIsActive] = useState(false);
  const [loading, setLoading] = useState(false);

  const streamRef = useRef<MediaStream | null>(null);
  const loopRef = useRef<number | null>(null);
  const backendRetryRef = useRef<number | null>(null);
  const activeCameraIndexRef = useRef<number | null>(null);
  const captureAndPredictRef = useRef<(() => Promise<void>) | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const backendOnlineRef = useRef(false);

  const pct = useCallback((value: number | undefined) => {
    if (value === undefined) return "-";
    return `${(value * 100).toFixed(2)}%`;
  }, []);

  const isBackendReachable = useCallback(async () => {
    try {
      const health = await fetch(`${API_BASE}/api/health`);
      return health.ok;
    } catch {
      return false;
    }
  }, []);

  const requestBackendActivation = useCallback(async (index: number) => {
    try {
      const activateRes = await fetch(`${API_BASE}/api/system/activate?camera_index=${index}`, {
        method: "POST",
      });

      const payload = await activateRes.json().catch(() => ({}));
      if (!activateRes.ok) {
        return `Backend warning: ${payload?.detail || `${activateRes.status} ${activateRes.statusText}`.trim()}`;
      }

      return payload?.message ? `Backend: ${String(payload.message)}` : "Backend activation requested.";
    } catch {
      return "Backend warning: unable to trigger /api/system/activate.";
    }
  }, []);

  const requestBackendDeactivation = useCallback(async () => {
    try {
      const deactivateRes = await fetch(`${API_BASE}/api/system/deactivate`, {
        method: "POST",
      });

      const payload = await deactivateRes.json().catch(() => ({}));
      if (!deactivateRes.ok) {
        return "";
      }

      return payload?.message ? String(payload.message) : "";
    } catch {
      return "";
    }
  }, []);

  const loadCameras = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) {
      setMessage("This browser does not support camera enumeration.");
      return;
    }

    const allDevices = await navigator.mediaDevices.enumerateDevices();
    const cameras = allDevices.filter((device) => device.kind === "videoinput");
    setDevices(cameras);
    setCameraIndex((prev) => {
      if (cameras.length === 0) return 0;
      return Math.min(Math.max(0, prev), cameras.length - 1);
    });
  }, []);

  useEffect(() => {
    loadCameras().catch(() => undefined);

    const handleDeviceChange = () => {
      loadCameras().catch(() => undefined);
    };

    navigator.mediaDevices?.addEventListener("devicechange", handleDeviceChange);
    return () => {
      navigator.mediaDevices?.removeEventListener("devicechange", handleDeviceChange);
    };
  }, [loadCameras]);

  const stopCapture = useCallback(() => {
    if (loopRef.current !== null) {
      window.clearInterval(loopRef.current);
      loopRef.current = null;
    }

    if (backendRetryRef.current !== null) {
      window.clearInterval(backendRetryRef.current);
      backendRetryRef.current = null;
    }

    backendOnlineRef.current = false;
    activeCameraIndexRef.current = null;

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const selectedDevice = useMemo(() => devices[cameraIndex] ?? null, [devices, cameraIndex]);

  const buildConstraintsForIndex = useCallback(
    (index: number): MediaStreamConstraints => {
      const device = devices[index] ?? null;
      if (!device) {
        return { video: true, audio: false };
      }

      return { video: { deviceId: { exact: device.deviceId } }, audio: false };
    },
    [devices],
  );

  const applyCameraStream = useCallback(
    async (index: number): Promise<string> => {
      const constraints = buildConstraintsForIndex(index);
      let stream: MediaStream;
      let cameraNotice = "";

      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (error) {
        const hasExplicitDevice = Boolean(devices[index]);
        if (!hasExplicitDevice) {
          throw error;
        }

        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        cameraNotice = "Selected camera index unavailable; switched to default camera.";
      }

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      return cameraNotice;
    },
    [buildConstraintsForIndex, devices],
  );

  const startPredictionLoop = useCallback(() => {
    if (loopRef.current !== null) return;

    loopRef.current = window.setInterval(() => {
      captureAndPredictRef.current?.().catch(() => undefined);
    }, PREDICTION_INTERVAL_MS);
  }, []);

  const startBackendReconnectWatcher = useCallback(
    (index: number) => {
      if (backendRetryRef.current !== null) return;

      backendRetryRef.current = window.setInterval(() => {
        isBackendReachable()
          .then(async (ok) => {
            if (!ok || !streamRef.current) return;

            backendOnlineRef.current = true;
            if (backendRetryRef.current !== null) {
              window.clearInterval(backendRetryRef.current);
              backendRetryRef.current = null;
            }

            const reconnectMessage = await requestBackendActivation(index);
            setMessage(
              `Camera active on index ${index}. Backend reconnected. ${reconnectMessage}`,
            );

            startPredictionLoop();
            await captureAndPredictRef.current?.();
          })
          .catch(() => undefined);
      }, 3000);
    },
    [isBackendReachable, requestBackendActivation, startPredictionLoop],
  );

  const captureAndPredict = useCallback(async () => {
    if (!backendOnlineRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !streamRef.current) return;
    if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;

    const width = video.videoWidth || 640;
    const height = video.videoHeight || 360;
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob((value) => resolve(value), "image/jpeg", 0.8));
    if (!blob) {
      setMessage("Unable to capture camera frame.");
      return;
    }

    const formData = new FormData();
    formData.append("image", blob, "capture.jpg");

    try {
      const res = await fetch(`${API_BASE}/api/predict`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        throw new Error(await readErrorMessage(res));
      }

      const data = (await res.json()) as PredictPayload;
      const isStrictRagging = data.prediction === "Ragging" && data.confidence >= STRICT_CLIENT_CONFIDENCE;
      const strictLabel: "Ragging" | "Normal" = isStrictRagging ? "Ragging" : "Normal";
      const strictConfidence = isStrictRagging ? data.confidence : Math.max(1 - data.ragging_probability, data.confidence);

      setPredictions((prev) => [
        {
          id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
          timestamp: new Date().toISOString(),
          strict_label: strictLabel,
          backend_label: data.prediction,
          confidence: strictConfidence,
          ragging_probability: data.ragging_probability,
        },
        ...prev,
      ].slice(0, 25));

      setMessage(
        strictLabel === "Ragging"
          ? `Strict alert: Ragging detected at ${pct(strictConfidence)} confidence.`
          : `Strict normal: no ragging event confirmed. Ragging probability ${pct(data.ragging_probability)}.`,
      );
    } catch (error) {
      if (isNetworkFetchError(error)) {
        backendOnlineRef.current = false;
        if (loopRef.current !== null) {
          window.clearInterval(loopRef.current);
          loopRef.current = null;
        }
        setMessage(`Backend disconnected at ${API_BASE}. Camera is still active. Waiting to reconnect backend...`);
        startBackendReconnectWatcher(activeCameraIndexRef.current ?? cameraIndex);
      } else {
        setMessage(`Prediction failed: ${(error as Error).message}`);
      }
    }
  }, [cameraIndex, pct, startBackendReconnectWatcher]);

  useEffect(() => {
    captureAndPredictRef.current = captureAndPredict;
  }, [captureAndPredict]);

  const activate = async () => {
    if (isActive) return;

    setLoading(true);
    setMessage("Activating camera and detection loop...");

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("This browser does not support camera access.");
      }

      stopCapture();
      const cameraNotice = await applyCameraStream(cameraIndex);
      activeCameraIndexRef.current = cameraIndex;

      setIsActive(true);
      const backendReachable = await isBackendReachable();
      backendOnlineRef.current = backendReachable;

      const backendMessage = backendReachable
        ? await requestBackendActivation(cameraIndex)
        : `Backend offline at ${API_BASE}. Camera started locally; run start-all.bat to enable predictions.`;
      setMessage(
        `Camera active on index ${cameraIndex}. Capturing every ${(PREDICTION_INTERVAL_MS / 1000).toFixed(1)}s. ${cameraNotice} ${backendMessage}`.trim(),
      );

      if (backendReachable) {
        startPredictionLoop();
        await captureAndPredict();
      } else {
        startBackendReconnectWatcher(cameraIndex);
      }
    } catch (error) {
      stopCapture();
      setIsActive(false);
      setMessage(`Activation failed: ${readActivationError(error)}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isActive) return;
    if (activeCameraIndexRef.current === null || activeCameraIndexRef.current === cameraIndex) return;

    let cancelled = false;

    const switchCamera = async () => {
      setLoading(true);
      setMessage(`Switching to camera index ${cameraIndex}...`);

      try {
        const notice = await applyCameraStream(cameraIndex);
        activeCameraIndexRef.current = cameraIndex;

        const backendReachable = await isBackendReachable();
        backendOnlineRef.current = backendReachable;

        if (backendReachable) {
          const backendMessage = await requestBackendActivation(cameraIndex);
          startPredictionLoop();
          await captureAndPredict();
          if (!cancelled) {
            setMessage(
              `Camera switched to index ${cameraIndex}. ${notice} ${backendMessage}`.trim(),
            );
          }
        } else {
          if (loopRef.current !== null) {
            window.clearInterval(loopRef.current);
            loopRef.current = null;
          }
          if (!cancelled) {
            setMessage(
              `Camera switched to index ${cameraIndex}. Backend offline at ${API_BASE}; waiting to reconnect for predictions.`,
            );
          }
          startBackendReconnectWatcher(cameraIndex);
        }
      } catch (error) {
        if (!cancelled) {
          setMessage(`Failed to switch camera: ${readActivationError(error)}`);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    switchCamera().catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [
    applyCameraStream,
    cameraIndex,
    captureAndPredict,
    isActive,
    isBackendReachable,
    requestBackendActivation,
    startBackendReconnectWatcher,
    startPredictionLoop,
  ]);

  const deactivate = useCallback(() => {
    const run = async () => {
      stopCapture();
      setIsActive(false);
      const backendMessage = await requestBackendDeactivation();
      setMessage(
        backendMessage
          ? `System deactivated. Camera stopped. Backend: ${backendMessage}`
          : "System deactivated. Camera stopped.",
      );
    };

    run().catch(() => {
      setMessage("System deactivated. Camera stopped.");
    });
  }, [requestBackendDeactivation, stopCapture]);

  useEffect(() => {
    return () => {
      stopCapture();
    };
  }, [stopCapture]);

  const latest = predictions[0] ?? null;
  const alertMode = latest?.strict_label === "Ragging";
  const maxCameraIndex = MAX_MANUAL_CAMERA_INDEX;

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 pt-24">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-blue-400">Operations Panel</p>
          <h1 className="text-3xl font-bold text-white">Activate Panel</h1>
          <p className="mt-2 text-sm text-slate-300">{message}</p>
        </div>

        <div className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 p-2">
          <label htmlFor="cameraIndex" className="text-sm text-slate-200">
            Camera Index
          </label>
          <input
            id="cameraIndex"
            type="number"
            min={0}
            max={maxCameraIndex}
            value={cameraIndex}
            onChange={(e) => {
              const next = Number(e.target.value || 0);
              const safeValue = Number.isFinite(next) ? next : 0;
              setCameraIndex(Math.min(maxCameraIndex, Math.max(0, safeValue)));
            }}
            className="w-16 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-slate-100"
          />
        </div>
      </div>

      <div className="mb-5 grid gap-3 md:grid-cols-4">
        <article className="rounded-lg border border-slate-800 bg-slate-900/70 p-4">
          <p className="text-xs uppercase text-slate-400">System</p>
          <p className="mt-2 text-xl font-semibold text-white">{isActive ? "Active" : "Stopped"}</p>
          <Activity className="mt-2 h-4 w-4 text-blue-400" />
        </article>
        <article className="rounded-lg border border-slate-800 bg-slate-900/70 p-4">
          <p className="text-xs uppercase text-slate-400">Camera Source</p>
          <p className="mt-2 text-sm font-semibold text-white break-words">
            {selectedDevice?.label || `Camera ${cameraIndex}`}
          </p>
          <Camera className="mt-2 h-4 w-4 text-blue-400" />
        </article>
        <article className="rounded-lg border border-slate-800 bg-slate-900/70 p-4">
          <p className="text-xs uppercase text-slate-400">Latest Strict Label</p>
          <p className="mt-2 text-xl font-semibold text-white">{latest?.strict_label || "-"}</p>
          <Siren className={`mt-2 h-4 w-4 ${alertMode ? "text-red-400" : "text-emerald-400"}`} />
        </article>
        <article className="rounded-lg border border-slate-800 bg-slate-900/70 p-4">
          <p className="text-xs uppercase text-slate-400">Strict Confidence</p>
          <p className="mt-2 text-xl font-semibold text-white">{latest ? pct(latest.confidence) : "-"}</p>
          <ShieldAlert className="mt-2 h-4 w-4 text-blue-400" />
        </article>
      </div>

      {alertMode && (
        <div className="mb-4 rounded-md border border-red-700 bg-red-950/50 p-3 text-sm font-semibold text-red-200">
          Alert: Ragging pattern detected. Immediate review is recommended.
        </div>
      )}

      <div className="mb-6 flex flex-wrap gap-2">
        <Button onClick={activate} disabled={loading || isActive}>
          Activate System
        </Button>
        <Button variant="danger" onClick={deactivate} disabled={loading || !isActive}>
          Deactivate System
        </Button>
      </div>

      <section className="mb-6 grid gap-4 lg:grid-cols-2">
        <article className="overflow-hidden rounded-lg border border-slate-800 bg-slate-900/70">
          <div className="border-b border-slate-800 px-4 py-3 text-sm font-semibold text-slate-100">Camera Feed</div>
          <div className="relative aspect-video bg-black">
            <video ref={videoRef} muted playsInline autoPlay className="h-full w-full object-cover" />
          </div>
        </article>

        <article className="rounded-lg border border-slate-800 bg-slate-900/70 p-4">
          <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-300">Output Plate</h2>
          <p className="mt-3 rounded-md border border-slate-700 bg-slate-950 p-3 text-sm text-slate-200 min-h-24">{message}</p>
          <p className="mt-3 text-xs text-slate-400">
            Strict mode requires backend ragging prediction and at least {pct(STRICT_CLIENT_CONFIDENCE)} confidence before showing Ragging.
          </p>
        </article>
      </section>

      <canvas ref={canvasRef} className="hidden" aria-hidden="true" />

      <section className="overflow-hidden rounded-lg border border-slate-800 bg-slate-900/70">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-slate-800 text-slate-300">
              <th className="px-4 py-3">Time (UTC)</th>
              <th className="px-4 py-3">Strict Label</th>
              <th className="px-4 py-3">Backend Label</th>
              <th className="px-4 py-3">Strict Confidence</th>
              <th className="px-4 py-3">Ragging Probability</th>
            </tr>
          </thead>
          <tbody>
            {predictions.map((row) => (
              <tr key={row.id} className="border-b border-slate-800/70 text-slate-100">
                <td className="px-4 py-3">{new Date(row.timestamp).toISOString()}</td>
                <td className="px-4 py-3">{row.strict_label}</td>
                <td className="px-4 py-3">{row.backend_label}</td>
                <td className="px-4 py-3">{pct(row.confidence)}</td>
                <td className="px-4 py-3">{pct(row.ragging_probability)}</td>
              </tr>
            ))}
            {predictions.length === 0 && (
              <tr>
                <td className="px-4 py-4 text-slate-400" colSpan={5}>
                  No predictions yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </main>
  );
}
