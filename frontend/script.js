
/* ============================================
   J.A.R.V.I.S. PERSONAL AI ASSISTANT
   File: frontend/script.js
   Works with the updated index.html and CSS
   ============================================ */

"use strict";

/* ---------- ELEMENTS ---------- */

const $ = (id) => document.getElementById(id);

const statusEl = $("status");
const messagesEl = $("messages");
const chatForm = $("chat-form");
const promptInput = $("prompt");
const micButton = $("mic-button");
const micLabel = $("mic-label");
const settingsButton = $("settings-button");
const settingsDialog = $("settings-dialog");
const settingsForm = $("settings-form");
const apiKeyInput = $("api-key");
const apiUrlInput = $("api-url");
const modelInput = $("model");
const aiStatus = $("ai-status");

const STORAGE = {
  settings: "jarvis_settings_v2",
  history: "jarvis_history_v2"
};

const WELCOME_MESSAGE =
  "Hello! I'm JARVIS, your personal AI assistant. How can I help you today?";

let isListening = false;
let isSending = false;
let recognition = null;
let conversation = [];
let settings = loadSettings();

/* ---------- STORAGE ---------- */

function loadSettings() {
  try {
    const saved = localStorage.getItem(STORAGE.settings);
    const parsed = saved ? JSON.parse(saved) : {};

    return {
      apiKey: typeof parsed.apiKey === "string" ? parsed.apiKey : "",
      apiUrl: typeof parsed.apiUrl === "string" && parsed.apiUrl
        ? parsed.apiUrl
        : "https://api.openai.com/v1/chat/completions",
      model: typeof parsed.model === "string" && parsed.model
        ? parsed.model
        : "gpt-4o-mini"
    };
  } catch (error) {
    console.warn("Could not load JARVIS settings:", error);
    return {
      apiKey: "",
      apiUrl: "https://api.openai.com/v1/chat/completions",
      model: "gpt-4o-mini"
    };
  }
}

function saveSettings() {
  try {
    localStorage.setItem(STORAGE.settings, JSON.stringify(settings));
    return true;
  } catch (error) {
    console.error("Could not save settings:", error);
    setStatus("SETTINGS NOT SAVED");
    return false;
  }
}

function loadHistory() {
  try {
    const saved = JSON.parse(
      localStorage.getItem(STORAGE.history) || "[]"
    );

    if (!Array.isArray(saved)) return [];

    return saved
      .filter((item) =>
        item &&
        (item.role === "user" || item.role === "assistant") &&
        typeof item.content === "string"
      )
      .slice(-40);
  } catch {
    return [];
  }
}

function saveHistory() {
  try {
    localStorage.setItem(
      STORAGE.history,
      JSON.stringify(conversation.slice(-40))
    );
  } catch (error) {
    console.warn("Could not save conversation:", error);
  }
}

/* ---------- STATUS ---------- */

function setStatus(message) {
  if (statusEl) statusEl.textContent = message;
}

function updateAIStatus() {
  if (aiStatus) {
    aiStatus.textContent = settings.apiKey
      ? "API key configured"
      : "Open Settings to connect";
  }
}

/* ---------- SAFE CHAT DISPLAY ---------- */

function addMessage(role, content, options = {}) {
  if (!messagesEl) return;

  const message = document.createElement("div");
  message.className = `message ${role}`;

  const label = document.createElement("span");
  label.className = "message-label";
  label.textContent = role === "user" ? "YOU" : "JARVIS";

  const text = document.createElement("div");
  text.textContent = String(content);

  message.appendChild(label);
  message.appendChild(text);
  messagesEl.appendChild(message);

  if (!options.noSave) {
    conversation.push({
      role,
      content: String(content)
    });

    conversation = conversation.slice(-40);
    saveHistory();
  }

  messagesEl.scrollTop = messagesEl.scrollHeight;
  return message;
}

function renderHistory() {
  if (!messagesEl) return;

  messagesEl.replaceChildren();

  if (conversation.length === 0) {
    addMessage("assistant", WELCOME_MESSAGE);
    return;
  }

  conversation.forEach((item) => {
    addMessage(item.role, item.content, { noSave: true });
  });

  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function clearConversation() {
  conversation = [];
  saveHistory();

  if (messagesEl) messagesEl.replaceChildren();

  addMessage("assistant", WELCOME_MESSAGE);
  setStatus("SYSTEM ONLINE");
}

/* ---------- LOCAL COMMANDS ---------- */

function getLocalAnswer(input) {
  const text = input.toLowerCase().trim();

  if (
    /^(hi|hello|hey|hai|హాయ్|నమస్కారం|வணக்கம்)\b/i.test(text) ||
    /^(hi|hello|hey)[!. ]*$/.test(text)
  ) {
    return "Hello! I am JARVIS. How may I assist you today?";
  }

  if (
    text.includes("what can you do") ||
    text.includes("capabilities") ||
    text.includes("నీ పనులు") ||
    text.includes("என்ன செய்ய")
  ) {
    return "I can chat with you, use supported voice input, speak replies, and connect to a configured AI API. Open Settings to configure your API endpoint, key, and model.";
  }

  if (
    text.includes("your name") ||
    text.includes("who are you") ||
    text.includes("నీ పేరేంటి") ||
    text.includes("உன் பெயர்")
  ) {
    return "I am JARVIS, your personal AI assistant interface.";
  }

  if (
    text.includes("time") ||
    text.includes("సమయం") ||
    text.includes("நேரம்")
  ) {
    return "Your device's current time is " +
      new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit"
      }) + ".";
  }

  if (
    text.includes("date") ||
    text.includes("today") ||
    text.includes("తేదీ") ||
    text.includes("இன்று")
  ) {
    return "Today's date is " +
      new Date().toLocaleDateString([], {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric"
      }) + ".";
  }

  if (
    text.includes("inspire") ||
    text.includes("motivate") ||
    text.includes("ప్రేరణ") ||
    text.includes("ஊக்கம்")
  ) {
    const quotes = [
      "Great things begin with one small step. Keep moving forward.",
      "Your future is built by what you do today. Start now.",
      "Stay curious, keep learning, and never stop improving."
    ];

    return quotes[Math.floor(Math.random() * quotes.length)];
  }

  return null;
}

/* ---------- AI API ---------- */

async function requestAI(userText) {
  if (!settings.apiKey) {
    const message =
      "AI API key is not configured yet. Open Settings, enter your API key, endpoint, and model, then save. You can still use the local time, date, and help commands.";

    addMessage("assistant", message);
    setStatus("API KEY REQUIRED");
    return;
  }

  let endpoint;

  try {
    endpoint = new URL(settings.apiUrl);
  } catch {
    addMessage(
      "assistant",
      "The API endpoint is invalid. Open Settings and enter a valid HTTPS API URL."
    );
    setStatus("INVALID API URL");
    return;
  }

  if (endpoint.protocol !== "https:" && endpoint.hostname !== "localhost") {
    addMessage(
      "assistant",
      "For security, use an HTTPS API endpoint."
    );
    setStatus("SECURE URL REQUIRED");
    return;
  }

  setStatus("THINKING...");
  isSending = true;
  updateSendButton();

  try {
    const response = await fetch(endpoint.href, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${settings.apiKey}`
      },
      body: JSON.stringify({
        model: settings.model,
        messages: [
          {
            role: "system",
            content:
              "You are JARVIS, a helpful personal AI assistant. " +
              "Be clear, accurate, respectful, and concise. " +
              "Respond in the same language as the user when possible."
          },
          ...conversation
            .filter((item) =>
              item.role === "user" || item.role === "assistant"
            )
            .slice(-20)
            .map((item) => ({
              role: item.role,
              content: item.content
            }))
        ],
        temperature: 0.7
      })
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      const detail =
        result?.error?.message ||
        result?.message ||
        `HTTP ${response.status}`;

      throw new Error(detail);
    }

    const answer = result?.choices?.[0]?.message?.content;

    if (typeof answer !== "string" || !answer.trim()) {
      throw new Error("The API returned no text response.");
    }

    addMessage("assistant", answer.trim());
    setStatus("SYSTEM ONLINE");
    speakReply(answer.trim());

  } catch (error) {
    console.error("JARVIS API error:", error);

    addMessage(
      "assistant",
      "I couldn't connect to the AI service. Check your internet connection, API key, model name, and endpoint. If the browser reports a CORS error, the API provider may require a server-side proxy. Details: " +
      (error.message || "Unknown error")
    );

    setStatus("CONNECTION ERROR");
  } finally {
    isSending = false;
    updateSendButton();
  }
}

/* ---------- CHAT SUBMISSION ---------- */

async function sendMessage(rawText) {
  const text = String(rawText || "").trim();

  if (!text || isSending) return;

  if (promptInput) promptInput.value = "";

  addMessage("user", text);

  const localAnswer = getLocalAnswer(text);

  if (localAnswer) {
    addMessage("assistant", localAnswer);
    setStatus("SYSTEM ONLINE");
    speakReply(localAnswer);
    return;
  }

  await requestAI(text);
}

function updateSendButton() {
  const button = chatForm?.querySelector('button[type="submit"]');

  if (button) {
    button.disabled = isSending;
    button.textContent = isSending ? "…" : "➤";
  }
}

if (chatForm) {
  chatForm.addEventListener("submit", (event) => {
    event.preventDefault();
    sendMessage(promptInput?.value);
  });
}

/* ---------- SETTINGS ---------- */

function openSettings() {
  if (!settingsDialog) return;

  if (apiKeyInput) apiKeyInput.value = settings.apiKey;
  if (apiUrlInput) apiUrlInput.value = settings.apiUrl;
  if (modelInput) modelInput.value = settings.model;

  if (typeof settingsDialog.showModal === "function") {
    if (!settingsDialog.open) settingsDialog.showModal();
  } else {
    settingsDialog.setAttribute("open", "");
  }
}

function closeSettings() {
  if (!settingsDialog) return;

  if (typeof settingsDialog.close === "function" && settingsDialog.open) {
    settingsDialog.close();
  } else {
    settingsDialog.removeAttribute("open");
  }
}

settingsButton?.addEventListener("click", openSettings);
$("nav-settings")?.addEventListener("click", openSettings);
$("close-settings")?.addEventListener("click", closeSettings);

settingsDialog?.addEventListener("click", (event) => {
  if (event.target === settingsDialog) closeSettings();
});

settingsForm?.addEventListener("submit", (event) => {
  event.preventDefault();

  const key = apiKeyInput?.value.trim() || "";
  const url = apiUrlInput?.value.trim() ||
    "https://api.openai.com/v1/chat/completions";
  const model = modelInput?.value.trim() || "gpt-4o-mini";

  try {
    const parsed = new URL(url);

    if (
      parsed.protocol !== "https:" &&
      parsed.hostname !== "localhost"
    ) {
      setStatus("HTTPS ENDPOINT REQUIRED");
      return;
    }
  } catch {
    setStatus("INVALID API URL");
    return;
  }

  settings = {
    apiKey: key,
    apiUrl: url,
    model
  };

  if (!saveSettings()) {
    addMessage(
      "assistant",
      "Settings could not be saved in this browser. Check storage permissions."
    );
    return;
  }

  updateAIStatus();
  closeSettings();
  setStatus(key ? "API CONFIGURED" : "SYSTEM ONLINE");

  addMessage(
    "assistant",
    key
      ? "Settings saved. You can now try an AI message."
      : "Settings saved. Add an API key when you want to connect to an AI service."
  );
});

$("forget-key")?.addEventListener("click", () => {
  settings.apiKey = "";

  if (!saveSettings()) return;

  if (apiKeyInput) apiKeyInput.value = "";

  updateAIStatus();
  setStatus("API KEY REMOVED");

  addMessage("assistant", "The saved API key has been removed.");
});

/* ---------- CLEAR CHAT ---------- */

$("clear-chat")?.addEventListener("click", () => {
  clearConversation();
});

/* ---------- HISTORY ---------- */

function showHistory() {
  const history = loadHistory();

  if (!history.length) {
    addMessage("assistant", "Your conversation history is empty.");
    return;
  }

  renderHistory();
  setStatus("HISTORY LOADED");
}

$("history-button")?.addEventListener("click", showHistory);
$("nav-history")?.addEventListener("click", showHistory);

/* ---------- TEXT TO SPEECH ---------- */

function speakReply(text) {
  if (!("speechSynthesis" in window)) return;

  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);

  utterance.lang =
    /[\u0C00-\u0C7F]/.test(text) ? "te-IN" :
    /[\u0B80-\u0BFF]/.test(text) ? "ta-IN" :
    navigator.language || "en-US";

  utterance.rate = 1;
  utterance.pitch = 1;

  window.speechSynthesis.speak(utterance);
}

/* ---------- SPEECH RECOGNITION ---------- */

function createRecognition() {
  const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) return null;

  const instance = new SpeechRecognition();

  instance.lang = navigator.language || "en-US";
  instance.continuous = false;
  instance.interimResults = false;
  instance.maxAlternatives = 1;

  instance.onstart = () => {
    isListening = true;
    micButton?.classList.add("listening");
    micButton?.classList.add("is-listening");

    if (micLabel) micLabel.textContent = "LISTENING...";
    setStatus("LISTENING...");
  };

  instance.onresult = (event) => {
    const transcript = event.results?.[0]?.[0]?.transcript;

    if (transcript) {
      if (promptInput) promptInput.value = transcript;
      sendMessage(transcript);
    }
  };

  instance.onerror = (event) => {
    console.warn("Speech recognition error:", event.error);

    const message =
      event.error === "not-allowed"
        ? "Microphone permission was denied. Allow microphone access in browser settings."
        : event.error === "no-speech"
        ? "I didn't hear anything. Please try again."
        : "Voice input is unavailable right now. You can type your message instead.";

    setStatus("VOICE INPUT ERROR");
    if (micLabel) micLabel.textContent = "TAP TO SPEAK";

    if (event.error !== "aborted") {
      addMessage("assistant", message);
    }
  };

  instance.onend = () => {
    isListening = false;
    micButton?.classList.remove("listening");
    micButton?.classList.remove("is-listening");

    if (micLabel) micLabel.textContent = "TAP TO SPEAK";

    if (statusEl?.textContent === "LISTENING...") {
      setStatus("SYSTEM ONLINE");
    }
  };

  return instance;
}

function toggleMicrophone() {
  if (isListening && recognition) {
    recognition.stop();
    return;
  }

  if (!recognition) {
    recognition = createRecognition();
  }

  if (!recognition) {
    addMessage(
      "assistant",
      "Speech recognition is not supported in this browser. Try an updated Chrome browser or type your message."
    );
    setStatus("VOICE NOT SUPPORTED");
    return;
  }

  try {
    recognition.start();
  } catch (error) {
    console.warn("Could not start microphone:", error);
    setStatus("MICROPHONE UNAVAILABLE");
  }
}

micButton?.addEventListener("click", toggleMicrophone);
$("voice-card")?.addEventListener("click", toggleMicrophone);
$("nav-voice")?.addEventListener("click", toggleMicrophone);

/* ---------- QUICK PROMPTS (IF PRESENT) ---------- */

document.addEventListener("click", (event) => {
  const button = event.target.closest("[data-prompt]");

  if (!button) return;

  const prompt = button.getAttribute("data-prompt");

  if (prompt) sendMessage(prompt);
});

/* ---------- SERVICE WORKER ---------- */

if ("serviceWorker" in navigator && location.protocol === "https:") {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("./frontend/sw.js")
      .then((registration) => {
        console.log(
          "JARVIS service worker ready:",
          registration.scope
        );
      })
      .catch((error) => {
        console.error("Service worker registration failed:", error);
      });
  });
}

/* ---------- STARTUP ---------- */

function startJarvis() {
  conversation = loadHistory();

  if (conversation.length) {
    renderHistory();
  } else {
    addMessage("assistant", WELCOME_MESSAGE);
  }

  updateAIStatus();
  setStatus("SYSTEM ONLINE");

  console.log("JARVIS interface initialized.");
}

startJarvis();
