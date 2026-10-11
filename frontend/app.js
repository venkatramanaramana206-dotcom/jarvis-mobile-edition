 import { routeCommand } from "./commands.js";
import { loadWeather, weatherByCity, weatherByLocation } from "./weather.js";
import { loadNews } from "./news.js";
import {
  initMedia,
  playMusic,
  openCamera,
  openDialer,
  shareExportedVideo
} from "./media.js";
import { initSettings, getSetting } from "./settings.js";

const $ = (id) => document.getElementById(id);

function setResponse(message) {
  $("response").textContent = message;
  $("assistantStatus").textContent = message;
}

function updateClock() {
  const now = new Date();
  $("clock").textContent = now.toLocaleTimeString([], {
    hour: "2-digit", minute: "2-digit", second: "2-digit"
  });
  $("dateText").textContent = now.toLocaleDateString([], {
    weekday: "long", year: "numeric", month: "long", day: "numeric"
  });
}

async function executeCommand(command) {
  const result = await routeCommand(command, {
    ask: (message) => window.confirm(message),
    say: setResponse,
    weather: async () => {
      await loadWeather(setResponse);
    },
    news: async () => {
      await loadNews(getSetting("newsApiKey"), setResponse);
    },
    music: () => playMusic(setResponse),
    camera: () => openCamera(setResponse),
    call: () => openDialer(setResponse),
    share: () => shareExportedVideo(setResponse)
  });

  if (result?.message) setResponse(result.message);
}

$("sendButton").addEventListener("click", () => {
  const command = $("commandInput").value.trim();
  if (!command) return setResponse("ముందుగా ఒక command టైప్ చేయండి.");
  executeCommand(command);
});

$("commandInput").addEventListener("keydown", (event) => {
  if (event.key === "Enter") $("sendButton").click();
});

document.querySelectorAll("[data-command]").forEach((button) => {
  button.addEventListener("click", () => {
    executeCommand(button.dataset.command);
  });
});

$("voiceButton").addEventListener("click", () => {
  const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    setResponse("ఈ browserలో voice recognition అందుబాటులో లేదు. Chromeలో ప్రయత్నించండి.");
    return;
  }

  const recognition = new SpeechRecognition();
  recognition.lang = "te-IN";
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  $("reactor").classList.add("listening");
  setResponse("వింటున్నాను... మాట్లాడండి.");

  recognition.onresult = (event) => {
    const spoken = event.results[0][0].transcript;
    $("commandInput").value = spoken;
    executeCommand(spoken);
  };

  recognition.onerror = (event) => {
    setResponse("Voice error: " + event.error + ". Text command ప్రయత్నించండి.");
  };

  recognition.onend = () => $("reactor").classList.remove("listening");

  try {
    recognition.start();
  } catch {
    $("reactor").classList.remove("listening");
    setResponse("Voice recognition ప్రారంభించలేకపోయాను. మళ్లీ ప్రయత్నించండి.");
  }
});

$("cityButton").addEventListener("click", async () => {
  const city = $("cityInput").value.trim();
  if (!city) return setResponse("దయచేసి నగరం పేరు నమోదు చేయండి.");
  await weatherByCity(city, setResponse);
});

$("locationButton").addEventListener("click", async () => {
  await weatherByLocation(setResponse);
});

$("openSettings").addEventListener("click", () => {
  $("newsApiKey").focus();
  $("newsApiKey").scrollIntoView({ behavior: "smooth", block: "center" });
});

initSettings(setResponse);
initMedia(setResponse);
updateClock();
setInterval(updateClock, 1000);

if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  navigator.serviceWorker.register("./service-worker.js").catch(() => {});
}

setResponse("J.A.R.V.I.S సిద్ధంగా ఉంది. మీ command ఇవ్వండి.");
