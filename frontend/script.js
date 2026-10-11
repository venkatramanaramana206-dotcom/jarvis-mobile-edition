
"use strict";

(() => {
  const $ = (id) => document.getElementById(id);

  const KEYS = {
    api: "jarvis_api_key",
    url: "jarvis_api_url",
    model: "jarvis_model",
    voice: "jarvis_auto_voice",
    history: "jarvis_chat_history"
  };

  const DEFAULT_URL = "https://api.openai.com/v1/chat/completions";
  const DEFAULT_MODEL = "gpt-4o-mini";

  let busy = false;
  let recognition = null;
  let lastAnswer = "";
  let autoVoice = localStorage.getItem(KEYS.voice) !== "false";
  let history = readHistory();

  function readHistory() {
    try {
      const value = JSON.parse(localStorage.getItem(KEYS.history) || "[]");
      return Array.isArray(value) ? value.slice(-24) : [];
    } catch {
      return [];
    }
  }

  function saveHistory() {
    try {
      localStorage.setItem(KEYS.history, JSON.stringify(history.slice(-24)));
    } catch (error) {
      console.warn("History save failed", error);
    }
  }

  function settings() {
    return {
      api: localStorage.getItem(KEYS.api) || "",
      url: localStorage.getItem(KEYS.url) || DEFAULT_URL,
      model: localStorage.getItem(KEYS.model) || DEFAULT_MODEL
    };
  }

  function status(message) {
    const el = $("voiceStatus");
    if (el) el.textContent = message;
  }

  function showTyping(show) {
    const el = $("typing");
    if (el) el.hidden = !show;
  }

  function addMessage(role, content) {
    const message = { role, content };
    history.push(message);
    history = history.slice(-24);
    saveHistory();
    renderMessage(message);

    if (role === "assistant") lastAnswer = content;
  }

  function renderMessage(message) {
    const container = $("messages");
    if (!container) return;

    const wrapper = document.createElement("div");
    wrapper.className =
      "message " +
      (message.role === "user" ? "user-message" : "assistant-message");

    const title = document.createElement("strong");
    title.textContent = message.role === "user" ? "YOU" : "JARVIS";

    const text = document.createElement("div");
    text.className = "message-content";
    text.textContent = message.content;

    wrapper.append(title, text);
    container.appendChild(wrapper);
    container.scrollTop = container.scrollHeight;
  }

  function renderHistory() {
    const container = $("messages");
    if (!container) return;

    container.replaceChildren();
    history.forEach(renderMessage);

    lastAnswer =
      [...history].reverse().find((item) => item.role === "assistant")
        ?.content || "";
  }

  // Detect the likely language of the response text.
  function getVoiceLanguage(text) {
    if (/[\u0C00-\u0C7F]/.test(text)) return "te-IN";
    if (/[\u0900-\u097F]/.test(text)) return "hi-IN";
    return "en-IN";
  }

  function speak(text) {
    if (!("speechSynthesis" in window)) {
      status("ఈ బ్రౌజర్‌లో వాయిస్ సదుపాయం లేదు.");
      return;
    }

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(String(text).slice(0, 3500));
    utterance.lang = getVoiceLanguage(text);
    utterance.rate = 0.95;
    utterance.pitch = 1;

    const voices = window.speechSynthesis.getVoices();
    const languagePrefix = utterance.lang.split("-")[0];
    const matchingVoice = voices.find(
      (voice) => voice.lang.toLowerCase().startsWith(languagePrefix)
    );

    if (matchingVoice) utterance.voice = matchingVoice;

    utterance.onstart = () => status("🔊 JARVIS మాట్లాడుతోంది...");
    utterance.onend = () => status("సిద్ధంగా ఉంది — ఇంకో ప్రశ్న అడగండి.");
    utterance.onerror = (event) => {
      status("వాయిస్ ప్లే కాలేదు. Speak బటన్ నొక్కి ప్రయత్నించండి.");
      console.warn("Speech error:", event.error);
    };

    window.speechSynthesis.speak(utterance);
  }

  function stopSpeaking() {
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    status("వాయిస్ ఆపబడింది.");
  }

  function openSettings() {
    const config = settings();

    if ($("apiKey")) $("apiKey").value = config.api;
    if ($("apiUrl")) $("apiUrl").value = config.url;
    if ($("modelName")) $("modelName").value = config.model;

    const dialog = $("settingsDialog");

    if (dialog && typeof dialog.showModal === "function") {
      if (!dialog.open) dialog.showModal();
    } else {
      status("Settings ఫారమ్ కనిపించడం లేదు. index.html తనిఖీ చేయండి.");
    }
  }

  async function callAI() {
    const config = settings();

    if (!config.api) {
      openSettings();
      throw new Error("Settings‌లో API key పేస్ట్ చేసి Save నొక్కండి.");
    }

    let endpoint;

    try {
      endpoint = new URL(config.url);
    } catch {
      throw new Error("API URL తప్పుగా ఉంది.");
    }

    if (
      endpoint.protocol !== "https:" &&
      endpoint.hostname !== "localhost"
    ) {
      throw new Error("HTTPS API URL ఉపయోగించండి.");
    }

    const payload = {
      model: config.model,
      messages: [
        {
          role: "system",
          content:
            "You are JARVIS, a friendly voice AI assistant. " +
            "Detect the language used by the user and reply in that language. " +
            "For Telugu, answer naturally in Telugu. For English, answer in English. " +
            "Keep spoken answers clear and avoid unnecessary markdown. " +
            "Never claim you completed an action unless the app really did it."
        },
        ...history.slice(-16).map(({ role, content }) => ({ role, content }))
      ],
      temperature: 0.7
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 45000);

    try {
      const response = await fetch(endpoint.href, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer " + config.api
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const message = data?.error?.message || "HTTP " + response.status;
        throw new Error("API సమస్య: " + message);
      }

      const answer = data?.choices?.[0]?.message?.content;

      if (typeof answer !== "string" || !answer.trim()) {
        throw new Error("API నుంచి సమాధానం రాలేదు.");
      }

      return answer.trim();
    } catch (error) {
      if (error.name === "AbortError") {
        throw new Error("API స్పందించడానికి ఎక్కువ సమయం పట్టింది.");
      }

      if (error instanceof TypeError) {
        throw new Error(
          "API కనెక్ట్ కాలేదు. ఇంటర్నెట్, API URL, CORS సెట్టింగ్స్ తనిఖీ చేయండి."
        );
      }

      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  function localCommand(text) {
    const q = text.trim();

    if (/^(hi|hello|hey|హాయ్|హలో|నమస్కారం)[!. ]*$/i.test(q)) {
      return "హలో! నేను JARVIS. నీకు ఏం సహాయం చేయాలి?";
    }

    if (/(what time|current time|సమయం ఎంత|టైం ఎంత)/i.test(q)) {
      return "ఇప్పుడు సమయం " +
        new Intl.DateTimeFormat("te-IN", {
          hour: "numeric",
          minute: "2-digit"
        }).format(new Date()) + ".";
    }

    if (/(what date|today date|ఈ రోజు తేదీ|తేదీ ఎంత)/i.test(q)) {
      return "ఈ రోజు " +
        new Intl.DateTimeFormat("te-IN", { dateStyle: "full" }).format(new Date());
    }

    const math = q.match(/^(?:calculate|లెక్కించు)\s+([\d+\-*/().%\s]+)$/i);

    if (math) {
      try {
        const expression = math[1];

        if (!/^[\d+\-*/().%\s]+$/.test(expression)) {
          return null;
        }

        const result = Function('"use strict"; return (' + expression + ")")();

        if (Number.isFinite(result)) return "ఫలితం: " + result;
      } catch {
        return "లెక్కను అర్థం చేసుకోలేకపోయాను.";
      }
    }

    const search = q.match(/^(?:search|వెతుకు|సెర్చ్)\s+(.+)/i);

    if (search) {
      window.open(
        "https://www.google.com/search?q=" + encodeURIComponent(search[1]),
        "_blank",
        "noopener,noreferrer"
      );
      return "సెర్చ్ ఫలితాల కోసం బ్రౌజర్ తెరిచాను.";
    }

    if (/(open youtube|యూట్యూబ్ ఓపెన్)/i.test(q)) {
      window.open("https://www.youtube.com/", "_blank", "noopener,noreferrer");
      return "YouTube తెరవడానికి ప్రయత్నించాను.";
    }

    if (/(open google|గూగుల్ ఓపెన్)/i.test(q)) {
      window.open("https://www.google.com/", "_blank", "noopener,noreferrer");
      return "Google తెరవడానికి ప్రయత్నించాను.";
    }

    return null;
  }

  async function handleInput(value) {
    const text = String(value || "").trim();
    if (!text || busy) return;

    busy = true;

    if ($("userInput")) $("userInput").value = "";

    addMessage("user", text);
    showTyping(true);
    status("JARVIS ఆలోచిస్తోంది...");

    try {
      let answer = localCommand(text);

      if (answer === null) {
        answer = await callAI();
      }

      addMessage("assistant", answer);
      status("సమాధానం వచ్చింది.");

      // Automatically speak every answer when enabled.
      if (autoVoice) speak(answer);
    } catch (error) {
      const message = error.message || "తెలియని సమస్య వచ్చింది.";
      addMessage("assistant", "క్షమించండి: " + message);
      status(message);
    } finally {
      showTyping(false);
      busy = false;
    }
  }

  function setupVoice() {
    const button = $("micBtn");
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!button) return;

    if (!SpeechRecognition) {
      status("ఈ బ్రౌజర్‌లో వాయిస్ ఇన్‌పుట్ అందుబాటులో లేదు.");
      return;
    }

    recognition = new SpeechRecognition();
    recognition.lang = "te-IN";
    recognition.continuous = false;
    recognition.interimResults = true;

    recognition.onstart = () => {
      button.classList.add("listening");
      status("🎙️ వింటున్నాను... మాట్లాడండి.");
    };

    recognition.onresult = (event) => {
      let transcript = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }

      if ($("userInput")) $("userInput").value = transcript;

      const last = event.results[event.results.length - 1];

      if (last?.isFinal) handleInput(transcript);
    };

    recognition.onerror = (event) => {
      status("మైక్ సమస్య: " + event.error);
    };

    recognition.onend = () => button.classList.remove("listening");

    button.addEventListener("click", () => {
      try {
        recognition.start();
      } catch {
        status("మైక్ ఇప్పటికే ప్రారంభమై ఉంది. కొద్దిసేపటి తర్వాత ప్రయత్నించండి.");
      }
    });
  }

  function setupSettings() {
    const dialog = $("settingsDialog");
    const form = $("settingsForm");

    $("settingsBtn")?.addEventListener("click", openSettings);

    $("closeSettingsBtn")?.addEventListener("click", () => {
      if (dialog?.open) dialog.close();
    });

    form?.addEventListener("submit", (event) => {
      event.preventDefault();

      const api = $("apiKey")?.value.trim() || "";
      const url = $("apiUrl")?.value.trim() || DEFAULT_URL;
      const model = $("modelName")?.value.trim() || DEFAULT_MODEL;

      let parsed;

      try {
        parsed = new URL(url);
      } catch {
        status("సరైన API URL నమోదు చేయండి.");
        return;
      }

      if (parsed.protocol !== "https:" && parsed.hostname !== "localhost") {
        status("API URL HTTPS అయి ఉండాలి.");
        return;
      }

      if (!api) {
        status("API key ఖాళీగా ఉంది. కీ పేస్ట్ చేయండి.");
        return;
      }

      localStorage.setItem(KEYS.api, api);
      localStorage.setItem(KEYS.url, url);
      localStorage.setItem(KEYS.model, model);

      if (dialog?.open) dialog.close();

      status("API సెట్టింగ్స్ సేవ్ అయ్యాయి. ఒక ప్రశ్న అడిగి పరీక్షించండి.");
    });

    $("removeKeyBtn")?.addEventListener("click", () => {
      localStorage.removeItem(KEYS.api);
      if ($("apiKey")) $("apiKey").value = "";
      status("API key తొలగించబడింది.");
    });
  }

  function setupControls() {
    $("chatForm")?.addEventListener("submit", (event) => {
      event.preventDefault();
      handleInput($("userInput")?.value || "");
    });

    $("clearBtn")?.addEventListener("click", () => {
      history = [];
      lastAnswer = "";
      saveHistory();
      $("messages")?.replaceChildren();
      status("చాట్ క్లియర్ అయింది.");
    });

    $("speakBtn")?.addEventListener("click", () => {
      if (lastAnswer) speak(lastAnswer);
      else status("ముందుగా ఒక ప్రశ్న అడగండి.");
    });

    $("stopSpeakBtn")?.addEventListener("click", stopSpeaking);

    $("searchBtn")?.addEventListener("click", () => {
      const query = $("userInput")?.value.trim();
      if (query) handleInput("search " + query);
      else status("వెతకాల్సిన విషయం టైప్ చేయండి.");
    });

    $("timerBtn")?.addEventListener("click", () => {
      const input = prompt("ఎన్ని నిమిషాల టైమర్ కావాలి?");
      if (input === null) return;

      const minutes = Number(input);

      if (!Number.isFinite(minutes) || minutes <= 0 || minutes > 1440) {
        status("1 నుంచి 1440 నిమిషాల మధ్య ఇవ్వండి.");
        return;
      }

      const endTime = Date.now() + minutes * 60000;

      const tick = () => {
        const remaining = Math.max(0, Math.ceil((endTime - Date.now()) / 1000));

        status(
          "టైమర్: " +
          Math.floor(remaining / 60) +
          " నిమిషాలు " +
          (remaining % 60) +
          " సెకన్లు"
        );

        if (remaining <= 0) {
          clearInterval(timerHandle);
          timerHandle = null;
          status("టైమర్ పూర్తయింది!");
          speak("మీ టైమర్ పూర్తయింది.");
        }
      };

      if (timerHandle) clearInterval(timerHandle);
      tick();
      timerHandle = setInterval(tick, 1000);
    });

    $("calcBtn")?.addEventListener("click", () => {
      const expression = prompt("లెక్క నమోదు చేయండి. ఉదా: 12 * 8");
      if (expression === null) return;

      if (!/^[\d+\-*/().%\s]+$/.test(expression)) {
        status("సరైన లెక్క నమోదు చేయండి.");
        return;
      }

      try {
        const result = Function('"use strict"; return (' + expression + ")")();
        if (!Number.isFinite(result)) throw new Error();

        addMessage("assistant", "ఫలితం: " + result);
        if (autoVoice) speak("ఫలితం " + result);
      } catch {
        status("లెక్కను పరిష్కరించలేకపోయాను.");
      }
    });

    $("weatherBtn")?.addEventListener("click", () => {
      handleInput("వాతావరణం ఎలా ఉంది?");
    });

    $("musicBtn")?.addEventListener("click", () => {
      const query = prompt("ఏ పాటను వెతకాలి?");
      if (query?.trim()) {
        window.open(
          "https://www.youtube.com/results?search_query=" + encodeURIComponent(query),
          "_blank",
          "noopener,noreferrer"
        );
      }
    });

    $("filesBtn")?.addEventListener("click", () => $("filePicker")?.click());

    $("filePicker")?.addEventListener("change", (event) => {
      const files = Array.from(event.target.files || []);

      if (!files.length) return;

      addMessage(
        "assistant",
        "ఎంచుకున్న ఫైళ్లు:\n" +
        files.map((file) => file.name + " (" + Math.round(file.size / 1024) + " KB)").join("\n")
      );

      status("ఫైళ్లు ఎంచుకోబడ్డాయి. ఫైల్ కంటెంట్ చదవడం ప్రత్యేక ఫీచర్.");
    });

    // Optional auto-voice switch, if added to index.html.
    $("autoVoiceToggle")?.addEventListener("change", (event) => {
      autoVoice = Boolean(event.target.checked);
      localStorage.setItem(KEYS.voice, String(autoVoice));
      status(autoVoice ? "ఆటో వాయిస్ ఆన్." : "ఆటో వాయిస్ ఆఫ్.");
    });
  }

  function setupClock() {
    const update = () => {
      const now = new Date();

      if ($("clock")) {
        $("clock").textContent = new Intl.DateTimeFormat("en-IN", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit"
        }).format(now);
      }

      if ($("dateLine")) {
        $("dateLine").textContent = new Intl.DateTimeFormat("en-IN", {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric"
        }).format(now);
      }
    };

    update();
    setInterval(update, 1000);
  }

  function init() {
    renderHistory();
    setupClock();
    setupSettings();
    setupControls();
    setupVoice();

    if ("speechSynthesis" in window) {
      window.speechSynthesis.getVoices();
    }

    if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
      navigator.serviceWorker.register("./sw.js").catch((error) => {
        console.warn("Service worker registration failed:", error);
      });
    }

    status(
      settings().api
        ? "JARVIS సిద్ధంగా ఉంది. ప్రశ్న అడగండి."
        : "JARVIS సిద్ధంగా ఉంది. AI కోసం Settings‌లో API key నమోదు చేయండి."
    );
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
