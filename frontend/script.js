 
"use strict";

/* =========================================================
   J.A.R.V.I.S. — PERSONAL AI ASSISTANT
   PART 1 OF 2 — CORE, API, HISTORY, CHAT
   Compatible with the supplied index.html
   ========================================================= */

const JARVIS = {
  version: "1.2.0",
  keys: {
    api: "jarvis_key",
    memory: "jarvis_memory",
    history: "jarvis_conversation_history_v1",
    active: "jarvis_active_conversation_v1",
    theme: "jarvis_theme",
    language: "jarvis_language",
    voice: "jarvis_voice_replies"
  },
  model: "gemini-3.8-flash",
  maxHistory: 30,
  maxMessages: 120,
  maxMessageLength: 10000
};

const $ = id => document.getElementById(id);

function safeGet(key, fallback = "") {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

function safeSet(key, value) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    toast("Unable to save data. Check browser storage.");
    return false;
  }
}

function readJSON(key, fallback) {
  try {
    const value = safeGet(key, "");
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function toast(message) {
  const container = $("toast-container");

  if (!container) {
    console.log(message);
    return;
  }

  const item = document.createElement("div");
  item.className = "toast-message";
  item.textContent = String(message);
  container.appendChild(item);

  setTimeout(() => item.remove(), 3500);
}

function setStatus(message, state = "ready") {
  if ($("thinking-status")) {
    $("thinking-status").textContent = message;
  }

  if ($("system-status")) {
    $("system-status").textContent =
      state === "error" ? "SYSTEM ERROR" :
      state === "busy" ? "PROCESSING" : "SYSTEM ONLINE";
  }

  if ($("status-dot")) {
    $("status-dot").style.background =
      state === "error" ? "#ff6178" :
      state === "busy" ? "#ffce65" : "#22f59b";
  }
}

function setBusy(value) {
  if ($("send-btn")) $("send-btn").disabled = value;

  setStatus(
    value ? "J.A.R.V.I.S is thinking..." : "Ready to assist you.",
    value ? "busy" : "ready"
  );
}

function makeId() {
  return Date.now().toString(36) +
    Math.random().toString(36).slice(2, 8);
}

/* -------------------- CONVERSATIONS -------------------- */

let conversations = readJSON(JARVIS.keys.history, []);

if (!Array.isArray(conversations)) conversations = [];

conversations = conversations
  .filter(c => c && typeof c.id === "string" &&
    Array.isArray(c.messages))
  .slice(0, JARVIS.maxHistory);

let activeId = safeGet(JARVIS.keys.active, "");
let activeConversation = conversations.find(c => c.id === activeId);

if (!activeConversation) {
  activeConversation = {
    id: makeId(),
    title: "New conversation",
    createdAt: Date.now(),
    messages: []
  };

  conversations.unshift(activeConversation);
  activeId = activeConversation.id;
}

function saveConversations() {
  conversations = conversations
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, JARVIS.maxHistory);

  safeSet(JARVIS.keys.history, JSON.stringify(conversations));
  safeSet(JARVIS.keys.active, activeId);
  renderHistory();
}

function newConversation() {
  activeConversation = {
    id: makeId(),
    title: "New conversation",
    createdAt: Date.now(),
    messages: []
  };

  activeId = activeConversation.id;
  conversations.unshift(activeConversation);

  saveConversations();
  renderChat();
  closePanel("history-panel");
  toast("New conversation created.");
}

function renderHistory() {
  const list = $("history-list");
  if (!list) return;

  list.replaceChildren();

  if (!conversations.length) {
    const empty = document.createElement("p");
    empty.className = "empty-history";
    empty.textContent = "No conversations yet.";
    list.appendChild(empty);
    return;
  }

  conversations.forEach(conversation => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "history-item";
    button.textContent = conversation.title || "Conversation";

    button.addEventListener("click", () => {
      activeId = conversation.id;
      activeConversation = conversation;

      safeSet(JARVIS.keys.active, activeId);
      renderChat();
      closePanel("history-panel");
    });

    list.appendChild(button);
  });
}

function addMessage(role, text, extra = {}) {
  const message = {
    role,
    text: String(text),
    time: Date.now(),
    ...extra
  };

  activeConversation.messages.push(message);
  activeConversation.messages =
    activeConversation.messages.slice(-JARVIS.maxMessages);

  if (
    role === "user" &&
    activeConversation.title === "New conversation"
  ) {
    activeConversation.title =
      message.text.slice(0, 42) || "Image conversation";
  }

  saveConversations();
  renderChat();

  return message;
}

function renderChat() {
  const chat = $("chat");
  if (!chat) return;

  chat.replaceChildren();

  if (!activeConversation.messages.length) {
    const article = document.createElement("article");
    article.className = "message assistant-message";

    const heading = document.createElement("div");
    heading.className = "message-heading";

    const name = document.createElement("strong");
    name.textContent = "JARVIS";

    const time = document.createElement("time");
    time.className = "message-time";
    time.textContent = "Welcome";

    heading.append(name, time);

    const content = document.createElement("div");
    content.className = "message-content";
    content.textContent =
      "Hello! I'm JARVIS, your personal AI assistant. How can I help you today?";

    article.append(heading, content);
    chat.appendChild(article);
    return;
  }

  activeConversation.messages.forEach(message => {
    const article = document.createElement("article");
    article.className =
      "message " +
      (message.role === "user" ? "user-message" : "assistant-message");

    const heading = document.createElement("div");
    heading.className = "message-heading";

    const name = document.createElement("strong");
    name.textContent = message.role === "user" ? "YOU" : "JARVIS";

    const time = document.createElement("time");
    time.className = "message-time";
    time.textContent = new Date(message.time || Date.now())
      .toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit"
      });

    heading.append(name, time);

    const content = document.createElement("div");
    content.className = "message-content";
    content.textContent = message.text;

    article.append(heading, content);

    if (message.imageData) {
      const image = document.createElement("img");
      image.src = message.imageData;
      image.alt = "User attached image";
      image.style.cssText =
        "max-width:100%;max-height:240px;object-fit:contain;";
      article.appendChild(image);
    }

    chat.appendChild(article);
  });

  chat.scrollTop = chat.scrollHeight;
}

/* -------------------- API KEY & GEMINI -------------------- */

function getApiKey() {
  return safeGet(JARVIS.keys.api, "").trim();
}

async function requestGemini(contents, apiKey, maxTokens = 2048) {
  const endpoint =
    "https://generativelanguage.googleapis.com/v1beta/models/" +
    encodeURIComponent(JARVIS.model) +
    ":generateContent";

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45000);

  let response;

  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey
      },
      signal: controller.signal,
      body: JSON.stringify({
        system_instruction: {
          parts: [{
            text:
              "You are J.A.R.V.I.S., a helpful personal AI assistant. " +
              "Be clear, accurate, polite, and concise. " +
              "Reply in Telugu when the user writes Telugu; otherwise " +
              "use the language requested by the user. " +
              "Never claim you performed an action unless you did."
          }]
        },
        contents,
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: maxTokens
        }
      })
    });
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error("AI request timed out. Please try again.");
    }

    throw new Error("Network error. Check your internet connection.");
  } finally {
    clearTimeout(timeout);
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const detail = data?.error?.message || "";

    if (response.status === 400) {
      throw new Error("Gemini rejected the request. " + detail);
    }

    if (response.status === 401 || response.status === 403) {
      throw new Error(
        "API key invalid or access denied. Check your key and API access. " +
        detail
      );
    }

    if (response.status === 404) {
      throw new Error(
        "The configured Gemini model is unavailable. Check the model name " +
        "and the models supported by your API key. " + detail
      );
    }

    if (response.status === 429) {
      throw new Error("API usage limit reached. Check your quota.");
    }

    throw new Error(detail || "Gemini API request failed.");
  }

  const answer = (data.candidates?.[0]?.content?.parts || [])
    .map(part => part.text || "")
    .join("\n")
    .trim();

  if (!answer) {
    throw new Error("Gemini returned no text. The response may be blocked.");
  }

  return answer;
}

async function askGemini(prompt, imageData = null) {
  const apiKey = getApiKey();

  if (!apiKey) {
    openPanel("settings-panel");
    $("api-key-input")?.focus();
    throw new Error("Enter and save your Gemini API key in Settings.");
  }

  const contents = [];

  activeConversation.messages.slice(-20).forEach(message => {
    if (message.role !== "user" && message.role !== "assistant") return;

    const parts = [{ text: message.text || " " }];

    if (message.role === "user" && message.imageData) {
      const parsed = parseImageData(message.imageData);

      if (parsed) {
        parts.push({
          inline_data: {
            mime_type: parsed.mime,
            data: parsed.data
          }
        });
      }
    }

    contents.push({
      role: message.role === "assistant" ? "model" : "user",
      parts
    });
  });

  if (!contents.length) {
    const parts = [{ text: prompt || "Hello" }];
    const parsed = parseImageData(imageData);

    if (parsed) {
      parts.push({
        inline_data: {
          mime_type: parsed.mime,
          data: parsed.data
        }
      });
    }

    contents.push({ role: "user", parts });
  }

  return requestGemini(contents, apiKey);
}

function parseImageData(dataUrl) {
  if (typeof dataUrl !== "string") return null;

  const match = dataUrl.match(
    /^data:(image\/(?:jpeg|png|webp|gif));base64,([A-Za-z0-9+/=]+)$/
  );

  if (!match) return null;

  return { mime: match[1], data: match[2] };
}
/* =========================================================
   PART 2 OF 2 — COMMANDS, VOICE, SETTINGS, INITIALIZATION
   Paste immediately after Part 1.
   ========================================================= */

/* -------------------- SEND MESSAGE -------------------- */

let selectedImage = null;
let requestInProgress = false;

async function sendMessage(textOverride = null) {
  if (requestInProgress) return;

  const input = $("message-input");
  const text = String(
    textOverride !== null ? textOverride : input?.value || ""
  ).trim();

  if (!text && !selectedImage) {
    toast("Type a message or attach an image.");
    return;
  }

  if (text.length > JARVIS.maxMessageLength) {
    toast("Message is too long.");
    return;
  }

  if (!getApiKey()) {
    openPanel("settings-panel");
    $("api-key-input")?.focus();
    toast("Enter your Gemini API key to continue.");
    return;
  }

  const imageForRequest = selectedImage;

  if (input) input.value = "";

  selectedImage = null;
  updateImagePreview();

  addMessage("user", text || "Please describe this image.", {
    imageData: imageForRequest || undefined
  });

  requestInProgress = true;
  setBusy(true);

  try {
    const result = await handleCommand(text);

    if (result.handled) {
      if (result.reply) {
        addMessage("assistant", result.reply);
        speak(result.reply);
      }
      return;
    }

    const reply = await askGemini(
      text || "Describe the attached image.",
      imageForRequest
    );

    addMessage("assistant", reply);
    speak(reply);
  } catch (error) {
    const message = error?.message || "Unexpected AI error.";
    addMessage("assistant", "Sorry, Boss. " + message);
    setStatus("Request failed.", "error");
    toast(message);
  } finally {
    requestInProgress = false;
    setBusy(false);
  }
}

/* -------------------- COMMANDS / TOOLS -------------------- */

async function handleCommand(rawText) {
  const text = String(rawText || "").trim();
  const lower = text.toLowerCase();

  if (!text) return { handled: false };

  if (
    /^(what is the )?time( now)?\??$/.test(lower) ||
    /సమయం ఎంత|ఇప్పుడు టైమ్|టైమ్ ఎంత/.test(lower)
  ) {
    return {
      handled: true,
      reply: "Current device time: " +
        new Date().toLocaleTimeString(getLanguage(), {
          hour: "2-digit",
          minute: "2-digit"
        })
    };
  }

  if (
    /^(what is )?today'?s date\??$/.test(lower) ||
    /ఈ రోజు తేదీ|నేటి తేదీ/.test(lower)
  ) {
    return {
      handled: true,
      reply: new Date().toLocaleDateString(getLanguage(), {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric"
      })
    };
  }

  if (/^(tell me a )?joke\??$/.test(lower) ||
      /జోక్ చెప్పు|ఒక జోక్/.test(lower)) {
    const jokes = [
      "Why did the computer go to the doctor? It had a virus!",
      "Why do programmers prefer dark mode? Because light attracts bugs!",
      "Why did the phone wear glasses? It lost its contacts!"
    ];

    return {
      handled: true,
      reply: jokes[Math.floor(Math.random() * jokes.length)]
    };
  }

  if (/^(flip|toss) a coin$/.test(lower) ||
      /కాయిన్ టాస్|నాణెం వేయి/.test(lower)) {
    return {
      handled: true,
      reply: Math.random() < 0.5 ? "Heads!" : "Tails!"
    };
  }

  if (/^(roll|throw) (a )?dice$/.test(lower) ||
      /డైస్ వేయి|పాచిక వేయి/.test(lower)) {
    return {
      handled: true,
      reply: "You rolled: " + (1 + Math.floor(Math.random() * 6))
    };
  }

  const timerMatch = lower.match(
    /(?:set |start )?timer (?:for )?(\d+)\s*(seconds?|secs?|minutes?|mins?|hours?|hrs?)/
  );

  if (timerMatch) {
    const amount = Number(timerMatch[1]);
    const unit = timerMatch[2];
    const factor = /^h/.test(unit) ? 3600 : /^m/.test(unit) ? 60 : 1;
    const seconds = amount * factor;

    if (!Number.isFinite(seconds) || seconds < 1 || seconds > 86400) {
      return {
        handled: true,
        reply: "Choose a timer between 1 second and 24 hours."
      };
    }

    setTimeout(() => {
      toast("Timer finished!");
      speak("Your timer is finished.");
    }, seconds * 1000);

    return {
      handled: true,
      reply: "Timer started for " + amount + " " + unit + "."
    };
  }

  const weatherMatch = lower.match(
    /^(?:weather|check weather)(?: in)?\s+(.+)$/
  );

  if (weatherMatch) {
    try {
      const city = weatherMatch[1].trim();
      const geoUrl =
        "https://geocoding-api.open-meteo.com/v1/search?name=" +
        encodeURIComponent(city) + "&count=1&language=en&format=json";

      const geoResponse = await fetch(geoUrl);
      if (!geoResponse.ok) throw new Error("Geocoding failed.");

      const geo = await geoResponse.json();
      const place = geo.results?.[0];

      if (!place) {
        return { handled: true, reply: "I couldn't find that city." };
      }

      const weatherUrl =
        "https://api.open-meteo.com/v1/forecast?latitude=" +
        place.latitude + "&longitude=" + place.longitude +
        "&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m";

      const weatherResponse = await fetch(weatherUrl);
      if (!weatherResponse.ok) throw new Error("Weather request failed.");

      const weather = await weatherResponse.json();
      const current = weather.current;

      return {
        handled: true,
        reply: "Weather in " + place.name + ": " +
          current.temperature_2m + "°C, feels like " +
          current.apparent_temperature + "°C, humidity " +
          current.relative_humidity_2m + "%, wind " +
          current.wind_speed_10m + " km/h."
      };
    } catch {
      return {
        handled: true,
        reply: "Weather lookup failed. Check your internet connection."
      };
    }
  }

  const youtubeMatch = text.match(
    /^(?:play|search|open)\s+(?:on\s+)?youtube\s+(.+)$/i
  );

  if (youtubeMatch) {
    const url = "https://www.youtube.com/results?search_query=" +
      encodeURIComponent(youtubeMatch[1]);

    window.open(url, "_blank", "noopener,noreferrer");

    return {
      handled: true,
      reply: "Opening YouTube results for " + youtubeMatch[1] + "."
    };
  }

  const googleMatch = text.match(
    /^(?:search|google)\s+(?:for\s+)?(.+)$/i
  );

  if (googleMatch) {
    window.open(
      "https://www.google.com/search?q=" +
        encodeURIComponent(googleMatch[1]),
      "_blank",
      "noopener,noreferrer"
    );

    return {
      handled: true,
      reply: "Opening Google search results for " + googleMatch[1] + "."
    };
  }

  if (/^(open )?settings$/.test(lower)) {
    openPanel("settings-panel");
    return { handled: true, reply: "Settings opened." };
  }

  if (/^(open )?history$/.test(lower)) {
    openPanel("history-panel");
    return { handled: true, reply: "Conversation history opened." };
  }

  return { handled: false };
}

/* -------------------- SPEECH INPUT -------------------- */

const SpeechRecognitionAPI =
  window.SpeechRecognition || window.webkitSpeechRecognition;

let recognition = null;
let isListening = false;

function getLanguage() {
  return $("language-select")?.value ||
    safeGet(JARVIS.keys.language, "te-IN");
}

function stopListening() {
  if (recognition) {
    try { recognition.stop(); } catch {}
  }

  isListening = false;
  $("mic-btn")?.setAttribute("aria-pressed", "false");
  setStatus("Ready to assist you.");
}

function startListening() {
  if (!SpeechRecognitionAPI) {
    toast("Speech recognition is unavailable in this browser.");
    return;
  }

  if (isListening) {
    stopListening();
    return;
  }

  recognition = new SpeechRecognitionAPI();
  recognition.lang = getLanguage();
  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;

  recognition.onstart = () => {
    isListening = true;
    $("mic-btn")?.setAttribute("aria-pressed", "true");
    setStatus("Listening... Speak now.", "busy");
  };

  recognition.onresult = event => {
    let finalText = "";
    let interimText = "";

    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i];

      if (result.isFinal) finalText += result[0].transcript;
      else interimText += result[0].transcript;
    }

    const input = $("message-input");

    if (input && interimText) input.value = interimText;

    if (finalText.trim()) {
      if (input) input.value = finalText.trim();
      stopListening();
      sendMessage(finalText.trim());
    }
  };

  recognition.onerror = event => {
    isListening = false;
    $("mic-btn")?.setAttribute("aria-pressed", "false");

    const messages = {
      "not-allowed": "Microphone permission denied.",
      "no-speech": "No speech detected. Try again.",
      "network": "Speech recognition network error.",
      "audio-capture": "No microphone found."
    };

    toast(messages[event.error] || "Voice error: " + event.error);
    setStatus("Voice input unavailable.", "error");
  };

  recognition.onend = () => {
    isListening = false;
    $("mic-btn")?.setAttribute("aria-pressed", "false");
  };

  try {
    recognition.start();
  } catch {
    isListening = false;
    toast("Could not start voice recognition. Try again.");
  }
}

/* -------------------- TEXT TO SPEECH -------------------- */

function speak(text) {
  if (!("speechSynthesis" in window)) return;

  if ($("voice-replies-toggle")?.checked === false) return;
  if (safeGet(JARVIS.keys.voice, "true") === "false") return;

  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(String(text).slice(0, 5000));
  utterance.lang = getLanguage();
  utterance.rate = 1;
  utterance.pitch = 1;
  utterance.volume = 1;

  window.speechSynthesis.speak(utterance);
}

function speakLastAnswer() {
  const answer = [...activeConversation.messages]
    .reverse()
    .find(message => message.role === "assistant");

  if (answer) speak(answer.text);
  else toast("No assistant reply to read yet.");
}

/* -------------------- IMAGE UPLOAD -------------------- */

function updateImagePreview() {
  const container = $("image-preview-container");
  const image = $("image-preview");

  if (!container || !image) return;

  if (!selectedImage) {
    container.hidden = true;
    image.removeAttribute("src");
    return;
  }

  image.src = selectedImage;
  container.hidden = false;
}

function loadImage(file) {
  if (!file) return;

  if (!file.type.startsWith("image/")) {
    toast("Please select an image.");
    return;
  }

  if (file.size > 4 * 1024 * 1024) {
    toast("Choose an image smaller than 4 MB.");
    return;
  }

  const reader = new FileReader();

  reader.onload = () => {
    selectedImage = String(reader.result);
    updateImagePreview();
    toast("Image attached. Type a question and send it.");
  };

  reader.onerror = () => toast("Could not read image.");
  reader.readAsDataURL(file);
}

/* -------------------- SETTINGS / PANELS -------------------- */

function openPanel(id) {
  const panel = $(id);
  if (!panel) return;
  panel.hidden = false;
}

function closePanel(id) {
  const panel = $(id);
  if (panel) panel.hidden = true;
}

function initSettings() {
  const keyInput = $("api-key-input");
  if (keyInput) keyInput.value = getApiKey();

  const theme = safeGet(JARVIS.keys.theme, "dark");
  if ($("theme-select")) $("theme-select").value = theme;

  document.documentElement.dataset.theme = theme;

  const language = safeGet(JARVIS.keys.language, "te-IN");
  if ($("language-select")) $("language-select").value = language;

  if ($("voice-replies-toggle")) {
    $("voice-replies-toggle").checked =
      safeGet(JARVIS.keys.voice, "true") !== "false";
  }

  // Use the existing Settings panel; do not create a new design.
  if (!getApiKey()) {
    openPanel("settings-panel");
    if (keyInput) setTimeout(() => keyInput.focus(), 100);
    toast("Enter your Gemini API key to start using JARVIS.");
  }
}

function changeTheme() {
  const theme = $("theme-select")?.value || "dark";
  document.documentElement.dataset.theme = theme;
  safeSet(JARVIS.keys.theme, theme);
}

function clearMemory() {
  if (!window.confirm(
    "Clear saved conversations and memory on this device?"
  )) return;

  conversations = [];

  activeConversation = {
    id: makeId(),
    title: "New conversation",
    createdAt: Date.now(),
    messages: []
  };

  activeId = activeConversation.id;
  conversations.push(activeConversation);

  safeSet(JARVIS.keys.history, JSON.stringify(conversations));
  safeSet(JARVIS.keys.active, activeId);
  safeSet(JARVIS.keys.memory, "[]");

  renderChat();
  renderHistory();
  toast("Local conversation history cleared.");
}

/* -------------------- PWA INSTALL -------------------- */

function setupInstall() {
  let deferredPrompt = null;
  const button = $("install-btn");

  if (!button) return;

  window.addEventListener("beforeinstallprompt", event => {
    event.preventDefault();
    deferredPrompt = event;
    button.hidden = false;
  });

  button.addEventListener("click", async () => {
    if (!deferredPrompt) {
      toast("Use your browser menu to install or add JARVIS to Home screen.");
      return;
    }

    deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;

    if (choice.outcome === "accepted") {
      toast("Installation accepted.");
    }

    deferredPrompt = null;
    button.hidden = true;
  });

  window.addEventListener("appinstalled", () => {
    button.hidden = true;
    toast("JARVIS installed successfully.");
  });
}

/* -------------------- EVENT WIRING -------------------- */

function bind(id, event, handler) {
  const element = $(id);
  if (element) element.addEventListener(event, handler);
}

function init() {
  bind("chat-form", "submit", event => {
    event.preventDefault();
    sendMessage();
  });

  bind("mic-btn", "click", startListening);
  bind("voice-card", "click", startListening);
  bind("nav-voice", "click", startListening);

  bind("cam-btn", "click", () => $("img-input")?.click());
  bind("attach-btn", "click", () => $("img-input")?.click());

  bind("img-input", "change", event => {
    loadImage(event.target.files?.[0]);
    event.target.value = "";
  });

  bind("remove-image-btn", "click", () => {
    selectedImage = null;
    updateImagePreview();
  });

  bind("settings-btn", "click", () => openPanel("settings-panel"));
  bind("nav-settings", "click", () => openPanel("settings-panel"));
  bind("history-btn", "click", () => openPanel("history-panel"));
  bind("nav-history", "click", () => openPanel("history-panel"));

  bind("close-settings-btn", "click", () => closePanel("settings-panel"));
  bind("close-history-btn", "click", () => closePanel("history-panel"));

  bind("save-api-key-btn", "click", saveSettings);
  bind("theme-select", "change", changeTheme);

  bind("language-select", "change", event => {
    safeSet(JARVIS.keys.language, event.target.value);
  });

  bind("voice-replies-toggle", "change", event => {
    safeSet(JARVIS.keys.voice, String(event.target.checked));
  });

  bind("clear-memory-btn", "click", clearMemory);
  bind("new-chat-btn", "click", newConversation);
  bind("read-answer-btn", "click", speakLastAnswer);

  bind("stop-voice-btn", "click", () => {
    stopListening();

    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }

    toast("Voice stopped.");
  });

  const input = $("message-input");

  if (input) {
    input.addEventListener("keydown", event => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        $("chat-form")?.requestSubmit();
      }
    });

    input.addEventListener("input", () => {
      input.style.height = "auto";
      input.style.height = Math.min(input.scrollHeight, 160) + "px";
    });
  }

  initSettings();
  renderChat();
  renderHistory();
  setupInstall();

  setStatus("Ready to assist you.");
  console.log("J.A.R.V.I.S. initialized. Version:", JARVIS.version);
}

/* -------------------- START APPLICATION -------------------- */

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init, { once: true });
} else {
  init();
}
