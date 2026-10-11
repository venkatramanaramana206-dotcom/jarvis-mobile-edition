
"use strict";

/* =========================================
   J.A.R.V.I.S — Complete Main JavaScript
   Chat • Gemini • Settings • Voice • Images
   Weather • Timer • YouTube • History
   ========================================= */

const $ = (id) => document.getElementById(id);

const JARVIS = {
  model: "gemini-2.5-flash",
  models: ["gemini-2.5-flash", "gemini-2.0-flash"],
  keys: {
    api: "jarvis_key",
    memory: "jarvis_memory",
    history: "jarvis_conversation_history_v1",
    active: "jarvis_active_conversation_v1",
    theme: "jarvis_theme",
    language: "jarvis_language",
    voice: "jarvis_voice_replies"
  }
};

let activeConversation = null;
let conversations = [];
let pendingImage = null;
let recognition = null;
let isListening = false;
let isBusy = false;
let timerHandle = null;
let currentUtterance = null;
let eventsBound = false;

/* ---------- STORAGE ---------- */

function safeGet(key, fallback = null) {
  try {
    const value = localStorage.getItem(key);
    return value === null ? fallback : value;
  } catch (error) {
    console.error("Storage read error:", error);
    return fallback;
  }
}

function safeSet(key, value) {
  try {
    localStorage.setItem(key, String(value));
    return localStorage.getItem(key) === String(value);
  } catch (error) {
    console.error("Storage write error:", error);
    return false;
  }
}

function safeJSON(key, fallback) {
  try {
    return JSON.parse(safeGet(key, JSON.stringify(fallback)));
  } catch {
    return fallback;
  }
}

/* ---------- NOTIFICATIONS / STATUS ---------- */

function toast(message) {
  console.log("[JARVIS]", message);

  let el = $("jarvis-toast");

  if (!el) {
    el = document.createElement("div");
    el.id = "jarvis-toast";

    Object.assign(el.style, {
      position: "fixed",
      bottom: "22px",
      left: "50%",
      transform: "translateX(-50%)",
      zIndex: "999999",
      maxWidth: "90%",
      padding: "12px 18px",
      borderRadius: "10px",
      background: "#151a24",
      color: "#fff",
      border: "1px solid #79c9ff",
      boxShadow: "0 0 18px #79c9ff33",
      fontSize: "14px",
      textAlign: "center"
    });

    document.body.appendChild(el);
  }

  el.textContent = message;
  el.style.display = "block";

  clearTimeout(el._hideTimer);
  el._hideTimer = setTimeout(() => {
    el.style.display = "none";
  }, 4500);
}

function setStatus(message, type = "ready") {
  const status = $("system-status");
  const dot = $("status-dot");
  const thinking = $("thinking-status");

  if (status) status.textContent = message;

  if (dot) {
    dot.style.background =
      type === "error" ? "#ff5252" :
      type === "busy" ? "#ffc857" : "#54e39b";
  }

  if (thinking) {
    thinking.textContent = type === "busy" ? message : "";
  }
}

function setBusy(value) {
  isBusy = value;

  const button = $("send-btn");
  if (button) button.disabled = value;

  setStatus(
    value ? "J.A.R.V.I.S is thinking..." : "Ready to assist you.",
    value ? "busy" : "ready"
  );
}

/* ---------- API KEY ---------- */

function getApiKey() {
  return safeGet(JARVIS.keys.api, "") || "";
}

function loadApiKey() {
  const input = $("api-key-input");
  const key = getApiKey();

  if (input) input.value = key;
  return key;
}

/* ---------- GEMINI API ---------- */

async function requestGemini(contents, apiKey, maxOutputTokens = 1024) {
  if (!apiKey) {
    throw new Error("Enter your Gemini API key in Settings.");
  }

  let lastError = null;

  for (const model of JARVIS.models) {
    let response;

    try {
      response = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/models/" +
          encodeURIComponent(model) +
          ":generateContent",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey
          },
          body: JSON.stringify({
            systemInstruction: {
              parts: [{
                text:
                  "You are J.A.R.V.I.S, a helpful personal AI assistant. " +
                  "Reply clearly and politely. If the user writes Telugu, " +
                  "respond in Telugu unless asked otherwise."
              }]
            },
            contents,
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens
            }
          })
        }
      );
    } catch (error) {
      throw new Error(
        "Network request failed. Check internet and reload the page."
      );
    }

    let data = {};
    try {
      data = await response.json();
    } catch {
      throw new Error("Gemini returned an unreadable response.");
    }

    if (!response.ok) {
      const detail = data?.error?.message || `HTTP ${response.status}`;
      lastError = new Error(detail);

      if (
        response.status === 404 ||
        (response.status === 400 &&
          /model|not found|not supported/i.test(detail))
      ) {
        continue;
      }

      if (response.status === 401 || response.status === 403) {
        throw new Error(
          "Gemini rejected the API key or its permissions. Check the key and API access."
        );
      }

      if (response.status === 429) {
        throw new Error(
          "Gemini request limit reached. Wait a little and try again."
        );
      }

      throw new Error(detail);
    }

    const answer = data?.candidates?.[0]?.content?.parts
      ?.map(part => part.text || "")
      .join("")
      .trim();

    if (!answer) {
      throw new Error(
        data?.promptFeedback?.blockReason
          ? "Request blocked: " + data.promptFeedback.blockReason
          : "Gemini returned an empty answer."
      );
    }

    JARVIS.model = model;
    return answer;
  }

  throw new Error(
    "No configured Gemini model worked. Check the available model names and API access. " +
    (lastError?.message || "")
  );
}

/* Save the key independently of the connection test. */
async function saveSettings() {
  const input = $("api-key-input");
  const button = $("save-api-key-btn");

  if (!input) {
    toast("API Key input not found. Check the HTML ID api-key-input.");
    return;
  }

  const key = input.value.trim();

  if (!key) {
    toast("Please enter your Gemini API Key.");
    input.focus();
    return;
  }

  if (/\s/.test(key)) {
    toast("The API Key contains spaces. Please check it.");
    input.focus();
    return;
  }

  const oldText = button?.textContent || "Save API Key";

  if (button) {
    button.disabled = true;
    button.textContent = "Saving...";
  }

  try {
    if (!safeSet(JARVIS.keys.api, key) || getApiKey() !== key) {
      throw new Error("The browser could not save the API Key.");
    }

    toast("API Key saved. Testing Gemini connection...");

    try {
      await requestGemini(
        [{ role: "user", parts: [{ text: "Reply with OK." }] }],
        key,
        32
      );

      setStatus("Connected to Gemini.");
      toast("API Key saved and Gemini connected!");

      const prompt = $("api-key-prompt");
      if (prompt) prompt.style.display = "none";

      closePanel("settings-panel");
    } catch (apiError) {
      console.error("Gemini test failed:", apiError);

      setStatus("API Key saved; connection failed.", "error");
      toast("Key saved, but Gemini test failed: " + apiError.message);
    }
  } catch (error) {
    console.error("API Key save failed:", error);
    toast(error.message);
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = oldText;
    }
  }
}

/* ---------- SETTINGS / THEME ---------- */

function applyTheme(theme) {
  const validTheme = theme === "light" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", validTheme);
  safeSet(JARVIS.keys.theme, validTheme);
}

function initSettings() {
  loadApiKey();

  const theme = safeGet(JARVIS.keys.theme, "dark");
  const themeSelect = $("theme-select");

  if (themeSelect) themeSelect.value = theme;
  applyTheme(theme);

  const language = safeGet(JARVIS.keys.language, "en-US");
  const languageSelect = $("language-select");

  if (languageSelect) languageSelect.value = language;

  const voiceToggle = $("voice-replies-toggle");
  if (voiceToggle) {
    voiceToggle.checked = safeGet(JARVIS.keys.voice, "true") !== "false";
  }

  if (!getApiKey()) {
    const panel = $("settings-panel");
    if (panel) {
      panel.hidden = false;
      panel.classList.add("active", "open");
    }
    $("api-key-input")?.focus();
  }
}

function closePanel(id) {
  const panel = $(id);
  if (!panel) return;

  panel.classList.remove("active", "open");

  // Remove hidden only if your CSS uses classes to control panel visibility.
  if (panel.hasAttribute("hidden")) panel.hidden = true;
}

/* ---------- CONVERSATION HISTORY ---------- */

function saveConversations() {
  safeSet(JARVIS.keys.history, JSON.stringify(conversations));

  if (activeConversation) {
    safeSet(JARVIS.keys.active, activeConversation.id);
  }
}

function newConversation() {
  activeConversation = {
    id: String(Date.now()) + Math.random().toString(36).slice(2, 7),
    title: "New conversation",
    messages: [],
    updatedAt: Date.now()
  };

  conversations.unshift(activeConversation);
  conversations = conversations.slice(0, 30);

  saveConversations();
  renderChat();
  renderHistory();
}

function loadConversations() {
  const stored = safeJSON(JARVIS.keys.history, []);
  conversations = Array.isArray(stored) ? stored : [];

  // Repair malformed stored conversations.
  conversations = conversations.filter(
    c => c && typeof c.id === "string" && Array.isArray(c.messages)
  );

  const activeId = safeGet(JARVIS.keys.active, "");

  activeConversation =
    conversations.find(c => c.id === activeId) ||
    conversations[0] ||
    null;

  if (!activeConversation) {
    activeConversation = {
      id: String(Date.now()),
      title: "New conversation",
      messages: [],
      updatedAt: Date.now()
    };
    conversations = [activeConversation];
  }

  saveConversations();
  renderChat();
  renderHistory();
}

function addMessage(role, text, image = null) {
  if (!activeConversation) newConversation();

  const message = {
    role,
    text: String(text || ""),
    timestamp: Date.now()
  };

  if (image) message.image = image;

  activeConversation.messages.push(message);
  activeConversation.updatedAt = Date.now();

  if (
    activeConversation.title === "New conversation" &&
    role === "user"
  ) {
    activeConversation.title =
      String(text || "Image conversation").slice(0, 42);
  }

  saveConversations();
  renderChat();

  return message;
}

function renderChat() {
  const chat = $("chat");
  if (!chat) return;

  chat.replaceChildren();

  for (const message of activeConversation?.messages || []) {
    const wrapper = document.createElement("div");
    wrapper.className =
      "message " +
      (message.role === "user" ? "user-message" : "assistant-message");

    const content = document.createElement("div");
    content.className = "message-content";
    content.textContent = message.text || "";
    wrapper.appendChild(content);

    if (message.image) {
      const image = document.createElement("img");
      image.src = message.image;
      image.alt = "Uploaded image";
      image.style.maxWidth = "100%";
      image.style.maxHeight = "260px";
      image.style.borderRadius = "12px";
      wrapper.appendChild(image);
    }

    chat.appendChild(wrapper);
  }

  chat.scrollTop = chat.scrollHeight;
}

function renderHistory() {
  const list = $("history-list");
  if (!list) return;

  list.replaceChildren();

  for (const conversation of conversations) {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "history-item";
    item.textContent = conversation.title || "Conversation";

    item.addEventListener("click", () => {
      activeConversation = conversation;
      saveConversations();
      renderChat();
      closePanel("history-panel");
    });

    list.appendChild(item);
  }
}

function clearMemory() {
  if (!confirm("Clear saved conversation history and memory?")) return;

  conversations = [];
  activeConversation = null;

  try {
    localStorage.removeItem(JARVIS.keys.history);
    localStorage.removeItem(JARVIS.keys.active);
    localStorage.removeItem(JARVIS.keys.memory);
  } catch (error) {
    console.error("Clear memory error:", error);
  }

  newConversation();
  toast("Conversation history cleared.");
}

/* ---------- IMAGE SUPPORT ---------- */

function imageToGeminiPart(dataUrl) {
  const match = dataUrl.match(
    /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/
  );

  if (!match) throw new Error("Unsupported image format.");

  return {
    inlineData: {
      mimeType: match[1],
      data: match[2]
    }
  };
}

function showImagePreview(dataUrl) {
  pendingImage = dataUrl;

  const image = $("image-preview");
  const container = $("image-preview-container");

  if (image) image.src = dataUrl;
  if (container) container.style.display = "block";
}

function handleImageFile(file) {
  if (!file) return;

  if (!file.type.startsWith("image/")) {
    toast("Please select an image file.");
    return;
  }

  if (file.size > 8 * 1024 * 1024) {
    toast("Image is too large. Choose an image under 8 MB.");
    return;
  }

  const reader = new FileReader();

  reader.onload = () => showImagePreview(String(reader.result));
  reader.onerror = () => toast("Could not read the selected image.");

  reader.readAsDataURL(file);
}

function openCamera() {
  const input = $("img-input");

  if (!input) {
    toast("Image upload input was not found.");
    return;
  }

  input.accept = "image/*";
  input.setAttribute("capture", "environment");
  input.click();
}

/* ---------- CHAT / GEMINI ---------- */

async function askGemini(userText, imageData = null) {
  const key = getApiKey();

  if (!key) {
    toast("Enter and save your Gemini API Key in Settings.");
    const panel = $("settings-panel");
    if (panel) {
      panel.hidden = false;
      panel.classList.add("active", "open");
    }
    return null;
  }

  const history = (activeConversation?.messages || [])
    .slice(-20)
    .filter(m => m.role === "user" || m.role === "assistant")
    .map(m => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: m.text ? [{ text: m.text }] : []
    }))
    .filter(m => m.parts.length > 0);

  const currentParts = [];

  if (userText) currentParts.push({ text: userText });
  if (imageData) currentParts.push(imageToGeminiPart(imageData));

  if (!currentParts.length) {
    currentParts.push({ text: "Please describe this image." });
  }

  // The latest user message was saved before this request.
  // Replace its text-only entry with the image parts when needed.
  if (imageData && history.length) {
    const last = history[history.length - 1];

    if (last.role === "user" && last.parts[0]?.text === userText) {
      history.pop();
    }
  }

  history.push({ role: "user", parts: currentParts });

  return requestGemini(history, key);
}

async function sendMessage() {
  if (isBusy) return;

  const input = $("message-input");
  const text = input ? input.value.trim() : "";

  if (!text && !pendingImage) return;

  const image = pendingImage;
  if (input) input.value = "";

  pendingImage = null;

  const preview = $("image-preview-container");
  if (preview) preview.style.display = "none";

  addMessage("user", text || "Please analyze this image.", image);

  try {
    if (await handleCommand(text)) return;
  } catch (error) {
    console.error("Command error:", error);
    addMessage("assistant", "Command failed: " + error.message);
    return;
  }

  setBusy(true);

  try {
    const answer = await askGemini(
      text || "Please analyze this image.",
      image
    );

    if (answer) {
      addMessage("assistant", answer);
      speak(answer);
    }
  } catch (error) {
    console.error("Gemini error:", error);
    addMessage(
      "assistant",
      "Sorry, I couldn't complete that request. " + error.message
    );
    toast(error.message || "Request failed.");
  } finally {
    setBusy(false);
  }
}

/* ---------- LOCAL COMMANDS ---------- */

async function handleCommand(rawText) {
  const text = String(rawText || "").trim().toLowerCase();
  if (!text) return false;

  if (/^(hi|hello|hey jarvis|హాయ్|హలో)$/.test(text)) {
    addMessage("assistant", "Hello! I am J.A.R.V.I.S. How can I help you?");
    return true;
  }

  if (/\b(time|current time|what time)\b/.test(text) ||
      /సమయం ఎంత/.test(text)) {
    addMessage(
      "assistant",
      "Current time: " +
      new Intl.DateTimeFormat("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        timeZone: "Asia/Kolkata"
      }).format(new Date()) + " (India)"
    );
    return true;
  }

  if (/\b(today's date|what date|current date)\b/.test(text) ||
      /ఈరోజు తేదీ/.test(text)) {
    addMessage(
      "assistant",
      "Today's date: " +
      new Intl.DateTimeFormat("en-IN", {
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "Asia/Kolkata"
      }).format(new Date())
    );
    return true;
  }

  if (/\b(joke|tell me a joke)\b/.test(text) || /జోక్/.test(text)) {
    const jokes = [
      "Why did the computer go to the doctor? It had a virus!",
      "Why was the math book sad? It had too many problems.",
      "Why do programmers prefer dark mode? Because light attracts bugs!"
    ];

    addMessage("assistant", jokes[Math.floor(Math.random() * jokes.length)]);
    return true;
  }

  if (/\b(flip a coin|coin toss|toss a coin)\b/.test(text) ||
      /కాయిన్ టాస్/.test(text)) {
    addMessage("assistant", Math.random() < 0.5 ? "Heads!" : "Tails!");
    return true;
  }

  if (/\b(roll a dice|roll dice|dice roll)\b/.test(text) ||
      /డైస్ వేయి/.test(text)) {
    addMessage("assistant", "You rolled: " + (1 + Math.floor(Math.random() * 6)));
    return true;
  }

  const timerMatch = text.match(
    /(?:set\s+)?timer(?:\s+for)?\s+(\d+)\s*(seconds?|secs?|minutes?|mins?|hours?|hrs?)/
  );

  if (timerMatch) {
    const amount = Number(timerMatch[1]);
    const unit = timerMatch[2];

    const multiplier =
      unit.startsWith("hour") || unit.startsWith("hr") ? 3600000 :
      unit.startsWith("min") ? 60000 : 1000;

    if (timerHandle) clearTimeout(timerHandle);

    addMessage("assistant", `Timer set for ${amount} ${unit}.`);

    timerHandle = setTimeout(() => {
      toast("Timer complete!");
      addMessage("assistant", "Your timer is complete!");
      speak("Your timer is complete.");
      timerHandle = null;
    }, amount * multiplier);

    return true;
  }

  if (/\b(open\s+)?youtube\b/.test(text) ||
      /\b(play|search)\b.*\b(song|music|youtube)\b/.test(text)) {
    const query = text
      .replace(/\b(open|play|search|on|youtube|song|music)\b/g, "")
      .trim();

    const url = query
      ? "https://www.youtube.com/results?search_query=" + encodeURIComponent(query)
      : "https://www.youtube.com/";

    window.open(url, "_blank", "noopener,noreferrer");
    addMessage("assistant", "Opening YouTube" + (query ? " search for: " + query : "") + ".");
    return true;
  }

  if (/^(open|search|google)\b/.test(text)) {
    const query = text.replace(/^(open|search|google)\s*/i, "").trim();

    if (query) {
      window.open(
        "https://www.google.com/search?q=" + encodeURIComponent(query),
        "_blank",
        "noopener,noreferrer"
      );

      addMessage("assistant", "Searching Google for: " + query);
      return true;
    }
  }

  if (/\b(weather|temperature)\b/.test(text) || /వాతావరణం/.test(text)) {
    const placeMatch = rawText.match(
      /(?:weather|temperature|వాతావరణం)(?:\s+(?:in|at|for))?\s+(.+)/i
    );

    const place = placeMatch?.[1]?.trim();

    if (!place) {
      addMessage("assistant", "Please specify a city, for example: weather in Tirupati.");
      return true;
    }

    try {
      const geoResponse = await fetch(
        "https://geocoding-api.open-meteo.com/v1/search?name=" +
        encodeURIComponent(place) + "&count=1&language=en&format=json"
      );

      if (!geoResponse.ok) throw new Error("Weather location lookup failed.");

      const geo = await geoResponse.json();
      const location = geo.results?.[0];

      if (!location) {
        addMessage("assistant", "I couldn't find that city. Check its spelling.");
        return true;
      }

      const weatherResponse = await fetch(
        "https://api.open-meteo.com/v1/forecast?latitude=" +
        location.latitude + "&longitude=" + location.longitude +
        "&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m"
      );

      if (!weatherResponse.ok) throw new Error("Weather service unavailable.");

      const weather = (await weatherResponse.json()).current;

      addMessage(
        "assistant",
        `Weather in ${location.name}: ${weather.temperature_2m}°C, ` +
        `feels like ${weather.apparent_temperature}°C. ` +
        `Humidity: ${weather.relative_humidity_2m}%. ` +
        `Wind: ${weather.wind_speed_10m} km/h.`
      );
    } catch (error) {
      addMessage("assistant", "Unable to get weather: " + error.message);
    }

    return true;
  }

  if (/\b(settings|open settings)\b/.test(text) || /సెట్టింగ్స్/.test(text)) {
    const panel = $("settings-panel");
    if (panel) {
      panel.hidden = false;
      panel.classList.add("active", "open");
    }

    addMessage("assistant", "Settings opened.");
    return true;
  }

  if (/\b(new chat|new conversation)\b/.test(text)) {
    newConversation();
    addMessage("assistant", "Started a new conversation.");
    return true;
  }

  return false;
}

/* ---------- VOICE INPUT ---------- */

function startVoiceInput() {
  const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    toast("Voice input is not supported by this browser.");
    return;
  }

  if (isListening && recognition) {
    recognition.stop();
    return;
  }

  recognition = new SpeechRecognition();
  recognition.lang = $("language-select")?.value || "en-IN";
  recognition.interimResults = false;
  recognition.continuous = false;

  recognition.onstart = () => {
    isListening = true;
    toast("Listening...");
  };

  recognition.onresult = (event) => {
    const transcript = event.results?.[0]?.[0]?.transcript || "";
    const input = $("message-input");

    if (input) {
      input.value = transcript;
      sendMessage();
    }
  };

  recognition.onerror = (event) => {
    toast("Voice input error: " + (event.error || "unknown error"));
  };

  recognition.onend = () => {
    isListening = false;
  };

  try {
    recognition.start();
  } catch (error) {
    toast("Could not start voice input: " + error.message);
  }
}

function speak(text) {
  if (safeGet(JARVIS.keys.voice, "true") === "false") return;
  if (!("speechSynthesis" in window)) return;

  window.speechSynthesis.cancel();

  currentUtterance = new SpeechSynthesisUtterance(String(text || ""));
  currentUtterance.lang = $("language-select")?.value || "en-IN";
  currentUtterance.rate = 1;
  currentUtterance.pitch = 1;

  window.speechSynthesis.speak(currentUtterance);
}

function stopVoice() {
  if ("speechSynthesis" in window) window.speechSynthesis.cancel();

  if (recognition && isListening) recognition.stop();
}

/* ---------- EVENT BINDINGS ---------- */

function bindEvents() {
  if (eventsBound) return;
  eventsBound = true;

  $("save-api-key-btn")?.addEventListener("click", saveSettings);

  $("chat-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    sendMessage();
  });

  $("send-btn")?.addEventListener("click", (event) => {
    if ($("chat-form")) return;
    event.preventDefault();
    sendMessage();
  });

  $("message-input")?.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  });

  $("mic-btn")?.addEventListener("click", startVoiceInput);
  $("nav-voice")?.addEventListener("click", startVoiceInput);
  $("stop-voice-btn")?.addEventListener("click", stopVoice);

  $("read-answer-btn")?.addEventListener("click", () => {
    const last = [...(activeConversation?.messages || [])]
      .reverse()
      .find(m => m.role === "assistant");

    if (last) speak(last.text);
    else toast("There is no answer to read yet.");
  });

  $("cam-btn")?.addEventListener("click", openCamera);

  $("img-input")?.addEventListener("change", (event) => {
    handleImageFile(event.target.files?.[0]);
    event.target.value = "";
  });

  $("image-preview-container")?.addEventListener("click", (event) => {
    if (event.target.closest("[data-remove-image]")) {
      pendingImage = null;
      const container = $("image-preview-container");
      if (container) container.style.display = "none";
    }
  });

  $("clear-memory-btn")?.addEventListener("click", clearMemory);
  $("new-chat-btn")?.addEventListener("click", newConversation);

  $("theme-select")?.addEventListener("change", (event) => {
    applyTheme(event.target.value);
  });

  $("language-select")?.addEventListener("change", (event) => {
    safeSet(JARVIS.keys.language, event.target.value);
  });

  $("voice-replies-toggle")?.addEventListener("change", (event) => {
    safeSet(JARVIS.keys.voice, String(event.target.checked));
    if (!event.target.checked) stopVoice();
  });

  $("settings-panel")?.querySelectorAll("[data-close-panel]")
    .forEach(button => {
      button.addEventListener("click", () => closePanel("settings-panel"));
    });

  $("install-btn")?.addEventListener("click", async () => {
    if (window.deferredPrompt) {
      window.deferredPrompt.prompt();
      await window.deferredPrompt.userChoice;
      window.deferredPrompt = null;
    } else {
      toast("Install is available when browser install requirements are met.");
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closePanel("settings-panel");
      closePanel("history-panel");
    }
  });
}

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  window.deferredPrompt = event;
});

/* ---------- INITIALIZATION ---------- */

function initJarvis() {
  initSettings();
  loadConversations();
  bindEvents();

  setStatus("Ready to assist you.");

  if (!getApiKey()) {
    const panel = $("settings-panel");
    if (panel) {
      panel.hidden = false;
      panel.classList.add("active", "open");
    }
  }

  console.log("J.A.R.V.I.S initialized.");
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initJarvis, { once: true });
} else {
  initJarvis();
}
