const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");
const statusText = document.getElementById("status");
const predictionText = document.getElementById("predictionText");
const warningText = document.getElementById("warningText");
const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const apiUrlInput = document.getElementById("apiUrl");
const nFramesInput = document.getElementById("nFrames");

let stream = null;
let running = false;
let frameCounter = 0;
let rafId = null;

async function sendFrame() {
  const apiUrl = apiUrlInput.value.trim();
  const context = canvas.getContext("2d");
  context.drawImage(video, 0, 0, canvas.width, canvas.height);

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
  if (!blob) return;

  const formData = new FormData();
  formData.append("image", blob, "frame.jpg");

  const response = await fetch(apiUrl, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`);
  }

  const data = await response.json();
  const prediction = data.prediction || "Unknown";
  const confidence = Number(data.confidence || 0);

  predictionText.textContent = `Prediction: ${prediction} (${(confidence * 100).toFixed(2)}%)`;

  if (prediction.toLowerCase() === "ragging") {
    warningText.textContent = "Ragging Detected";
    warningText.className = "danger";
  } else {
    warningText.textContent = "Normal Activity";
    warningText.className = "ok";
  }
}

async function loop() {
  if (!running) return;

  frameCounter += 1;
  const everyN = Math.max(1, Number(nFramesInput.value) || 12);

  if (frameCounter % everyN === 0) {
    try {
      await sendFrame();
      statusText.textContent = "Streaming and predicting...";
    } catch (error) {
      statusText.textContent = `Error: ${error.message}`;
    }
  }

  rafId = requestAnimationFrame(loop);
}

async function startDetection() {
  if (running) return;

  stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
  video.srcObject = stream;

  await new Promise((resolve) => {
    video.onloadedmetadata = () => resolve();
  });

  canvas.width = video.videoWidth || 640;
  canvas.height = video.videoHeight || 480;

  running = true;
  frameCounter = 0;
  statusText.textContent = "Webcam started.";
  loop();
}

function stopDetection() {
  running = false;
  if (rafId) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }

  if (stream) {
    stream.getTracks().forEach((track) => track.stop());
    stream = null;
  }

  video.srcObject = null;
  statusText.textContent = "Stopped.";
}

startBtn.addEventListener("click", async () => {
  try {
    await startDetection();
  } catch (error) {
    statusText.textContent = `Cannot start webcam: ${error.message}`;
  }
});

stopBtn.addEventListener("click", stopDetection);

window.addEventListener("beforeunload", stopDetection);
