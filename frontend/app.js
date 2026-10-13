
"use strict";

const $ = (id) => document.getElementById(id);

const state = {
  key: localStorage.getItem("jarvis_gemini_key") || "",
  model: localStorage.getItem("jarvis_model") || "gemini-3.8-flash",
  name: localStorage.getItem("jarvis_name") || "there",
  busy: false,
  recognition: null,
  mediaUrl: null
};

function toast(msg) {
  const t = $("toast");
  if (!t) return;
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => t.classList.remove("show"), 2600);
}

function setStatus(msg, good = true) {
  const connection = $("connection");
  if (connection) {
    connection.innerHTML =
      `<i style="background:${good ? "#55e4ad" : "#ffc36c"}"></i> ${msg}`;
  }

  const apiStatus = $("apiStatus");
  if (apiStatus) {
    apiStatus.textContent = state.key ? "● Configured" : "● Setup needed";
    apiStatus.className = state.key ? "green" : "amber";
  }
}

function openSettings() {
  if ($("apiKey")) $("apiKey").value = state.key;
  if ($("modelSelect")) $("modelSelect").value = state.model;
  if ($("nameInput")) {
    $("nameInput").value = state.name === "there" ? "" : state.name;
  }
  $("settingsModal")?.classList.remove("hidden");
}

function closeModals() {
  $("settingsModal")?.classList.add("hidden");
  $("toolModal")?.classList.add("hidden");
}

function saveSettings() {
  state.key = $("apiKey")?.value.trim() || "";
  state.model = $("modelSelect")?.value || "gemini-3.8-flash";
  state.name = $("nameInput")?.value.trim() || "there";

  localStorage.setItem("jarvis_gemini_key", state.key);
  localStorage.setItem("jarvis_model", state.model);
  localStorage.setItem("jarvis_name", state.name);

  if ($("userName")) $("userName").textContent = state.name;

  closeModals();
  setStatus(state.key ? "AI READY" : "OFFLINE MODE", !!state.key);
  toast(state.key ? "Settings saved on this device" : "Settings saved");

  if (state.key) {
    addMessage("ai", "API key saved. I am ready for your requests.");
  }
}

function addMessage(who, text) {
  const chatLog = $("chatLog");
  if (!chatLog) return;

  const node = document.createElement("div");
  node.className = `message ${who}`;

  const orb = document.createElement("span");
  orb.className = "mini-orb";
  orb.textContent = who === "ai" ? "J" : "YOU";

  const body = document.createElement("div");

  const label = document.createElement("small");
  label.textContent =
    (who === "ai" ? "JARVIS" : "YOU") +
    " · " +
    new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit"
    });

  const p = document.createElement("p");
  p.textContent = text;

  body.append(label, p);
  node.append(orb, body);
  chatLog.append(node);
  chatLog.scrollTop = chatLog.scrollHeight;
}

function speak(text) {
  if (!("speechSynthesis" in window)) return;

  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 1.08;
  utterance.pitch = 1;

  window.speechSynthesis.speak(utterance);
}

function safeOpen(url) {
  window.open(url, "_blank", "noopener,noreferrer");
}

async function askGemini(prompt) {
  if (!state.key) {
    throw new Error("Gemini API key is missing. Open Settings and add your key.");
  }

  const endpoint =
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(state.model)}:generateContent?key=${encodeURIComponent(state.key)}`;

  let response;

  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{
            text:
              "You are JARVIS, a concise, helpful voice assistant. " +
              "Answer clearly and quickly. If asked to perform a device action " +
              "you cannot actually perform from a browser, explain the limitation " +
              "and provide a safe alternative. Do not claim actions were completed " +
              "unless they were."
          }]
        },
        contents: [{
          role: "user",
          parts: [{ text: prompt }]
        }],
        generationConfig: {
          temperature: 0.6,
          maxOutputTokens: 900
        }
      })
    });
  } catch (error) {
    throw new Error(
      "Network request failed. Check your internet connection, API key restrictions, and web origin."
    );
  }

  let data;

  try {
    data = await response.json();
  } catch {
    throw new Error("Gemini returned an unreadable response. Please try again.");
  }

  if (!response.ok) {
    throw new Error(
      data?.error?.message || `Gemini request failed (${response.status})`
    );
  }

  const answer = data?.candidates?.[0]?.content?.parts
    ?.map(part => part.text || "")
    .join("")
    .trim();

  if (!answer) {
    const reason = data?.promptFeedback?.blockReason;

    if (reason) {
      throw new Error(`Gemini blocked the prompt: ${reason}`);
    }

    throw new Error(
      "Gemini returned an empty response. Check the model and API key."
    );
  }

  return answer;
}

function localCommand(query) {
  const s = query.toLowerCase();

  if (/\b(time|date|what day|today's date)\b/.test(s)) {
    return `It is ${new Date().toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit"
    })} on ${new Date().toLocaleDateString([], {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric"
    })}.`;
  }

  if (/\b(weather|temperature|forecast)\b/.test(s)) {
    refreshWeather();
    return "I am checking the latest local forecast. The weather panel will update shortly.";
  }

  if (/\b(youtube|song|music|video search|play music)\b/.test(s)) {
    const term =
      query.replace(
        /(search|youtube|find|play|song|music|video|for me|please)/ig,
        ""
      ).trim() || "popular songs";

    safeOpen(
      "https://www.youtube.com/results?search_query=" +
      encodeURIComponent(term)
    );

    return `I opened YouTube search for: ${term}. Playback may require a tap in your browser.`;
  }

  if (/\b(open browser|browse web|search web|google)\b/.test(s)) {
    safeOpen(
      "https://www.google.com/search?q=" + encodeURIComponent(query)
    );

    return "I opened a web search for your request.";
  }

  if (/\b(photo editor|edit photo|image edit)\b/.test(s)) {
    openTool("photo");
    return "Photo tools are open. Upload an image to preview basic filters.";
  }

  if (/\b(video editor|edit video|video tools)\b/.test(s)) {
    openTool("video");
    return "Video tools are open. You can preview a video or open an online editor.";
  }

  return null;
}

async function sendPrompt(raw) {
  const query = String(raw || "").trim();

  if (!query || state.busy) return;

  if ($("promptInput")) $("promptInput").value = "";

  addMessage("user", query);

  const localReply = localCommand(query);

  if (localReply) {
    addMessage("ai", localReply);
    speak(localReply);
    return;
  }

  state.busy = true;

  if ($("listenState")) $("listenState").textContent = "Thinking…";
  if ($("heroStatus")) $("heroStatus").textContent = "Processing your request";

  setStatus("PROCESSING", true);

  try {
    const answer = await askGemini(query);

    addMessage("ai", answer);
    speak(answer);

    if ($("heroStatus")) $("heroStatus").textContent = "Request complete";

    setStatus("AI READY", true);
  } catch (error) {
    const message =
      `I couldn't complete that request: ${error.message || "Unknown error"}`;

    addMessage("ai", message);
    speak(message);

    if ($("heroStatus")) {
      $("heroStatus").textContent = "Request needs attention";
    }

    setStatus("NEEDS ATTENTION", false);

    if (/API key is missing/i.test(error.message || "")) {
      openSettings();
    }
  } finally {
    state.busy = false;

    if ($("listenState")) {
      $("listenState").textContent = "Ready to listen";
    }
  }
}

function startVoice() {
  const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    toast("Voice recognition is not supported here. Try Chrome.");
    return;
  }

  if (state.recognition) {
    try {
      state.recognition.stop();
    } catch (_) {}

    state.recognition = null;

    if ($("listenState")) {
      $("listenState").textContent = "Ready to listen";
    }

    return;
  }

  const recognition = new SpeechRecognition();

  state.recognition = recognition;
  recognition.lang = navigator.language || "en-US";
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  recognition.onstart = () => {
    if ($("listenState")) {
      $("listenState").textContent = "Listening… speak now";
    }

    $("micBtn")?.parentElement?.classList.add("listening");
  };

  recognition.onerror = (event) => {
    toast("Voice error: " + event.error);

    if ($("listenState")) {
      $("listenState").textContent = "Ready to listen";
    }

    $("micBtn")?.parentElement?.classList.remove("listening");
    state.recognition = null;
  };

  recognition.onend = () => {
    $("micBtn")?.parentElement?.classList.remove("listening");

    if ($("listenState")) {
      $("listenState").textContent = "Ready to listen";
    }

    state.recognition = null;
  };

  recognition.onresult = (event) => {
    sendPrompt(event.results[0][0].transcript);
  };

  try {
    recognition.start();
  } catch (error) {
    toast("Could not start microphone: " + error.message);
  }
}

async function refreshWeather() {
  if ($("weatherDesc")) $("weatherDesc").textContent = "Checking…";

  if (!navigator.geolocation) {
    if ($("weatherDesc")) {
      $("weatherDesc").textContent = "Location unavailable";
    }
    return;
  }

  navigator.geolocation.getCurrentPosition(
    async (position) => {
      try {
        const { latitude, longitude } = position.coords;

        const url =
          `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}` +
          "&current=temperature_2m,apparent_temperature,weather_code" +
          "&daily=temperature_2m_max&timezone=auto&forecast_days=2";

        const response = await fetch(url);

        if (!response.ok) {
          throw new Error("Weather request failed");
        }

        const data = await response.json();
        const code = data.current.weather_code;

        const description =
          code === 0 ? "Clear sky" :
          [1, 2, 3].includes(code) ? "Partly cloudy" :
          [45, 48].includes(code) ? "Foggy" :
          [51, 53, 55, 61, 63, 65, 80, 81, 82].includes(code)
            ? "Rain possible" :
          [71, 73, 75, 77, 85, 86].includes(code)
            ? "Snow possible" :
          "Variable conditions";

        if ($("temp")) {
          $("temp").textContent =
            Math.round(data.current.temperature_2m) + "°";
        }

        if ($("weatherDesc")) {
          $("weatherDesc").textContent = description;
        }

        if ($("feels")) {
          $("feels").textContent =
            "Feels like " +
            Math.round(data.current.apparent_temperature) + "°";
        }

        if ($("weatherLocation")) {
          $("weatherLocation").textContent =
            `${latitude.toFixed(1)}°, ${longitude.toFixed(1)}°`;
        }

        if ($("todayHi")) {
          $("todayHi").textContent =
            Math.round(data.daily.temperature_2m_max[0]) + "°";
        }

        if ($("tomHi")) {
          $("tomHi").textContent =
            Math.round(data.daily.temperature_2m_max[1]) + "°";
        }
      } catch (error) {
        if ($("weatherDesc")) {
          $("weatherDesc").textContent = "Weather unavailable";
        }

        toast(error.message);
      }
    },
    () => {
      if ($("weatherDesc")) {
        $("weatherDesc").textContent = "Allow location for weather";
      }

      if ($("weatherLocation")) {
        $("weatherLocation").textContent = "Location permission needed";
      }
    },
    {
      timeout: 9000,
      maximumAge: 600000
    }
  );
}

function openTool(type) {
  const titles = {
    photo: "Photo editor",
    video: "Video tools",
    youtube: "YouTube & music",
    weather: "Weather report"
  };

  const descriptions = {
    photo: "Upload an image, preview it, and try basic visual filters. This is a starter editor.",
    video: "Preview a local video or open an online editor.",
    youtube: "Search YouTube for songs, music, tutorials, or videos.",
    weather: "Weather uses your location only after you grant permission."
  };

  if ($("toolTitle")) {
    $("toolTitle").textContent = titles[type] || "JARVIS tool";
  }

  if ($("toolDescription")) {
    $("toolDescription").textContent =
      descriptions[type] || "Choose a tool action.";
  }

  const body = $("toolBody");
  if (!body) return;

  body.replaceChildren();

  if (type === "photo" || type === "video") {
    const input = document.createElement("input");

    input.type = "file";
    input.accept = type === "photo" ? "image/*" : "video/*";
    input.className = "tool-body-input";
    input.id = "mediaFile";

    const preview = document.createElement(
      type === "photo" ? "img" : "video"
    );

    preview.className = "preview";
    preview.controls = type === "video";
    preview.style.display = "none";
    preview.id = "mediaPreview";

    body.append(input, preview);

    input.addEventListener("change", () => {
      const file = input.files && input.files[0];
      if (!file) return;

      if (state.mediaUrl) {
        URL.revokeObjectURL(state.mediaUrl);
      }

      state.mediaUrl = URL.createObjectURL(file);
      preview.src = state.mediaUrl;
      preview.style.display = "block";

      if (type === "photo") {
        const actions = document.createElement("div");
        actions.className = "tool-actions";

        [
          ["Original", "none"],
          ["Vivid", "saturate(1.6) contrast(1.1)"],
          ["Mono", "grayscale(1)"],
          ["Warm", "sepia(.35) saturate(1.2)"],
          ["Cool", "hue-rotate(18deg) saturate(1.1)"]
        ].forEach(([label, filter]) => {
          const button = document.createElement("button");
          button.textContent = label;
          button.addEventListener("click", () => {
            preview.style.filter = filter;
          });
          actions.append(button);
        });

        const downloadButton = document.createElement("button");
        downloadButton.textContent = "Download preview";
        downloadButton.addEventListener("click", () => {
          downloadFiltered(preview, file.name);
        });

        actions.append(downloadButton);
        body.append(actions);
      } else {
        const button = document.createElement("button");
        button.className = "secondary";
        button.textContent = "Open online video editor";
        button.addEventListener("click", () => {
          safeOpen("https://www.canva.com/video-editor/");
        });
        body.append(button);
      }
    });
  } else if (type === "youtube") {
    const input = document.createElement("input");
    input.placeholder = "Search songs or videos";

    const button = document.createElement("button");
    button.className = "primary";
    button.textContent = "Search YouTube";

    button.addEventListener("click", () => {
      safeOpen(
        "https://www.youtube.com/results?search_query=" +
        encodeURIComponent(input.value.trim() || "music")
      );
    });

    body.append(input, button);
  } else if (type === "weather") {
    const button = document.createElement("button");
    button.className = "primary";
    button.textContent = "Refresh weather";

    button.addEventListener("click", () => {
      refreshWeather();
      closeModals();
    });

    body.append(button);
  } else {
    const button = document.createElement("button");
    button.className = "primary";
    button.textContent = "Ask JARVIS";

    button.addEventListener("click", () => {
      closeModals();
      $("promptInput")?.focus();
    });

    body.append(button);
  }

  $("toolModal")?.classList.remove("hidden");
}

function downloadFiltered(image, filename) {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;

    const context = canvas.getContext("2d");
    context.filter = getComputedStyle(image).filter;
    context.drawImage(image, 0, 0);

    const link = document.createElement("a");
    link.href = canvas.toDataURL("image/png");
    link.download =
      "jarvis-edited-" +
      filename.replace(/\.[^.]+$/, "") +
      ".png";

    link.click();
  } catch (_) {
    toast("Could not export this image. Try a local image file.");
  }
}

function updateClock() {
  if (!$("clock")) return;

  $("clock").textContent = new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit"
  });

  if (!$("clock").dataset.date) {
    $("clock").dataset.date = "1";
  }
}

function bindEvents() {
  $("settingsBtn")?.addEventListener("click", openSettings);
  $("navSettings")?.addEventListener("click", openSettings);
  $("saveSettings")?.addEventListener("click", saveSettings);

  $("toggleKey")?.addEventListener("click", () => {
    const keyInput = $("apiKey");
    if (!keyInput) return;

    keyInput.type =
      keyInput.type === "password" ? "text" : "password";

    $("toggleKey").textContent =
      keyInput.type === "password" ? "Show" : "Hide";
  });

  $("sendBtn")?.addEventListener("click", () => {
    sendPrompt($("promptInput")?.value || "");
  });

  $("promptInput")?.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendPrompt($("promptInput").value);
    }
  });

  $("micBtn")?.addEventListener("click", startVoice);
  $("navMic")?.addEventListener("click", startVoice);
  $("refreshWeather")?.addEventListener("click", refreshWeather);

  $("calendarBtn")?.addEventListener("click", () => {
    const title = window.prompt("Add a schedule item");
    if (!title) return;

    const list = $("scheduleList");
    if (!list) return;

    const item = document.createElement("div");
    item.className = "event";

    const time = document.createElement("time");
    time.textContent = new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit"
    });

    const label = document.createElement("span");
    label.textContent = title;

    const status = document.createElement("small");
    status.textContent = "Added";

    item.append(time, label, status);
    list.append(item);

    toast("Schedule item added on this page");
  });

  document.querySelectorAll("[data-close]").forEach((button) => {
    button.addEventListener("click", closeModals);
  });

  document.querySelectorAll("[data-toolclose]").forEach((button) => {
    button.addEventListener("click", closeModals);
  });

  document.querySelectorAll("[data-command]").forEach((button) => {
    button.addEventListener("click", () => {
      sendPrompt(button.dataset.command);
    });
  });

  document.querySelectorAll("[data-tool]").forEach((button) => {
    button.addEventListener("click", () => {
      openTool(button.dataset.tool);
    });
  });

  document.querySelectorAll("[data-nav]").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll("[data-nav]").forEach((item) => {
        item.classList.remove("active");
      });

      button.classList.add("active");

      if (button.dataset.nav === "chat") {
        $("promptInput")?.focus();
      }

      if (button.dataset.nav === "tools") {
        openTool("photo");
      }
    });
  });
}

function initJarvis() {
  if ($("userName")) $("userName").textContent = state.name;

  setStatus(state.key ? "AI READY" : "OFFLINE MODE", !!state.key);

  bindEvents();
  updateClock();
  setInterval(updateClock, 15000);
  refreshWeather();

  if (!state.key) {
    setTimeout(() => {
      if (!$("settingsModal")?.classList.contains("hidden")) return;
      openSettings();
    }, 700);
  }

  if (
    "serviceWorker" in navigator &&
    location.protocol.startsWith("http")
  ) {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initJarvis, { once: true });
} else {
  initJarvis();
}
