const toggleBtn = document.getElementById("toggleBtn");
const systemMsg = document.getElementById("systemMsg");

const statusActive = document.getElementById("statusActive");
const statusCamera = document.getElementById("statusCamera");
const statusLabel = document.getElementById("statusLabel");
const statusConfidence = document.getElementById("statusConfidence");
const statusRaggingProb = document.getElementById("statusRaggingProb");
const historyBody = document.getElementById("historyBody");

const startWebcamBtn = document.getElementById("startWebcamBtn");
const stopWebcamBtn = document.getElementById("stopWebcamBtn");
const webcamStatus = document.getElementById("webcamStatus");
const webcamPrediction = document.getElementById("webcamPrediction");
const webcamWarning = document.getElementById("webcamWarning");
const apiUrlInput = document.getElementById("apiUrl");
const nFramesInput = document.getElementById("nFrames");
const video = document.getElementById("video");
const canvas = document.getElementById("canvas");

let active = false;
let browserStream = null;
let webcamRunning = false;
let frameCounter = 0;
let animationId = null;

async function callApi(path, method = "GET") {
  const res = await fetch(path, { method });
  if (!res.ok) {
    throw new Error(`API error: ${res.status}`);
  }
  return res.json();
}

function pct(v) {
  if (v === null || v === undefined) return "-";
  return `${(Number(v) * 100).toFixed(2)}%`;
}

function renderHistory(rows) {
  historyBody.innerHTML = "";
  rows.forEach((row) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${new Date(row.timestamp).toISOString()}</td>
      <td>${row.label}</td>
      <td>${pct(row.confidence)}</td>
      <td>${pct(row.ragging_probability)}</td>
    `;
    historyBody.appendChild(tr);
  });
}

async function refreshSystem() {
  try {
    const status = await callApi("/api/system/status");
    const history = await callApi("/api/predictions?limit=10");

    active = Boolean(status.active);
    toggleBtn.textContent = active ? "DEACTIVATE THE SYSTEM" : "ACTIVATE THE SYSTEM";

    statusActive.textContent = active ? "Running" : "Stopped";
    statusCamera.textContent = status.camera_open ? "Open" : "Closed";

    const latest = status.latest_prediction;
    statusLabel.textContent = latest?.label ?? "-";
    statusConfidence.textContent = pct(latest?.confidence);
    statusRaggingProb.textContent = pct(latest?.ragging_probability);

    renderHistory(history);
  } catch (err) {
    systemMsg.textContent = "Unable to reach backend API.";
  }
}

async function sendBrowserFrame() {
  const apiUrl = apiUrlInput.value.trim();
  const context = canvas.getContext("2d");
  context.drawImage(video, 0, 0, canvas.width, canvas.height);

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
  if (!blob) {
    return;
  }

  const formData = new FormData();
  formData.append("image", blob, "browser_frame.jpg");

  const response = await fetch(apiUrl, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`Predict API failed with ${response.status}`);
  }

  const data = await response.json();
  const prediction = String(data.prediction || "Unknown");
  const confidence = Number(data.confidence || 0);

  webcamPrediction.textContent = `Prediction: ${prediction} (${(confidence * 100).toFixed(2)}%)`;

  if (prediction.toLowerCase() === "ragging") {
    webcamWarning.classList.remove("hidden");
  } else {
    webcamWarning.classList.add("hidden");
  }
}

async function webcamLoop() {
  if (!webcamRunning) return;

  frameCounter += 1;
  const everyN = Math.max(1, Number(nFramesInput.value) || 12);

  if (frameCounter % everyN === 0) {
    try {
      await sendBrowserFrame();
      webcamStatus.textContent = "Browser webcam running.";
    } catch (err) {
      webcamStatus.textContent = `Webcam API error: ${err.message}`;
    }
  }

  animationId = window.requestAnimationFrame(webcamLoop);
}

async function startBrowserWebcam() {
  if (webcamRunning) return;

  browserStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
  video.srcObject = browserStream;

  await new Promise((resolve) => {
    video.onloadedmetadata = () => resolve();
  });

  canvas.width = video.videoWidth || 640;
  canvas.height = video.videoHeight || 480;

  frameCounter = 0;
  webcamRunning = true;
  webcamStatus.textContent = "Webcam started.";
  webcamLoop();
}

function stopBrowserWebcam() {
  webcamRunning = false;

  if (animationId) {
    window.cancelAnimationFrame(animationId);
    animationId = null;
  }

  if (browserStream) {
    browserStream.getTracks().forEach((track) => track.stop());
    browserStream = null;
  }

  video.srcObject = null;
  webcamStatus.textContent = "Webcam stopped.";
}

toggleBtn.addEventListener("click", async () => {
  toggleBtn.disabled = true;
  try {
    const route = active ? "/api/system/deactivate" : "/api/system/activate";
    const result = await callApi(route, "POST");
    systemMsg.textContent = result.message;
  } catch (err) {
    systemMsg.textContent = "Action failed. Check camera/model availability.";
  } finally {
    toggleBtn.disabled = false;
    await refreshSystem();
  }
});

startWebcamBtn.addEventListener("click", async () => {
  try {
    await startBrowserWebcam();
  } catch (err) {
    webcamStatus.textContent = `Cannot start webcam: ${err.message}`;
  }
});

stopWebcamBtn.addEventListener("click", () => {
  stopBrowserWebcam();
});

window.addEventListener("beforeunload", () => {
  stopBrowserWebcam();
});

refreshSystem();
window.setInterval(refreshSystem, 1000);
