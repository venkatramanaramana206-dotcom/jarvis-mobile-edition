 
"use strict";

/* ==========================================
   J.A.R.V.I.S. — PERSONAL AI ASSISTANT
   Chat • Voice • API • Local Storage • TTS
========================================== */

const $ = (id) => document.getElementById(id);

const UI = {
  status: $("status"),
  messages: $("messages"),
  prompt: $("prompt"),
  chatForm: $("chat-form"),
  micButton: $("mic-button"),
  micLabel: $("mic-label"),
  settingsButton: $("settings-button"),
  settingsDialog: $("settings-dialog"),
  settingsForm: $("settings-form"),
  apiKey: $("api-key"),
  apiUrl: $("api-url"),
  model: $("model"),
  forgetKey: $("forget-key"),
  clearChat: $("clear-chat")
};

const DEFAULTS = {
  endpoint: "https://api.openai.com/v1/chat/completions",
  model: "gpt-4o-mini",
  language: "en-US"
};

const STORAGE_KEYS = {
  settings: "jarvis-settings",
  history: "jarvis-chat-history"
};

let settings = loadSettings();
let history = loadHistory();
let recognition = null;
let isListening = false;
let isSending = false;

/* ---------- LOCAL STORAGE ---------- */

function loadSettings() {
  try {
    return {
      ...DEFAULTS,
      ...JSON.parse(localStorage.getItem(STORAGE_KEYS.settings) || "{}")
    };
  } catch {
    return { ...DEFAULTS };
  }
}

function saveSettings() {
  try {
    localStorage.setItem(
      STORAGE_KEYS.settings,
      JSON.stringify(settings)
    );
    return true;
  } catch {
    showStatus("STORAGE ERROR");
    return false;
  }
}

function loadHistory() {
  try {
    const saved = JSON.parse(
      localStorage.getItem(STORAGE_KEYS.history) || "[]"
    );
    return Array.isArray(saved) ? saved.slice(-30) : [];
  } catch {
    return [];
  }
}

function saveHistory() {
  try {
    localStorage.setItem(
      STORAGE_KEYS.history,
      JSON.stringify(history.slice(-30))
    );
  } catch {
    showStatus("STORAGE FULL");
  }
}

/* ---------- STATUS ---------- */

function showStatus(message) {
  if (UI.status) {
    UI.status.textContent = String(message).toUpperCase();
  }
}

/* ---------- CHAT UI ---------- */

function addMessage(role, content, options = {}) {
  if (!UI.messages) return;

  const message = document.createElement("div");
  message.className = `message ${role}`;

  const label = document.createElement("span");
  label.className = "message-label";
  label.textContent = role === "user" ? "YOU" : "JARVIS";

  const paragraph = document.createElement("p");
  paragraph.textContent = content;

  message.append(label, paragraph);
  UI.messages.appendChild(message);
  UI.messages.scrollTop = UI.messages.scrollHeight;

  if (options.save !== false && ["user", "assistant"].includes(role)) {
    history.push({ role, content });
    history = history.slice(-30);
    saveHistory();
  }
}

function renderHistory() {
  if (!UI.messages || history.length === 0) return;

  UI.messages.replaceChildren();

  for (const message of history) {
    if (["user", "assistant"].includes(message.role)) {
      addMessage(message.role, message.content, { save: false });
    }
  }
}

/* ---------- QUICK LOCAL COMMANDS ---------- */

function getLocalAnswer(text) {
  const query = text.toLowerCase().trim();

  if (
    query.includes("what can you do") ||
    query.includes("నీతో ఏమి చేయగలను") ||
    query.includes("నీ పనులు")
  ) {
    return "I can answer questions through a configured AI API, recognize speech where supported, speak replies aloud, and save chat history on this device.";
  }

  if (
    query.includes("what time") ||
    query === "time" ||
    query.includes("సమయం ఎంత")
  ) {
    return `The current device time is ${new Date().toLocaleTimeString()}.`;
  }

  if (
    query.includes("today's date") ||
    query.includes("what is the date") ||
    query.includes("ఈరోజు తేదీ")
  ) {
    return `Today's date is ${new Date().toLocaleDateString()}.`;
  }

  if (
    query.includes("hello") ||
    query.includes("hi jarvis") ||
    query.includes("నమస్కారం")
  ) {
    return "Hello. JARVIS is online and ready to assist you.";
  }

  if (!settings.apiKey) {
    return "JARVIS is online, but an AI API key has not been configured. Open Settings to enable AI responses.";
  }

  return null;
}

/* ---------- AI API ---------- */

async function requestAI(userText) {
  const localAnswer = getLocalAnswer(userText);
  if (localAnswer) return localAnswer;

  if (!settings.apiKey) {
    throw new Error("Please add your API key in Settings.");
  }

  const endpoint = settings.endpoint || DEFAULTS.endpoint;
  const model = settings.model || DEFAULTS.model;

  const conversation = history
    .filter(item => ["user", "assistant"].includes(item.role))
    .slice(-20)
    .map(item => ({
      role: item.role,
      content: item.content
    }));

  // The current user message is not in history yet.
  conversation.push({
    role: "user",
    content: userText
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45000);

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${settings.apiKey}`
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content:
              "You are JARVIS, a helpful personal AI assistant. " +
              "Reply clearly and naturally. Reply in Telugu when the user " +
              "writes in Telugu, and otherwise use the user's language. " +
              "Never claim to have performed an action unless it was actually done."
          },
          ...conversation
        ],
        temperature: 0.7
      })
    });

    if (!response.ok) {
      let details = "";
      try {
        const errorData = await response.json();
        details = errorData?.error?.message || "";
      } catch {}

      throw new Error(
        `API request failed (${response.status})` +
        (details ? `: ${details}` : "")
      );
    }

    const data = await response.json();
    const answer = data?.choices?.[0]?.message?.content;

    if (typeof answer !== "string" || !answer.trim()) {
      throw new Error("The AI API returned an empty response.");
    }

    return answer.trim();
  } finally {
    clearTimeout(timeout);
  }
}

/* ---------- SEND MESSAGE ---------- */

async function sendMessage(text) {
  const userText = String(text || "").trim();

  if (!userText || isSending) return;

  isSending = true;

  if (UI.prompt) UI.prompt.value = "";

  addMessage("user", userText);
  showStatus("PROCESSING REQUEST");

  try {
    const answer = await requestAI(userText);

    addMessage("assistant", answer);
    speakAnswer(answer);

    showStatus("SYSTEM ONLINE");
  } catch (error) {
    const errorMessage =
      error.name === "AbortError"
        ? "The request timed out. Please try again."
        : error.message || "An unexpected error occurred.";

    addMessage(
      "assistant",
      `I could not complete that request. ${errorMessage}`
    );

    showStatus("REQUEST FAILED");
  } finally {
    isSending = false;
  }
}

/* ---------- TEXT TO SPEECH ---------- */

function speakAnswer(text) {
  if (!("speechSynthesis" in window)) return;

  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);

  const isTelugu = /[\u0C00-\u0C7F]/.test(text);
  utterance.lang = isTelugu ? "te-IN" : (settings.language || "en-US");
  utterance.rate = 1;
  utterance.pitch = 0.95;
  utterance.volume = 1;

  window.speechSynthesis.speak(utterance);
}

/* ---------- API SETTINGS ---------- */

function openSettings() {
  if (!UI.settingsDialog) return;

  if (UI.apiKey) UI.apiKey.value = settings.apiKey || "";
  if (UI.apiUrl) UI.apiUrl.value = settings.endpoint || DEFAULTS.endpoint;
  if (UI.model) UI.model.value = settings.model || DEFAULTS.model;

  if (typeof UI.settingsDialog.showModal === "function") {
    UI.settingsDialog.showModal();
  } else {
    showStatus("SETTINGS NOT SUPPORTED");
  }
}

function saveSettingsFromForm(event) {
  event.preventDefault();

  settings.apiKey = UI.apiKey?.value.trim() || "";
  settings.endpoint =
    UI.apiUrl?.value.trim() || DEFAULTS.endpoint;
  settings.model =
    UI.model?.value.trim() || DEFAULTS.model;

  if (!/^https?:\/\//i.test(settings.endpoint)) {
    addMessage("assistant", "Please enter a valid API endpoint URL.");
    return;
  }

  saveSettings();

  if (UI.settingsDialog?.open) {
    UI.settingsDialog.close();
  }

  addMessage(
    "assistant",
    settings.apiKey
      ? "Settings saved. You can now try an AI request."
      : "Settings saved. Add an API key to enable AI responses."
  );
}

function removeAPIKey() {
  settings.apiKey = "";
  saveSettings();

  if (UI.apiKey) UI.apiKey.value = "";

  addMessage("assistant", "The saved API key has been removed.");
}

/* ---------- MICROPHONE / SPEECH RECOGNITION ---------- */

function setupMicrophone() {
  const SpeechRecognition =
    window.SpeechRecognition ||
    window.webkitSpeechRecognition;

  if (!UI.micButton) return;

  if (!SpeechRecognition) {
    UI.micButton.addEventListener("click", () => {
      addMessage(
        "assistant",
        "Speech recognition is not supported here. Please type your message or try a compatible browser."
      );
    });
    return;
  }

  recognition = new SpeechRecognition();
  recognition.lang = settings.language || navigator.language || "en-US";
  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;

  recognition.onstart = () => {
    isListening = true;
    UI.micButton.classList.add("listening");

    if (UI.micLabel) {
      UI.micLabel.textContent = "LISTENING...";
    }

    showStatus("LISTENING");
  };

  recognition.onresult = (event) => {
    let finalText = "";
    let interimText = "";

    for (let i = event.resultIndex; i < event.results.length; i++) {
      const transcript = event.results[i][0].transcript;

      if (event.results[i].isFinal) {
        finalText += transcript;
      } else {
        interimText += transcript;
      }
    }

    if (UI.prompt && interimText) {
      UI.prompt.value = interimText;
    }

    if (finalText.trim()) {
      if (UI.prompt) UI.prompt.value = "";
      sendMessage(finalText.trim());
    }
  };

  recognition.onerror = (event) => {
    showStatus("MICROPHONE ERROR");

    addMessage(
      "assistant",
      `Voice recognition error: ${event.error}. Check microphone permission and try again.`
    );
  };

  recognition.onend = () => {
    isListening = false;

    UI.micButton.classList.remove("listening");

    if (UI.micLabel) {
      UI.micLabel.textContent = "TAP TO SPEAK";
    }

    showStatus("SYSTEM ONLINE");
  };

  UI.micButton.addEventListener("click", () => {
    if (isListening) {
      recognition.stop();
      return;
    }

    try {
      if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }

      recognition.lang =
        settings.language || navigator.language || "en-US";

      recognition.start();
    } catch (error) {
      addMessage(
        "assistant",
        "Unable to start the microphone. Please retry and check permissions."
      );
    }
  });
}

/* ---------- EVENT LISTENERS ---------- */

function setupEvents() {
  UI.chatForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    sendMessage(UI.prompt?.value || "");
  });

  UI.settingsButton?.addEventListener("click", openSettings);

  UI.settingsForm?.addEventListener(
    "submit",
    saveSettingsFromForm
  );

  UI.forgetKey?.addEventListener("click", removeAPIKey);

  $("close-settings")?.addEventListener("click", () => {
    UI.settingsDialog?.close();
  });

  UI.clearChat?.addEventListener("click", () => {
    history = [];
    saveHistory();

    if (UI.messages) {
      UI.messages.replaceChildren();
    }

    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }

    showStatus("CHAT CLEARED");
  });

  document.querySelectorAll("[data-prompt]").forEach((button) => {
    button.addEventListener("click", () => {
      sendMessage(button.dataset.prompt || "");
    });
  });
}

/* ---------- INITIALIZE ---------- */

function initializeJarvis() {
  setupEvents();
  setupMicrophone();
  renderHistory();

  showStatus("SYSTEM ONLINE");

  if ("speechSynthesis" in window) {
    window.speechSynthesis.getVoices();
  }

  console.info("JARVIS assistant initialized.");
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeJarvis);
} else {
  initializeJarvis();
}
