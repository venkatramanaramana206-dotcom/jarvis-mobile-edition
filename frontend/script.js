 
"use strict";

/* =========================================================
   J.A.R.V.I.S. — PERSONAL AI ASSISTANT
   Main JavaScript for frontend/index.html
   ========================================================= */

const JARVIS = {
  version: "1.0.0",
  keys: {
    api: "jarvis_key",
    memory: "jarvis_memory",
    history: "jarvis_conversation_history_v1",
    active: "jarvis_active_conversation_v1",
    theme: "jarvis_theme",
    language: "jarvis_language",
    voice: "jarvis_voice_replies"
  },
  model: "gemini-2.5-flash",
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
    toast("Unable to save data. Check your browser storage.");
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
  item.style.cssText =
    "padding:12px;margin:6px;border:1px solid #36baff;" +
    "border-radius:10px;background:#09172b;color:#e6f5ff;";

  container.appendChild(item);
  setTimeout(() => item.remove(), 3500);
}

function setStatus(message, state = "ready") {
  const status = $("thinking-status");
  if (status) status.textContent = message;

  const systemStatus = $("system-status");
  if (systemStatus) {
    systemStatus.textContent =
      state === "error" ? "SYSTEM ERROR" :
      state === "busy" ? "PROCESSING" : "SYSTEM ONLINE";
  }

  const dot = $("status-dot");
  if (dot) {
    dot.style.background =
      state === "error" ? "#ff6178" :
      state === "busy" ? "#ffce65" : "#22f59b";
  }
}

function setBusy(value) {
  const button = $("send-btn");
  if (button) button.disabled = value;
  if (value) setStatus("J.A.R.V.I.S is thinking...", "busy");
  else setStatus("Ready to assist you.");
}

function makeId() {
  return Date.now().toString(36) +
    Math.random().toString(36).slice(2, 8);
}

/* -------------------- CONVERSATIONS -------------------- */

let conversations = readJSON(JARVIS.keys.history, []);
if (!Array.isArray(conversations)) conversations = [];

conversations = conversations
  .filter(c => c && typeof c.id === "string" && Array.isArray(c.messages))
  .slice(0, JARVIS.maxHistory);

let activeId = safeGet(JARVIS.keys.active, "");
let activeConversation =
  conversations.find(c => c.id === activeId);

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
    button.style.cssText =
      "display:block;width:100%;padding:12px;margin:5px 0;" +
      "text-align:left;border-radius:8px;overflow-wrap:anywhere;";

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
    activeConversation.title = message.text.slice(0, 42);
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

    const content = document.createElement("div");
    content.className = "message-content";
    content.textContent =
      "Hello! I'm JARVIS, your personal AI assistant. How can I help you today?";

    article.appendChild(content);
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
      .toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

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

/* -------------------- GEMINI AI -------------------- */

function getApiKey() {
  return safeGet(JARVIS.keys.api, "").trim();
}

async function askGemini(prompt, imageData = null) {
  const apiKey = getApiKey();

  if (!apiKey) {
    throw new Error(
      "Gemini API key missing. Open Settings and save your API key."
    );
  }

  const contents = [];

  const recentMessages =
    activeConversation.messages.slice(-20);

  recentMessages.forEach(message => {
    if (message.role !== "user" && message.role !== "assistant") return;

    const parts = [{ text: message.text }];

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

  if (imageData && contents.length) {
    const last = contents[contents.length - 1];
    const parsed = parseImageData(imageData);

    if (last.role === "user" && parsed) {
      last.parts.push({
        inline_data: {
          mime_type: parsed.mime,
          data: parsed.data
        }
      });
    }
  }

  const endpoint =
    "https://generativelanguage.googleapis.com/v1beta/models/" +
    encodeURIComponent(JARVIS.model) +
    ":generateContent?key=" + encodeURIComponent(apiKey);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45000);

  let response;

  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        system_instruction: {
          parts: [{
            text:
              "You are J.A.R.V.I.S., a helpful personal AI assistant. " +
              "Be clear, accurate, polite, and concise. " +
              "Reply in Telugu when the user writes Telugu; otherwise " +
              "use the language requested by the user. " +
              "Never claim that you performed an action unless you did."
          }]
        },
        contents,
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 2048
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
    const apiMessage = data?.error?.message;

    if (response.status === 400 || response.status === 403) {
      throw new Error(
        "Gemini request failed. Check your API key, model access, " +
        "and Google AI API settings. " + (apiMessage || "")
      );
    }

    if (response.status === 429) {
      throw new Error("API usage limit reached. Try again later.");
    }

    throw new Error(apiMessage || "AI service returned an error.");
  }

  const answer = (data.candidates?.[0]?.content?.parts || [])
    .map(part => part.text || "")
    .join("\n")
    .trim();

  if (!answer) {
    throw new Error(
      "The AI returned no text. The response may have been blocked."
    );
  }

  return answer;
}

function parseImageData(dataUrl) {
  if (typeof dataUrl !== "string") return null;

  const match = dataUrl.match(
    /^data:(image\/(?:jpeg|png|webp|gif));base64,([A-Za-z0-9+/=]+)$/
  );

  if (!match) return null;

  return { mime: match[1], data: match[2] };
}

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

  const imageForRequest = selectedImage;
  const imageToStore = imageForRequest;

  if (input) input.value = "";

  selectedImage = null;
  updateImagePreview();

  addMessage("user", text || "Please describe this image.", {
    imageData: imageToStore || undefined
  });

  const commandResult = await handleCommand(text);

  if (commandResult.handled) {
    if (commandResult.reply) {
      addMessage("assistant", commandResult.reply);
      speak(commandResult.reply);
    }
    return;
  }

  requestInProgress = true;
  setBusy(true);

  try {
    const reply = await askGemini(text || "Describe the attached image.", imageForRequest);
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

  if (/^(what is the )?time( now)?\??$/.test(lower) ||
      /సమయం ఎంత|ఇప్పుడు టైమ్|టైమ్ ఎంత/.test(lower)) {
    return {
      handled: true,
      reply: "Current device time: " +
        new Date().toLocaleTimeString(
          getLanguage(), { hour: "2-digit", minute: "2-digit" }
        )
    };
  }

  if (/^(what is )?today'?s date\??$/.test(lower) ||
      /ఈ రోజు తేదీ|నేటి తేదీ/.test(lower)) {
    return {
      handled: true,
      reply: new Date().toLocaleDateString(getLanguage(), {
        weekday: "long", year: "numeric", month: "long", day: "numeric"
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
    const factor = /^h/.test(unit) ? 3600 :
      /^m/.test(unit) ? 60 : 1;
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
      if (!geoResponse.ok) throw new Error("Weather lookup failed.");

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
      if (!weatherResponse.ok) throw new Error("Weather service unavailable.");

      const weather = await weatherResponse.json();
      const current = weather.current;

      return {
        handled: true,
        reply: "Weather in " + place.name + ": " +
          current.temperature_2m + "°C, feels like " +
          current.apparent_temperature + "°C, humidity " +
          current.relative_humidity_2m + "%, wind " +
          current.wind_speed_10m + " km/h. " +
          "Conditions code: " + current.weather_code + "."
      };
    } catch (error) {
      return {
        handled: true,
        reply: "Weather lookup failed. Check your internet and try again."
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
      reply: "Opening YouTube search results for " + youtubeMatch[1] + "."
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
    safeGet(JARVIS.keys.language, "en-IN");
}

function stopListening() {
  if (recognition) {
    try { recognition.stop(); } catch {}
  }
  isListening = false;

  const mic = $("mic-btn");
  if (mic) mic.setAttribute("aria-pressed", "false");

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
    setStatus("Ready to assist you.");
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
  const messages = activeConversation.messages;
  const answer = [...messages].reverse()
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
}

function saveSettings() {
  const key = $("api-key-input")?.value.trim();

  if (key) {
    safeSet(JARVIS.keys.api, key);
    toast("API key saved in this browser.");
  } else {
    toast("Enter a Gemini API key first.");
  }
}

function changeTheme() {
  const theme = $("theme-select")?.value || "dark";
  document.documentElement.dataset.theme = theme;
  safeSet(JARVIS.keys.theme, theme);
}

function clearMemory() {
  const confirmed = window.confirm(
    "Clear saved conversations and memory on this device?"
  );

  if (!confirmed) return;

  conversations = [];
  activeConversation = {
    id: makeId(),
    title: "New conversation",
    createdAt: Date.now(),
    messages: []
  };

  activeId = activeConversation.id;

  safeSet(JARVIS.keys.history, JSON.stringify([activeConversation]));
  safeSet(JARVIS.keys.active, activeId);
  safeSet(JARVIS.keys.memory, "[]");

  renderChat();
  renderHistory();
  toast("Local conversation history cleared.");
}

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
      toast(
        "Install is not currently available. Use your browser menu " +
        "and select Install app or Add to Home screen."
      );
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

  bind("cam-btn", "click", () => {
    const input = $("img-input");
    if (input) input.click();
  });

  bind("attach-btn", "click", () => {
    const input = $("img-input");
    if (input) input.click();
  });

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
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
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

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init, { once: true });
} else {
  init();
}
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js")
      .then(() => console.log("J.A.R.V.I.S Service Worker registered"))
      .catch((error) => console.error("Service Worker error:", error));
  });
}
