 
/* ==========================================
   J.A.R.V.I.S. — MAIN APPLICATION ENGINE
   File: frontend/script.js
   Works with index.html and style.css
   ========================================== */

"use strict";

(() => {
  const $ = (id) => document.getElementById(id);

  const el = {
    setupScreen: $("setupScreen"),
    apiSetupForm: $("apiSetupForm"),
    apiUrl: $("apiUrl"),
    apiKey: $("apiKey"),
    modelName: $("modelName"),
    setupError: $("setupError"),
    connectButton: $("connectButton"),
    skipSetupButton: $("skipSetupButton"),

    app: $("app"),
    systemStatus: $("systemStatus"),
    settingsButton: $("settingsButton"),
    hudOrb: $("hudOrb"),
    heroTitle: $("heroTitle"),
    heroSubtitle: $("heroSubtitle"),
    listeningStatus: $("listeningStatus"),

    micButton: $("micButton"),
    readButton: $("readButton"),
    stopVoiceButton: $("stopVoiceButton"),

    chatMessages: $("chatMessages"),
    chatForm: $("chatForm"),
    userInput: $("userInput"),
    sendButton: $("sendButton"),

    settingsDialog: $("settingsDialog"),
    closeSettingsButton: $("closeSettingsButton"),
    settingsForm: $("settingsForm"),
    settingsApiUrl: $("settingsApiUrl"),
    settingsApiKey: $("settingsApiKey"),
    settingsModelName: $("settingsModelName"),
    languageSelect: $("languageSelect"),
    autoSpeakCheckbox: $("autoSpeakCheckbox"),
    settingsError: $("settingsError"),
    clearChatButton: $("clearChatButton")
  };

  const defaults = {
    apiUrl: "https://api.openai.com/v1",
    model: "gpt-4o-mini",
    language: "te-IN",
    autoSpeak: false
  };

  let config = { ...defaults };
  let conversation = [];
  let recognition = null;
  let listening = false;
  let speakingText = "";
  let busy = false;
  let currentController = null;

  const SYSTEM_PROMPT = [
    "You are JARVIS, a helpful personal AI assistant.",
    "You can respond in Telugu or English according to the user's language.",
    "Be clear, respectful, practical, and concise.",
    "You are an AI assistant, not the Marvel movie character.",
    "Never claim you performed a phone action unless it actually succeeded.",
    "For actions that require Android permissions or native integration,",
    "explain the limitation and ask the user to use the appropriate control."
  ].join(" ");

  /* ==========================================
     CONFIGURATION
     ========================================== */

  function normalizeApiUrl(value) {
    const url = value.trim().replace(/\/+$/, "");

    if (!url) {
      throw new Error("Please enter an API endpoint.");
    }

    let parsed;

    try {
      parsed = new URL(url);
    } catch {
      throw new Error("Please enter a valid API URL.");
    }

    if (!["https:", "http:"].includes(parsed.protocol)) {
      throw new Error("The API URL must use HTTP or HTTPS.");
    }

    if (
      parsed.protocol === "http:" &&
      location.protocol === "https:" &&
      parsed.hostname !== "localhost" &&
      parsed.hostname !== "127.0.0.1"
    ) {
      throw new Error("Use an HTTPS API endpoint on this website.");
    }

    if (parsed.username || parsed.password) {
      throw new Error("Do not put credentials inside the API URL.");
    }

    return url;
  }

  function loadConfig() {
    try {
      const saved = sessionStorage.getItem("jarvis_config");

      if (saved) {
        const parsed = JSON.parse(saved);

        config = {
          ...defaults,
          ...parsed
        };
      }
    } catch (error) {
      console.warn("Could not load JARVIS settings.", error);
    }

    if (el.apiUrl) el.apiUrl.value = config.apiUrl;
    if (el.modelName) el.modelName.value = config.model;

    if (el.settingsApiUrl) {
      el.settingsApiUrl.value = config.apiUrl;
    }

    if (el.settingsModelName) {
      el.settingsModelName.value = config.model;
    }

    if (el.languageSelect) {
      el.languageSelect.value = config.language;
    }

    if (el.autoSpeakCheckbox) {
      el.autoSpeakCheckbox.checked = config.autoSpeak;
    }

    const hasKey = Boolean(config.apiKey);

    if (hasKey) {
      hideSetup();
    } else {
      showSetup();
    }
  }

  function saveConfig() {
    try {
      sessionStorage.setItem(
        "jarvis_config",
        JSON.stringify(config)
      );

      return true;
    } catch {
      return false;
    }
  }

  function showSetup() {
    el.setupScreen?.classList.add("visible");

    if (el.systemStatus) {
      el.systemStatus.textContent = "CONFIGURATION REQUIRED";
    }
  }

  function hideSetup() {
    el.setupScreen?.classList.remove("visible");

    if (el.systemStatus) {
      el.systemStatus.textContent = "SYSTEM READY";
    }
  }

  function validateModel(value) {
    const model = value.trim();

    if (!model || model.length > 150) {
      throw new Error("Enter a valid model name.");
    }

    return model;
  }

  /* ==========================================
     STARTUP FORM
     ========================================== */

  el.apiSetupForm?.addEventListener("submit", (event) => {
    event.preventDefault();

    try {
      const apiKey = el.apiKey.value.trim();

      if (!apiKey) {
        throw new Error("Please enter your API key.");
      }

      config.apiUrl = normalizeApiUrl(
        el.apiUrl.value || defaults.apiUrl
      );

      config.apiKey = apiKey;
      config.model = validateModel(
        el.modelName.value || defaults.model
      );

      if (!saveConfig()) {
        throw new Error(
          "Browser storage is unavailable. Check your browser settings."
        );
      }

      el.apiKey.value = "";
      el.setupError.textContent = "";

      hideSetup();
      setStatus("SYSTEM READY", "Connection settings saved.");

    } catch (error) {
      el.setupError.textContent = error.message;
    }
  });

  el.skipSetupButton?.addEventListener("click", () => {
    hideSetup();

    setStatus(
      "OFFLINE MODE",
      "Enter an API key in Settings to enable AI responses."
    );
  });

  /* ==========================================
     STATUS AND HUD
     ========================================== */

  function setStatus(status, message = "") {
    if (el.systemStatus) {
      el.systemStatus.textContent = status;
    }

    if (el.listeningStatus) {
      el.listeningStatus.textContent = message;
    }

    if (el.hudOrb) {
      el.hudOrb.classList.remove(
        "listening",
        "thinking",
        "speaking"
      );

      const lower = status.toLowerCase();

      if (lower.includes("listening")) {
        el.hudOrb.classList.add("listening");
      } else if (lower.includes("thinking")) {
        el.hudOrb.classList.add("thinking");
      } else if (lower.includes("speaking")) {
        el.hudOrb.classList.add("speaking");
      }
    }
  }

  function setBusy(value) {
    busy = value;

    if (el.sendButton) {
      el.sendButton.disabled = value;
    }

    if (el.connectButton) {
      el.connectButton.disabled = value;
    }
  }

  /* ==========================================
     CHAT MESSAGE RENDERING
     ========================================== */

  function addMessage(role, text) {
    const article = document.createElement("article");

    article.className =
      role === "user"
        ? "message user-message"
        : "message assistant-message";

    const label = document.createElement("div");
    label.className = "message-label";
    label.textContent =
      role === "user" ? "YOU" : "J.A.R.V.I.S.";

    const content = document.createElement("div");
    content.className = "message-content";
    content.textContent = text;

    article.append(label, content);
    el.chatMessages.appendChild(article);

    el.chatMessages.scrollTop = el.chatMessages.scrollHeight;

    return content;
  }

  function updateMessage(element, text) {
    if (element) {
      element.textContent = text;
      el.chatMessages.scrollTop = el.chatMessages.scrollHeight;
    }
  }

  function errorMessage(error) {
    const message = String(error?.message || "");

    if (/failed to fetch|networkerror|load failed/i.test(message)) {
      return (
        "Could not connect to the AI service. Check your internet, " +
        "API endpoint, and whether the service allows browser requests (CORS)."
      );
    }

    if (/401|unauthorized|invalid.*key/i.test(message)) {
      return "API authentication failed. Check your API key.";
    }

    if (/403|forbidden/i.test(message)) {
      return "The API refused the request. Check your permissions and account.";
    }

    if (/429|rate limit|quota/i.test(message)) {
      return "API rate limit or usage quota reached. Try again later.";
    }

    return message || "Something went wrong. Please try again.";
  }

  /* ==========================================
     AI CHAT
     ========================================== */

  async function askAI(userText) {
    if (busy) {
      addMessage(
        "assistant",
        "Please wait for my current response to finish."
      );
      return;
    }

    if (!config.apiKey) {
      addMessage(
        "assistant",
        "AI is not configured yet. Open Settings and enter your API key."
      );

      showSetup();
      return;
    }

    let endpoint;

    try {
      endpoint = normalizeApiUrl(config.apiUrl);
    } catch (error) {
      addMessage("assistant", error.message);
      return;
    }

    const userMessage = {
      role: "user",
      content: userText
    };

    conversation.push(userMessage);

    addMessage("user", userText);

    const responseElement = addMessage(
      "assistant",
      "Analyzing your request..."
    );

    setBusy(true);
    setStatus("THINKING", "Processing your request...");

    currentController = new AbortController();

    try {
      const response = await fetch(
        endpoint + "/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + config.apiKey
          },
          body: JSON.stringify({
            model: config.model,
            messages: [
              {
                role: "system",
                content: SYSTEM_PROMPT
              },
              ...conversation.slice(-20)
            ],
            temperature: 0.7
          }),
          signal: currentController.signal
        }
      );

      if (!response.ok) {
        let detail = "";

        try {
          const data = await response.json();
          detail = data?.error?.message || "";
        } catch {
          // The API may return a non-JSON error response.
        }

        throw new Error(
          "HTTP " + response.status +
          (detail ? ": " + detail : "")
        );
      }

      const data = await response.json();

      const answer =
        data?.choices?.[0]?.message?.content;

      if (typeof answer !== "string" || !answer.trim()) {
        throw new Error("The AI returned an empty response.");
      }

      conversation.push({
        role: "assistant",
        content: answer
      });

      updateMessage(responseElement, answer);

      setStatus("SYSTEM READY", "Response received.");

      if (config.autoSpeak) {
        speak(answer);
      }

    } catch (error) {
      if (error.name === "AbortError") {
        updateMessage(responseElement, "Request cancelled.");
        setStatus("SYSTEM READY", "Request cancelled.");
      } else {
        updateMessage(
          responseElement,
          "JARVIS: " + errorMessage(error)
        );

        setStatus("CONNECTION ERROR", "Check your API connection.");
        console.error("JARVIS request failed:", error);
      }

      // Do not keep a failed user message in the conversation.
      conversation.pop();

    } finally {
      currentController = null;
      setBusy(false);
    }
  }

  el.chatForm?.addEventListener("submit", async (event) => {
    event.preventDefault();

    const text = el.userInput.value.trim();

    if (!text || busy) return;

    el.userInput.value = "";

    // Try safe, explicitly supported device commands first.
    const handled = await handleDeviceCommand(text);

    if (!handled) {
      await askAI(text);
    }
  });

  el.userInput?.addEventListener("keydown", (event) => {
    if (
      event.key === "Enter" &&
      !event.shiftKey &&
      !event.isComposing
    ) {
      event.preventDefault();
      el.chatForm.requestSubmit();
    }
  });

  /* ==========================================
     VOICE OUTPUT
     ========================================== */

  function speak(text) {
    if (!("speechSynthesis" in window)) {
      setStatus(
        "VOICE UNAVAILABLE",
        "Text-to-speech is not supported in this browser."
      );
      return;
    }

    stopSpeaking();

    speakingText = text;

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = config.language || "te-IN";
    utterance.rate = 1;
    utterance.pitch = 1;
    utterance.volume = 1;

    utterance.onstart = () => {
      setStatus("SPEAKING", "JARVIS is speaking...");
    };

    utterance.onend = () => {
      setStatus("SYSTEM READY", "Ready for your next command.");
    };

    utterance.onerror = (event) => {
      if (event.error !== "canceled" && event.error !== "interrupted") {
        setStatus(
          "VOICE ERROR",
          "Voice output could not be completed."
        );
      }
    };

    window.speechSynthesis.speak(utterance);
  }

  function stopSpeaking() {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }

    speakingText = "";
  }

  el.readButton?.addEventListener("click", () => {
    const messages =
      el.chatMessages.querySelectorAll(".assistant-message .message-content");

    const last = messages[messages.length - 1];

    if (!last || !last.textContent.trim()) {
      setStatus("SYSTEM READY", "There is no answer to read yet.");
      return;
    }

    speak(last.textContent.trim());
  });

  el.stopVoiceButton?.addEventListener("click", () => {
    stopSpeaking();

    if (listening) {
      stopListening();
    }

    setStatus("SYSTEM READY", "Voice playback stopped.");
  });

  /* ==========================================
     VOICE INPUT
     ========================================== */

  function createRecognition() {
    const SpeechRecognition =
      window.SpeechRecognition ||
      window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      return null;
    }

    const instance = new SpeechRecognition();

    instance.lang = config.language || "te-IN";
    instance.continuous = false;
    instance.interimResults = false;
    instance.maxAlternatives = 1;

    instance.onstart = () => {
      listening = true;

      setStatus(
        "LISTENING",
        "Listening... Speak now."
      );

      if (el.micButton) {
        el.micButton.setAttribute("aria-pressed", "true");
      }
    };

    instance.onresult = async (event) => {
      const result = event.results?.[event.resultIndex]?.[0];
      const transcript = result?.transcript?.trim();

      if (!transcript) return;

      el.userInput.value = transcript;

      setStatus("COMMAND RECEIVED", transcript);

      // Device commands and AI requests use the same route.
      const handled = await handleDeviceCommand(transcript);

      if (!handled) {
        await askAI(transcript);
      }
    };

    instance.onerror = (event) => {
      const message =
        event.error === "not-allowed"
          ? "Microphone permission denied. Allow microphone access in your browser."
          : event.error === "no-speech"
            ? "No speech detected. Tap the microphone and try again."
            : "Voice input failed: " + event.error;

      setStatus("MICROPHONE ERROR", message);
    };

    instance.onend = () => {
      listening = false;

      if (el.micButton) {
        el.micButton.setAttribute("aria-pressed", "false");
      }

      if (!busy && !speakingText) {
        setStatus("SYSTEM READY", "Ready for your next command.");
      }
    };

    return instance;
  }

  function startListening() {
    stopSpeaking();

    recognition = createRecognition();

    if (!recognition) {
      setStatus(
        "VOICE UNAVAILABLE",
        "This browser does not support speech recognition. Try a compatible browser."
      );
      return;
    }

    try {
      recognition.start();
    } catch (error) {
      setStatus(
        "VOICE ERROR",
        "Could not start the microphone. Wait and try again."
      );
      console.warn("Speech recognition:", error);
    }
  }

  function stopListening() {
    if (recognition && listening) {
      recognition.stop();
    }

    listening = false;

    if (el.micButton) {
      el.micButton.setAttribute("aria-pressed", "false");
    }
  }

  el.micButton?.addEventListener("click", () => {
    if (listening) {
      stopListening();
      setStatus("SYSTEM READY", "Listening stopped.");
    } else {
      startListening();
    }
  });

  /* ==========================================
     LIMITED ANDROID ACTION ENGINE
     Browser-only intent launches are best-effort.
     They are NOT a substitute for native Android code.
     ========================================== */

  async function handleDeviceCommand(text) {
    const normalized = text.toLowerCase().trim();

    const settingsCommands = [
      "open settings",
      "open phone settings",
      "సెట్టింగ్స్ ఓపెన్ చేయి",
      "సెట్టింగ్స్ తెరువు",
      "ఫోన్ సెట్టింగ్స్ తెరువు"
    ];

    const cameraCommands = [
      "open camera",
      "launch camera",
      "కెమెరా ఓపెన్ చేయి",
      "కెమెరా తెరువు"
    ];

    const isSettings = settingsCommands.some(
      (command) => normalized === command
    );

    const isCamera = cameraCommands.some(
      (command) => normalized === command
    );

    if (!isSettings && !isCamera) {
      return false;
    }

    addMessage("user", text);

    if (isSettings) {
      addMessage(
        "assistant",
        "Attempting to open Android Settings. Your browser or device may block this action."
      );

      try {
        window.location.href =
          "intent:#Intent;action=android.settings.SETTINGS;end";
      } catch {
        addMessage(
          "assistant",
          "Please open Settings manually on your phone."
        );
      }

      return true;
    }

    if (isCamera) {
      addMessage(
        "assistant",
        "Attempting to open the camera. This depends on Android and your browser."
      );

      try {
        window.location.href =
          "intent:#Intent;action=android.media.action.IMAGE_CAPTURE;end";
      } catch {
        addMessage(
          "assistant",
          "Please open the Camera app manually."
        );
      }

      return true;
    }

    return false;
  }

  /* ==========================================
     SETTINGS
     ========================================== */

  el.settingsButton?.addEventListener("click", () => {
    if (!el.settingsDialog) return;

    el.settingsApiUrl.value = config.apiUrl || defaults.apiUrl;
    el.settingsModelName.value = config.model || defaults.model;
    el.settingsApiKey.value = "";

    el.settingsError.textContent = "";

    if (typeof el.settingsDialog.showModal === "function") {
      el.settingsDialog.showModal();
    } else {
      setStatus(
        "SETTINGS UNAVAILABLE",
        "Your browser does not support this settings dialog."
      );
    }
  });

  el.closeSettingsButton?.addEventListener("click", () => {
    el.settingsDialog?.close();
  });

  el.settingsForm?.addEventListener("submit", (event) => {
    event.preventDefault();

    try {
      const nextUrl = normalizeApiUrl(
        el.settingsApiUrl.value || defaults.apiUrl
      );

      const nextModel = validateModel(
        el.settingsModelName.value || defaults.model
      );

      const newKey = el.settingsApiKey.value.trim();

      config.apiUrl = nextUrl;
      config.model = nextModel;

      if (newKey) {
        config.apiKey = newKey;
      }

      config.language = el.languageSelect.value || "te-IN";
      config.autoSpeak = el.autoSpeakCheckbox.checked;

      if (!saveConfig()) {
        throw new Error("Could not save settings in browser storage.");
      }

      el.settingsError.textContent = "";
      el.settingsApiKey.value = "";

      el.settingsDialog.close();

      setStatus("SYSTEM READY", "Settings saved for this browser session.");

    } catch (error) {
      el.settingsError.textContent = error.message;
    }
  });

  el.clearChatButton?.addEventListener("click", () => {
    conversation = [];
    stopSpeaking();

    el.chatMessages.replaceChildren();

    addMessage(
      "assistant",
      "Conversation cleared. Hello! నేను JARVIS. నన్ను తెలుగులో లేదా Englishలో అడగండి."
    );

    setStatus("SYSTEM READY", "New conversation started.");
  });

  /* ==========================================
     START APPLICATION
     ========================================== */

  function initialize() {
    loadConfig();

    if (el.heroTitle) {
      el.heroTitle.textContent = "How can I help you?";
    }

    if (el.heroSubtitle) {
      el.heroSubtitle.textContent = "Your personal AI assistant";
    }

    if (el.listeningStatus) {
      el.listeningStatus.textContent = "Awaiting your command...";
    }

    console.info("J.A.R.V.I.S. frontend initialized.");
  }

  initialize();

})();
