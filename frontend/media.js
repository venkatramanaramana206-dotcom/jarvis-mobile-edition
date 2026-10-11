let audioUrl = null;
let videoUrl = null;
let exportedBlob = null;
let cameraStream = null;

const $ = (id) => document.getElementById(id);

export function initMedia(say = console.log) {
  $("audioInput").addEventListener("change", (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (audioUrl) URL.revokeObjectURL(audioUrl);
    audioUrl = URL.createObjectURL(file);
    $("audioPlayer").src = audioUrl;
    $("audioPlayer").play().catch(() => {
      say("Audio సిద్ధంగా ఉంది. Play బటన్ నొక్కండి.");
    });
  });

  $("videoInput").addEventListener("change", (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    stopCamera();

    if (videoUrl) URL.revokeObjectURL(videoUrl);
    videoUrl = URL.createObjectURL(file);

    $("videoPreview").srcObject = null;
    $("videoPreview").src = videoUrl;
    $("videoPreview").onloadedmetadata = () => {
      $("trimStart").max = $("videoPreview").duration;
      $("trimEnd").max = $("videoPreview").duration;
      $("trimEnd").value = Math.floor($("videoPreview").duration);
      say(`వీడియో లోడ్ అయింది. నిడివి: ${$("videoPreview").duration.toFixed(1)} సెకన్లు.`);
    };
  });

  $("exportButton").addEventListener("click", exportVideo);
  $("shareButton").addEventListener("click", () => shareExportedVideo(say));
}

export function playMusic(say = console.log) {
  const player = $("audioPlayer");

  if (!player.src) {
    $("audioInput").click();
    say("మీ పరికరం నుంచి ఆడియో ఫైల్ ఎంచుకోండి.");
    return;
  }

  if (player.paused) {
    player.play()
      .then(() => say("Music playing."))
      .catch(() => say("Audio ప్లే చేయలేకపోయాను."));
  } else {
    player.pause();
    say("Music paused.");
  }
}

function stopCamera() {
  if (cameraStream) {
    cameraStream.getTracks().forEach(track => track.stop());
    cameraStream = null;
  }
}

export async function openCamera(say = console.log) {
  if (!navigator.mediaDevices?.getUserMedia) {
    say("Camera accessకు HTTPS లేదా localhostలో ఆధునిక browser అవసరం.");
    return;
  }

  try {
    stopCamera();

    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment" },
      audio: false
    });

    const preview = $("videoPreview");
    preview.pause();
    preview.removeAttribute("src");
    preview.srcObject = cameraStream;
    await preview.play();

    say("Camera preview ప్రారంభమైంది. ఆపడానికి మరోసారి Camera ఎంచుకోండి.");

    // A second call stops the camera.
    $("videoPreview").dataset.cameraActive = "true";
  } catch (error) {
    say("Camera తెరవలేకపోయాను: " + error.message);
  }
}

export async function openDialer(say = console.log) {
  const confirmed = window.confirm(
    "ఫోన్ dialer తెరవాలా? మీరు స్వయంగా నంబర్ ఎంచుకుని కాల్ చేయవచ్చు."
  );

  if (!confirmed) {
    say("Call రద్దు చేయబడింది.");
    return;
  }

  const number = window.prompt(
    "Dial చేయాలనుకుంటున్న ఫోన్ నంబర్ నమోదు చేయండి:"
  );

  if (!number || !/^[+0-9()\-\s]{3,25}$/.test(number)) {
    say("చెల్లుబాటు అయ్యే ఫోన్ నంబర్ ఇవ్వండి.");
    return;
  }

  window.location.href = "tel:" + number.replace(/[\s()-]/g, "");
  say("ఫోన్ dialer తెరవడానికి ప్రయత్నించాను. కాల్‌ను మీరు నిర్ధారించాలి.");
}

function supportedMimeType() {
  if (!window.MediaRecorder) return "";

  return [
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm"
  ].find(type => MediaRecorder.isTypeSupported(type)) || "";
}

async function exportVideo() {
  const video = $("videoPreview");
  const start = Number($("trimStart").value);
  const end = Number($("trimEnd").value);
  const overlay = $("overlayText").value.trim();
  const cropMode = $("cropMode").value;
  const progress = $("exportProgress");

  if (!videoUrl || !video.src || video.srcObject) {
    $("exportStatus").textContent = "ముందుగా ఎడిట్ చేయడానికి వీడియో ఫైల్ ఎంచుకోండి.";
    return;
  }

  if (!Number.isFinite(start) || !Number.isFinite(end) ||
      start < 0 || end <= start || end > video.duration) {
    $("exportStatus").textContent = "Trim start/end సమయాలను సరిచూడండి.";
    return;
  }

  const mimeType = supportedMimeType();

  if (!mimeType || !HTMLCanvasElement.prototype.captureStream) {
    $("exportStatus").textContent =
      "ఈ browserలో video export మద్దతు లేదు. తాజా Chromeలో ప్రయత్నించండి.";
    return;
  }

  const canvas = document.createElement("canvas");
  canvas.width = 1280;
  canvas.height = 720;

  const context = canvas.getContext("2d");
  const stream = canvas.captureStream(30);
  const chunks = [];

  let recorder;

  try {
    recorder = new MediaRecorder(stream, { mimeType });
  } catch (error) {
    $("exportStatus").textContent = "Export ప్రారంభం కాలేదు: " + error.message;
    stream.getTracks().forEach(track => track.stop());
    return;
  }

  const duration = end - start;
  let animationFrame = 0;
  let stopped = false;

  function drawFrame() {
    if (stopped) return;

    const vw = video.videoWidth || 1280;
    const vh = video.videoHeight || 720;
    const scale = cropMode === "cover"
      ? Math.max(canvas.width / vw, canvas.height / vh)
      : Math.min(canvas.width / vw, canvas.height / vh);

    const dw = vw * scale;
    const dh = vh * scale;

    context.fillStyle = "#000";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(
      video,
      (canvas.width - dw) / 2,
      (canvas.height - dh) / 2,
      dw,
      dh
    );

    if (overlay) {
      context.font = "bold 36px sans-serif";
      context.textAlign = "center";
      context.lineWidth = 4;
      context.strokeStyle = "#00121d";
      context.fillStyle = "#ffffff";
      context.strokeText(overlay, canvas.width / 2, canvas.height - 45);
      context.fillText(overlay, canvas.width / 2, canvas.height - 45);
    }

    const completed = Math.max(0, video.currentTime - start);
    progress.value = Math.min(100, (completed / duration) * 100);

    if (video.currentTime >= end || video.ended) {
      stopped = true;
      video.pause();
      recorder.stop();
      return;
    }

    animationFrame = requestAnimationFrame(drawFrame);
  }

  recorder.ondataavailable = event => {
    if (event.data.size) chunks.push(event.data);
  };

  recorder.onerror = event => {
    stopped = true;
    cancelAnimationFrame(animationFrame);
    $("exportStatus").textContent = "Export error: " + event.error?.message;
    stream.getTracks().forEach(track => track.stop());
  };

  recorder.onstop = () => {
    stopped = true;
    cancelAnimationFrame(animationFrame);
    stream.getTracks().forEach(track => track.stop());

    exportedBlob = new Blob(chunks, { type: mimeType });
    const outputUrl = URL.createObjectURL(exportedBlob);
    const link = $("downloadVideo");

    link.href = outputUrl;
    link.download = "jarvis-edited-video.webm";
    link.textContent = "Download exported video";
    link.hidden = false;

    progress.value = 100;
    $("exportStatus").textContent =
      "Export పూర్తయింది. వీడియోను download చేసుకోవచ్చు లేదా share చేయవచ్చు.";
  };

  video.pause();
  video.currentTime = start;

  await new Promise(resolve => {
    video.addEventListener("seeked", resolve, { once: true });
  });

  video.muted = true;

  try {
    recorder.start(250);
    await video.play();
    drawFrame();
    $("exportStatus").textContent = "వీడియో export అవుతోంది...";
  } catch (error) {
    stopped = true;
    if (recorder.state !== "inactive") recorder.stop();
    $("exportStatus").textContent = "Export ప్రారంభించలేకపోయాను: " + error.message;
  }
}

export async function shareExportedVideo(say = console.log) {
  if (!exportedBlob) {
    say("ముందుగా వీడియో export చేయండి.");
    return;
  }

  if (!window.confirm("Export చేసిన వీడియోను share చేయాలా?")) {
    say("Sharing రద్దు చేయబడింది.");
    return;
  }

  const file = new File(
    [exportedBlob],
    "jarvis-edited-video.webm",
    { type: exportedBlob.type || "video/webm" }
  );

  if (navigator.canShare?.({ files: [file] }) && navigator.share) {
    try {
      await navigator.share({
        title: "JARVIS edited video",
        text: "Shared from J.A.R.V.I.S",
        files: [file]
      });
      say("Share menu తెరవబడింది.");
    } catch (error) {
      if (error.name !== "AbortError") {
        say("Share చేయలేకపోయాను: " + error.message);
      }
    }
  } else {
    $("downloadVideo").click();
    say("ఈ browserలో file sharing అందుబాటులో లేదు. వీడియో download ప్రారంభించాను.");
  }
  }
