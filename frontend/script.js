
(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);

  const el = {
    messages: $("messages"),
    form: $("chatForm"),
    input: $("userInput"),
    mic: $("micBtn"),
    status: $("voiceStatus"),
    typing: $("typing"),
    settings: $("settingsDialog"),
    settingsBtn: $("settingsBtn"),
    settingsForm: $("settingsForm"),
    apiKey: $("apiKey"),
    apiUrl: $("apiUrl"),
    model: $("modelName"),
    closeSettings: $("closeSettingsBtn"),
    removeKey: $("removeKeyBtn"),
    saveSettings: $("saveSettingsBtn"),
    speak: $("speakBtn"),
    stopSpeak: $("stopSpeakBtn"),
    clear: $("clearBtn"),
    clock: $("clock"),
    date: $("dateLine"),
    toolOutput: $("toolOutput")
  };

  const STORE = {
    key: "jarvis_api_key",
    url: "jarvis_api_url",
    model: "jarvis_model",
    history: "jarvis_chat_history",
    voice: "jarvis_auto_voice"
  };

  const defaults = {
    url: "https://api.openai.com/v1/chat/completions",
    model: "gpt-4o-mini"
  };

  let busy = false;
  let recognition = null;
  let listening = false;
  let voiceLanguage = "te-IN";
  let lastAnswer = "";
  let history = [];
  let voices = [];

  const getSetting = (key, fallback = "") =>
    localStorage.getItem(key) || fallback;

  const setStatus = (message) => {
    if (el.status) el.status.textContent = message;
    const systemStatus = $("systemStatus");
    if (systemStatus) systemStatus.textContent = message;
  };

  function updateClock() {
    const now = new Date();
    if (el.clock) {
      el.clock.textContent = now.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit"
      });
    }
    if (el.date) {
      el.date.textContent = now.toLocaleDateString([], {
        weekday: "long",
        month: "short",
        day: "numeric"
      });
    }
  }

  function scrollMessages() {
    if (el.messages) {
      el.messages.scrollTop = el.messages.scrollHeight;
    }
  }

  function addMessage(text, who = "ai") {
    if (!el.messages) return;

    const node = document.createElement("div");
    node.className = who === "user"
      ? "message user-message"
      : "message ai-message";

    // Plain text only: do not inject API responses as HTML.
    node.textContent = text;
    el.messages.appendChild(node);
    scrollMessages();
  }

  function setBusy(value) {
    busy = value;
    if (el.typing) el.typing.hidden = !value;
    if (el.input) el.input.disabled = value;
    if (el.form) {
      const submit = el.form.querySelector('[type="submit"]');
      if (submit) submit.disabled = value;
    }
    if (value) setStatus("THINKING...");
    else setStatus("SYSTEM READY");
  }

  function getLanguage(text) {
    // Detect Telugu script; otherwise use English speech.
    return /[\u0C00-\u0C7F]/.test(text) ? "te-IN" : "en-US";
  }

  function getApiKey() {
    return (el.apiKey?.value || getSetting(STORE.key)).trim();
  }

  function getApiUrl() {
    return (
      el.apiUrl?.value ||
      getSetting(STORE.url, defaults.url)
    ).trim();
  }

  function getModel() {
    return (
      el.model?.value ||
      getSetting(STORE.model, defaults.model)
    ).trim();
  }

  function restoreSettings() {
    if (el.apiKey) el.apiKey.value = getSetting(STORE.key);
    if (el.apiUrl) el.apiUrl.value = getSetting(STORE.url, defaults.url);
    if (el.model) el.model.value = getSetting(STORE.model, defaults.model);
  }

  function saveSettings(event) {
    if (event) event.preventDefault();

    const key = (el.apiKey?.value || "").trim();
    const url = (el.apiUrl?.value || defaults.url).trim();
    const model = (el.model?.value || defaults.model).trim();

    if (!key) {
      alert("Please enter your API key.");
      el.apiKey?.focus();
      return;
    }

    try {
      const parsed = new URL(url);
      if (!["https:", "http:"].includes(parsed.protocol)) {
        throw new Error("Invalid protocol");
      }
    } catch {
      alert("Enter a valid API URL.");
      el.apiUrl?.focus();
      return;
    }

    localStorage.setItem(STORE.key, key);
    localStorage.setItem(STORE.url, url);
    localStorage.setItem(STORE.model, model);

    if (el.settings?.open) el.settings.close();
    setStatus("API SETTINGS SAVED");
    addMessage("API settings saved. You can ask me a question now.", "ai");
  }

  function openSettings() {
    restoreSettings();

    if (el.settings?.showModal) {
      if (!el.settings.open) el.settings.showModal();
    } else {
      alert("Settings dialog was not found. Check the ID settingsDialog in index.html.");
    }
  }

  function chooseVoice(lang) {
    voices = window.speechSynthesis?.getVoices?.() || [];
    const prefix = lang.toLowerCase().split("-")[0];

    return (
      voices.find(v => v.lang.toLowerCase() === lang.toLowerCase()) ||
      voices.find(v => v.lang.toLowerCase().startsWith(prefix)) ||
      voices.find(v => v.default) ||
      null
    );
  }

  function speak(text, lang = getLanguage(text)) {
    if (!("speechSynthesis" in window) || !text) {
      setStatus("VOICE OUTPUT UNAVAILABLE");
      return;
    }

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    utterance.rate = 1;
    utterance.pitch = 1;
    utterance.volume = 1;

    const voice = chooseVoice(lang);
    if (voice) utterance.voice = voice;

    utterance.onstart = () => setStatus("SPEAKING...");
    utterance.onend = () => setStatus("SYSTEM READY");
    utterance.onerror = () => setStatus("VOICE ERROR — USE READ ALOUD");

    window.speechSynthesis.speak(utterance);
  }

  async function askAI(userText) {
    const apiKey = getApiKey();
    const apiUrl = getApiUrl();
    const model = getModel();

    if (!apiKey) {
      openSettings();
      throw new Error("Add your API key in Settings before chatting.");
    }

    if (!apiUrl || !model) {
      throw new Error("Please set the API URL and model in Settings.");
    }

    const messages = [
      {
        role: "system",
        content:
          "You are JARVIS, a helpful personal AI assistant. " +
          "Reply in the same language the user uses. If they use Telugu, " +
          "reply naturally in Telugu. If they use English, reply in English. " +
          "If they mix both, you may mix both. Be clear and useful. " +
          "Never claim you performed a real-world action unless a connected " +
          "tool actually performed it. Explain when you cannot perform an action."
      },
      ...history.slice(-12),
      { role: "user", content: userText }
    ];

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({ model, messages, temperature: 0.7 })
    });

    if (!response.ok) {
      let detail = "";
      try {
        const errorData = await response.json();
        detail = errorData?.error?.message || "";
      } catch {}

      if (response.status === 401) {
        throw new Error("API key is invalid. Check it in Settings.");
      }
      if (response.status === 429) {
        throw new Error("API rate limit or quota reached. Check your API account.");
      }
      throw new Error(
        `API request failed (${response.status}). ${detail || "Check API URL, model, and network."}`
      );
    }

    const data = await response.json();
    const answer = data?.choices?.[0]?.message?.content;

    if (typeof answer !== "string" || !answer.trim()) {
      throw new Error("The API returned no text. Check that your model supports chat completions.");
    }

    return answer.trim();
  }

  async function sendToJarvis(text, fromVoice = false) {
    const userText = String(text || "").trim();
    if (!userText || busy) return;

    addMessage(userText, "user");
    if (el.input) el.input.value = "";
    setBusy(true);

    try {
      const answer = await askAI(userText);
      lastAnswer = answer;

      history.push(
        { role: "user", content: userText },
        { role: "assistant", content: answer }
      );
      history = history.slice(-24);

      try {
        localStorage.setItem(STORE.history, JSON.stringify(history));
      } catch {}

      addMessage(answer, "ai");

      if (getSetting(STORE.voice, "true") !== "false") {
        speak(answer, getLanguage(answer));
      } else {
        setStatus("SYSTEM READY");
      }
    } catch (error) {
      const message = error?.message || "Something went wrong.";
      addMessage("Sorry — " + message, "ai");
      setStatus("CHECK SETTINGS / CONNECTION");
    } finally {
      setBusy(false);
      if (fromVoice) {
        // Do not automatically reopen the microphone: it can record
        // the assistant's own speech on mobile devices.
        setStatus("READY — TAP MIC TO SPEAK AGAIN");
      }
    }
  }

  function createLanguageButton() {
    if (!el.mic || $("voiceLanguageBtn")) return;

    const button = document.createElement("button");
    button.id = "voiceLanguageBtn";
    button.type = "button";
    button.textContent = "🎙 తెలుగు";
    button.title = "Switch speech recognition language";
    button.style.cssText =
      "min-height:44px;padding:8px 10px;border:1px solid rgba(84,232,255,.3);" +
      "border-radius:12px;background:#101e32;color:#eef5ff;font-size:12px;";

    button.addEventListener("click", () => {
      voiceLanguage = voiceLanguage === "te-IN" ? "en-US" : "te-IN";
      button.textContent = voiceLanguage === "te-IN"
        ? "🎙 తెలుగు"
        : "🎙 English";
      setStatus(
        voiceLanguage === "te-IN"
          ? "VOICE LANGUAGE: TELUGU"
          : "VOICE LANGUAGE: ENGLISH"
      );
      if (recognition && listening) {
        recognition.stop();
      }
    });

    el.mic.insertAdjacentElement("afterend", button);
  }

  function setupRecognition() {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setStatus("VOICE INPUT UNSUPPORTED — TYPE BELOW");
      if (el.mic) el.mic.disabled = true;
      return;
    }

    recognition = new SpeechRecognition();
    recognition.lang = voiceLanguage;
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    let finalTranscript = "";

    recognition.onstart = () => {
      listening = true;
      finalTranscript = "";
      el.mic?.classList.add("listening");
      el.mic?.setAttribute("aria-pressed", "true");
      setStatus(
        voiceLanguage === "te-IN"
          ? "వింటున్నాను... ఇప్పుడు మాట్లాడు"
          : "LISTENING... SPEAK NOW"
      );
    };

    recognition.onresult = (event) => {
      let interim = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript + " ";
        } else {
          interim += transcript;
        }
      }

      if (el.input) {
        el.input.value = (finalTranscript + interim).trim();
      }
    };

    recognition.onerror = (event) => {
      setStatus(
        event.error === "not-allowed"
          ? "MICROPHONE PERMISSION DENIED"
          : event.error === "no-speech"
            ? "NO SPEECH DETECTED — TAP MIC TO RETRY"
            : `VOICE INPUT ERROR: ${event.error}`
      );
    };

    recognition.onend = () => {
      listening = false;
      el.mic?.classList.remove("listening");
      el.mic?.setAttribute("aria-pressed", "false");

      const transcript = (finalTranscript || el.input?.value || "").trim();

      if (transcript && !busy) {
        if (el.input) el.input.value = "";
        sendToJarvis(transcript, true);
      } else if (!busy) {
        setStatus("READY — TAP MIC TO SPEAK");
      }
    };
  }

  function toggleMic() {
    if (!recognition) {
      setupRecognition();
      if (!recognition) return;
    }

    if (busy) {
      setStatus("PLEASE WAIT FOR THE CURRENT ANSWER");
      return;
    }

    if (listening) {
      recognition.stop();
      return;
    }

    // Set the selected language before starting each recognition session.
    recognition.lang = voiceLanguage;
    if (el.input) el.input.value = "";

    try {
      window.speechSynthesis?.cancel();
      recognition.start();
    } catch {
      setStatus("MIC BUSY — WAIT A MOMENT AND RETRY");
    }
  }

  function restoreHistory() {
    try {
      const saved = JSON.parse(getSetting(STORE.history, "[]"));
      if (!Array.isArray(saved)) return;

      history = saved.filter(
        item =>
          item &&
          ["user", "assistant"].includes(item.role) &&
          typeof item.content === "string"
      ).slice(-24);

      // Restore recent messages in the visible chat.
      for (const item of history.slice(-10)) {
        addMessage(item.content, item.role === "user" ? "user" : "ai");
      }
    } catch {
      history = [];
    }
  }

  function bindEvents() {
    el.form?.addEventListener("submit", (event) => {
      event.preventDefault();
      sendToJarvis(el.input?.value || "");
    });

    el.mic?.addEventListener("click", toggleMic);
    el.settingsBtn?.addEventListener("click", openSettings);
    el.settingsForm?.addEventListener("submit", saveSettings);
    el.saveSettings?.addEventListener("click", saveSettings);

    el.closeSettings?.addEventListener("click", () => {
      if (el.settings?.open) el.settings.close();
    });

    el.removeKey?.addEventListener("click", () => {
      localStorage.removeItem(STORE.key);
      if (el.apiKey) el.apiKey.value = "";
      setStatus("API KEY REMOVED");
    });

    el.speak?.addEventListener("click", () => {
      if (lastAnswer) speak(lastAnswer, getLanguage(lastAnswer));
      else setStatus("NO ANSWER TO SPEAK YET");
    });

    el.stopSpeak?.addEventListener("click", () => {
      window.speechSynthesis?.cancel();
      setStatus("SPEECH STOPPED");
    });

    el.clear?.addEventListener("click", () => {
      if (el.messages) el.messages.replaceChildren();
      history = [];
      lastAnswer = "";
      localStorage.removeItem(STORE.history);
      setStatus("CHAT CLEARED");
    });

    // Let the user press Enter to send, Shift+Enter for a new line.
    el.input?.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        el.form?.requestSubmit();
      }
    });

    $("speakToggleBtn")?.addEventListener("click", () => {
      const enabled = getSetting(STORE.voice, "true") !== "false";
      localStorage.setItem(STORE.voice, String(!enabled));
      setStatus(!enabled ? "AUTO VOICE ENABLED" : "AUTO VOICE DISABLED");
    });
  }

  function init() {
    restoreSettings();
    updateClock();
    setInterval(updateClock, 1000);
    restoreHistory();
    createLanguageButton();
    setupRecognition();
    bindEvents();

    if (!getApiKey()) {
      setStatus("ADD API KEY IN SETTINGS TO START");
    } else {
      setStatus("SYSTEM READY");
    }

    if (window.speechSynthesis) {
      voices = window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = () => {
        voices = window.speechSynthesis.getVoices();
      };
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
