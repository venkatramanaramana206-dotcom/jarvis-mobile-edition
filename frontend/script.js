
/* JARVIS Mobile Edition — frontend/script.js */
"use strict";

(() => {
  const $ = (id) => document.getElementById(id);

  const STORE = {
    key: "jarvis_api_key",
    url: "jarvis_api_url",
    model: "jarvis_model",
    history: "jarvis_chat_history"
  };

  const DEFAULT_URL = "https://api.openai.com/v1/chat/completions";
  const DEFAULT_MODEL = "gpt-4o-mini";

  let busy = false;
  let recognition = null;
  let timerHandle = null;
  let lastAnswer = "";
  let history = readHistory();

  function readHistory() {
    try {
      const data = JSON.parse(
        localStorage.getItem(STORE.history) || "[]"
      );

      return Array.isArray(data)
        ? data.filter(
            (item) =>
              item &&
              ["user", "assistant"].includes(item.role) &&
              typeof item.content === "string"
          ).slice(-30)
        : [];
    } catch {
      return [];
    }
  }

  function saveHistory() {
    try {
      localStorage.setItem(
        STORE.history,
        JSON.stringify(history.slice(-30))
      );
    } catch (error) {
      console.warn("Could not save chat history.", error);
    }
  }

  function getSettings() {
    return {
      key: localStorage.getItem(STORE.key) || "",
      url: localStorage.getItem(STORE.url) || DEFAULT_URL,
      model: localStorage.getItem(STORE.model) || DEFAULT_MODEL
    };
  }

  function setStatus(message) {
    const element = $("voiceStatus");
    if (element) element.textContent = message;
  }

  function showTyping(show) {
    const element = $("typing");
    if (element) element.hidden = !show;
  }

  function renderMessage(role, content) {
    const container = $("messages");

    if (!container) {
      console.log(role + ": " + content);
      return;
    }

    const wrapper = document.createElement("div");
    wrapper.className =
      "message " +
      (role === "user" ? "user-message" : "assistant-message");

    const label = document.createElement("strong");
    label.textContent = role === "user" ? "YOU" : "JARVIS";

    const text = document.createElement("div");
    text.className = "message-content";
    text.textContent = content;

    wrapper.append(label, text);
    container.appendChild(wrapper);
    container.scrollTop = container.scrollHeight;
  }

  function addMessage(role, content) {
    history.push({ role, content });
    history = history.slice(-30);
    saveHistory();
    renderMessage(role, content);

    if (role === "assistant") {
      lastAnswer = content;
    }
  }

  function renderHistory() {
    const container = $("messages");
    if (!container) return;

    container.replaceChildren();

    history.forEach((item) => {
      renderMessage(item.role, item.content);
    });

    if (history.length) {
      lastAnswer =
        [...history].reverse().find((item) => item.role === "assistant")
          ?.content || "";
    }
  }

  function speak(text) {
    if (!("speechSynthesis" in window)) {
      setStatus("ఈ బ్రౌజర్‌లో వాయిస్ సమాధానాలు అందుబాటులో లేవు.");
      return;
    }

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(
      String(text).slice(0, 4000)
    );

    utterance.lang = "te-IN";
    utterance.rate = 1;

    utterance.onstart = () => setStatus("JARVIS మాట్లాడుతోంది...");
    utterance.onend = () => setStatus("సిద్ధంగా ఉంది.");
    utterance.onerror = () => setStatus("వాయిస్ ప్లే చేయలేకపోయాను.");

    window.speechSynthesis.speak(utterance);
  }

  function stopSpeaking() {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }

    setStatus("వాయిస్ ఆపబడింది.");
  }

  function openSettings() {
    const dialog = $("settingsDialog");
    const settings = getSettings();

    if ($("apiKey")) $("apiKey").value = settings.key;
    if ($("apiUrl")) $("apiUrl").value = settings.url;
    if ($("modelName")) $("modelName").value = settings.model;

    if (dialog && typeof dialog.showModal === "function") {
      if (!dialog.open) dialog.showModal();
    } else {
      setStatus("Settings‌లో API key నమోదు చేయండి.");
    }
  }

  async function callAI() {
    const settings = getSettings();

    if (!settings.key) {
      openSettings();
      throw new Error(
        "ముందుగా Settings‌లో API key నమోదు చేయండి."
      );
    }

    let endpoint;

    try {
      endpoint = new URL(settings.url);
    } catch {
      throw new Error("API URL సరైనది కాదు.");
    }

    if (
      endpoint.protocol !== "https:" &&
      endpoint.hostname !== "localhost"
    ) {
      throw new Error("భద్రత కోసం HTTPS API URL ఉపయోగించండి.");
    }

    const conversation = [
      {
        role: "system",
        content:
          "You are JARVIS, a helpful personal AI assistant. " +
          "Understand Telugu and English. Reply in the user's language. " +
          "Answer questions clearly and help with tasks. " +
          "Never claim a device action was completed unless it actually was. " +
          "Explain honestly when a task needs permissions or integrations " +
          "that are not available."
      },
      ...history.slice(-16).map((item) => ({
        role: item.role,
        content: item.content
      }))
    ];

    const controller = new AbortController();

    const timeoutId = setTimeout(() => {
      controller.abort();
    }, 45000);

    try {
      const response = await fetch(endpoint.href, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer " + settings.key
        },
        body: JSON.stringify({
          model: settings.model,
          messages: conversation,
          temperature: 0.7
        }),
        signal: controller.signal
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data?.error?.message ||
          "API లోపం (HTTP " + response.status + ")"
        );
      }

      const answer = data?.choices?.[0]?.message?.content;

      if (typeof answer !== "string" || !answer.trim()) {
        throw new Error("AI నుంచి సమాధానం రాలేదు.");
      }

      return answer.trim();
    } catch (error) {
      if (error.name === "AbortError") {
        throw new Error(
          "AI స్పందించడానికి ఎక్కువ సమయం పట్టింది. మళ్లీ ప్రయత్నించండి."
        );
      }

      if (error instanceof TypeError) {
        throw new Error(
          "API కనెక్షన్ విఫలమైంది. ఇంటర్నెట్, API URL, CORS సెట్టింగ్స్ తనిఖీ చేయండి."
        );
      }

      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  function calculate(expression) {
    const normalized = expression
      .replace(/,/g, "")
      .replace(/[×x]/gi, "*")
      .replace(/÷/g, "/");

    if (!/^[\d+\-*/().%\s]+$/.test(normalized)) {
      return null;
    }

    if (normalized.length > 100) return null;

    try {
      const result = Function(
        '"use strict"; return (' + normalized + ");"
      )();

      return typeof result === "number" && Number.isFinite(result)
        ? String(result)
        : "ఈ లెక్కకు సరైన ఫలితం లేదు.";
    } catch {
      return null;
    }
  }

  function startTimer(seconds) {
    if (
      !Number.isFinite(seconds) ||
      seconds < 1 ||
      seconds > 86400
    ) {
      return "టైమర్ 1 సెకను నుంచి 24 గంటల మధ్య ఉండాలి.";
    }

    if (timerHandle) clearInterval(timerHandle);

    const endTime = Date.now() + seconds * 1000;

    const tick = () => {
      const remaining = Math.max(
        0,
        Math.ceil((endTime - Date.now()) / 1000)
      );

      setStatus(
        "టైమర్: " +
        Math.floor(remaining / 60) +
        " నిమిషాలు " +
        (remaining % 60) +
        " సెకన్లు"
      );

      if (remaining <= 0) {
        clearInterval(timerHandle);
        timerHandle = null;
        setStatus("టైమర్ పూర్తయింది!");
        speak("మీ టైమర్ పూర్తయింది.");
      }
    };

    tick();
    timerHandle = setInterval(tick, 500);

    return Math.ceil(seconds / 60) +
      " నిమిషాల టైమర్ ప్రారంభించాను.";
  }

  async function getWeather() {
    if (!navigator.geolocation) {
      throw new Error("ఈ పరికరంలో లొకేషన్ అందుబాటులో లేదు.");
    }

    const position = await new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: false,
        timeout: 10000,
        maximumAge: 300000
      });
    });

    const latitude = position.coords.latitude;
    const longitude = position.coords.longitude;

    const url =
      "https://api.open-meteo.com/v1/forecast" +
      "?latitude=" + encodeURIComponent(latitude) +
      "&longitude=" + encodeURIComponent(longitude) +
      "&current=temperature_2m,relative_humidity_2m,apparent_temperature" +
      "&timezone=auto";

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error("వాతావరణ సమాచారం పొందలేకపోయాను.");
    }

    const data = await response.json();
    const current = data.current;

    return (
      "ప్రస్తుత ఉష్ణోగ్రత " + current.temperature_2m + "°C. " +
      "అనుభూతి ఉష్ణోగ్రత " + current.apparent_temperature + "°C. " +
      "తేమ " + current.relative_humidity_2m + "%."
    );
  }

  function webSearch(query) {
    const url =
      "https://www.google.com/search?q=" +
      encodeURIComponent(query);

    window.open(url, "_blank", "noopener,noreferrer");

    return "వెబ్ సెర్చ్ తెరవడానికి ప్రయత్నించాను. ఫలితాలను బ్రౌజర్‌లో చూడండి.";
  }

  function localCommand(text) {
    const query = text.trim();

    if (/^(hi|hello|hey|హాయ్|హలో|నమస్కారం)[!. ]*$/i.test(query)) {
      return "హలో! నేను JARVIS. నీకు ఏం సహాయం చేయాలి?";
    }

    if (/(what time|current time|సమయం ఎంత|టైం ఎంత)/i.test(query)) {
      return "ఇప్పుడు సమయం " +
        new Intl.DateTimeFormat("te-IN", {
          hour: "numeric",
          minute: "2-digit"
        }).format(new Date()) + ".";
    }

    if (/(what date|today date|today's date|ఈ రోజు తేదీ|తేదీ ఎంత)/i.test(query)) {
      return "ఈ రోజు " +
        new Intl.DateTimeFormat("te-IN", {
          dateStyle: "full"
        }).format(new Date()) + ".";
    }

    const calculationMatch = query.match(
      /^(?:calculate|లెక్కించు|క్యాలిక్యులేట్)\s+(.+)$/i
    );

    if (calculationMatch) {
      const result = calculate(calculationMatch[1]);
      if (result !== null) return "ఫలితం: " + result;
    }

    if (/^[\d(].*[\d)]$/.test(query)) {
      const result = calculate(query);
      if (result !== null) return "ఫలితం: " + result;
    }

    const timerMatch = query.match(
      /(?:timer|టైమర్)\s*(?:for|కు)?\s*(\d+)\s*(seconds?|secs?|minutes?|mins?|hours?|సెకన్లు|నిమిషాలు|గంటలు)?/i
    );

    if (timerMatch) {
      const amount = Number(timerMatch[1]);
      const unit = (timerMatch[2] || "minutes").toLowerCase();

      let seconds = amount;

      if (/hour|గంట/.test(unit)) seconds *= 3600;
      else if (/minute|min|నిమిష/.test(unit)) seconds *= 60;

      return startTimer(seconds);
    }

    if (/(weather|వాతావరణం)/i.test(query)) {
      return "__WEATHER__";
    }

    const searchMatch = query.match(
      /^(?:search|వెతుకు|సెర్చ్)\s+(.+)/i
    );

    if (searchMatch) return webSearch(searchMatch[1]);

    if (/(open youtube|యూట్యూబ్ ఓపెన్)/i.test(query)) {
      window.open(
        "https://www.youtube.com/",
        "_blank",
        "noopener,noreferrer"
      );
      return "YouTube తెరవడానికి ప్రయత్నించాను.";
    }

    if (/(open google|గూగుల్ ఓపెన్)/i.test(query)) {
      window.open(
        "https://www.google.com/",
        "_blank",
        "noopener,noreferrer"
      );
      return "Google తెరవడానికి ప్రయత్నించాను.";
    }

    if (/(stop speaking|మాట్లాడటం ఆపు|వాయిస్ ఆపు)/i.test(query)) {
      stopSpeaking();
      return "వాయిస్ ఆపాను.";
    }

    if (/(generate password|పాస్‌వర్డ్ తయారు|పాస్వర్డ్ తయారు)/i.test(query)) {
      const alphabet =
        "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*";

      const bytes = new Uint8Array(18);
      crypto.getRandomValues(bytes);

      const password = Array.from(
        bytes,
        (byte) => alphabet[byte % alphabet.length]
      ).join("");

      return "పాస్‌వర్డ్: " + password +
        "\nదీన్ని సురక్షితమైన పాస్‌వర్డ్ మేనేజర్‌లో సేవ్ చేసుకోండి.";
    }

    return null;
  }

  async function handleInput(rawText) {
    const text = String(rawText || "").trim();

    if (!text || busy) return;

    busy = true;

    if ($("userInput")) $("userInput").value = "";

    addMessage("user", text);
    showTyping(true);

    try {
      let answer = localCommand(text);

      if (answer === "__WEATHER__") {
        try {
          answer = await getWeather();
        } catch (error) {
          answer = error.code === 1
            ? "వాతావరణం తెలుసుకోవడానికి లొకేషన్ అనుమతి ఇవ్వాలి."
            : (error.message || "వాతావరణ సమాచారం అందుబాటులో లేదు.");
        }
      } else if (answer === null) {
        answer = await callAI();
      }

      addMessage("assistant", answer);
    } catch (error) {
      const message = error.message || "తెలియని సమస్య వచ్చింది.";
      addMessage("assistant", "క్షమించు: " + message);
      setStatus(message);
    } finally {
      showTyping(false);
      busy = false;
    }
  }

  function setupVoice() {
    const button = $("micBtn");

    const SpeechRecognition =
      window.SpeechRecognition ||
      window.webkitSpeechRecognition;

    if (!button) return;

    if (!SpeechRecognition) {
      button.title =
        "ఈ బ్రౌజర్‌లో వాయిస్ రికగ్నిషన్ అందుబాటులో లేదు.";
      return;
    }

    recognition = new SpeechRecognition();
    recognition.lang = "te-IN";
    recognition.continuous = false;
    recognition.interimResults = true;

    recognition.onstart = () => {
      button.classList.add("listening");
      setStatus("వింటున్నాను... మాట్లాడండి.");
    };

    recognition.onresult = (event) => {
      let transcript = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }

      if ($("userInput")) {
        $("userInput").value = transcript;
      }

      const last = event.results[event.results.length - 1];

      if (last && last.isFinal) {
        handleInput(transcript);
      }
    };

    recognition.onerror = (event) => {
      setStatus("మైక్రోఫోన్ సమస్య: " + event.error);
    };

    recognition.onend = () => {
      button.classList.remove("listening");
    };

    button.addEventListener("click", () => {
      try {
        recognition.start();
      } catch {
        setStatus("వాయిస్ రికగ్నిషన్ ఇప్పటికే ప్రారంభమై ఉండవచ్చు.");
      }
    });
  }

  function setupSettings() {
    const dialog = $("settingsDialog");
    const form = $("settingsForm");

    if ($("settingsBtn")) {
      $("settingsBtn").addEventListener("click", openSettings);
    }

    if ($("closeSettingsBtn")) {
      $("closeSettingsBtn").addEventListener("click", () => {
        if (dialog && dialog.open) dialog.close();
      });
    }

    if (form) {
      form.addEventListener("submit", (event) => {
        event.preventDefault();

        const key = $("apiKey")?.value.trim() || "";
        const url = $("apiUrl")?.value.trim() || DEFAULT_URL;
        const model = $("modelName")?.value.trim() || DEFAULT_MODEL;

        let parsed;

        try {
          parsed = new URL(url);
        } catch {
          setStatus("సరైన API URL నమోదు చేయండి.");
          return;
        }

        if (
          parsed.protocol !== "https:" &&
          parsed.hostname !== "localhost"
        ) {
          setStatus("HTTPS API URL ఉపయోగించండి.");
          return;
        }

        if (key) {
          localStorage.setItem(STORE.key, key);
        } else {
          localStorage.removeItem(STORE.key);
        }

        localStorage.setItem(STORE.url, url);
        localStorage.setItem(STORE.model, model);

        if (dialog && dialog.open) dialog.close();

        setStatus("Settings సేవ్ అయ్యాయి.");
      });
    }

    if ($("removeKeyBtn")) {
      $("removeKeyBtn").addEventListener("click", () => {
        localStorage.removeItem(STORE.key);
        if ($("apiKey")) $("apiKey").value = "";
        setStatus("API key తొలగించబడింది.");
      });
    }
  }

  function setupControls() {
    const form = $("chatForm");

    if (form) {
      form.addEventListener("submit", (event) => {
        event.preventDefault();
        handleInput($("userInput")?.value || "");
      });
    }

    if ($("clearBtn")) {
      $("clearBtn").addEventListener("click", () => {
        history = [];
        lastAnswer = "";
        saveHistory();

        if ($("messages")) $("messages").replaceChildren();

        setStatus("చాట్ హిస్టరీ క్లియర్ అయింది.");
      });
    }

    if ($("speakBtn")) {
      $("speakBtn").addEventListener("click", () => {
        if (lastAnswer) speak(lastAnswer);
        else setStatus("ముందుగా JARVIS సమాధానం పొందండి.");
      });
    }

    if ($("stopSpeakBtn")) {
      $("stopSpeakBtn").addEventListener("click", stopSpeaking);
    }

    if ($("searchBtn")) {
      $("searchBtn").addEventListener("click", () => {
        const query = $("userInput")?.value.trim();

        if (query) webSearch(query);
        else setStatus("వెతకాల్సిన విషయం టైప్ చేయండి.");
      });
    }

    if ($("weatherBtn")) {
      $("weatherBtn").addEventListener("click", async () => {
        try {
          addMessage("assistant", await getWeather());
        } catch (error) {
          setStatus(error.message || "వాతావరణ సమాచారం అందుబాటులో లేదు.");
        }
      });
    }

    if ($("timerBtn")) {
      $("timerBtn").addEventListener("click", () => {
        const value = window.prompt("ఎన్ని నిమిషాల టైమర్ కావాలి?");
        if (value === null) return;

        const answer = startTimer(Number(value) * 60);
        addMessage("assistant", answer);
        setStatus(answer);
      });
    }

    if ($("calcBtn")) {
      $("calcBtn").addEventListener("click", () => {
        const expression = window.prompt(
          "లెక్కను నమోదు చేయండి (ఉదా: 12 * 8):"
        );

        if (expression === null) return;

        const result = calculate(expression);

        addMessage(
          "assistant",
          result === null
            ? "ఈ లెక్కను అర్థం చేసుకోలేకపోయాను."
            : "ఫలితం: " + result
        );
      });
    }

    if ($("passwordBtn")) {
      $("passwordBtn").addEventListener("click", () => {
        const alphabet =
          "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*";

        const bytes = new Uint8Array(18);
        crypto.getRandomValues(bytes);

        addMessage(
          "assistant",
          "తయారు చేసిన పాస్‌వర్డ్: " +
          Array.from(
            bytes,
            (byte) => alphabet[byte % alphabet.length]
          ).join("")
        );
      });
    }

    if ($("musicBtn")) {
      $("musicBtn").addEventListener("click", () => {
        const query = window.prompt("ఏ పాట లేదా కళాకారుడిని వెతకాలి?");

        if (query && query.trim()) {
          window.open(
            "https://www.youtube.com/results?search_query=" +
              encodeURIComponent(query),
            "_blank",
            "noopener,noreferrer"
          );
        }
      });
    }

    if ($("filesBtn") && $("filePicker")) {
      $("filesBtn").addEventListener("click", () => {
        $("filePicker").click();
      });

      $("filePicker").addEventListener("change", (event) => {
        const files = Array.from(event.target.files || []);

        if (!files.length) return;

        const names = files.map(
          (file) =>
            file.name + " (" + Math.round(file.size / 1024) + " KB)"
        ).join("\n");

        addMessage("assistant", "ఎంచుకున్న ఫైళ్లు:\n" + names);

        setStatus(
          "ఫైళ్లు ఎంచుకోబడ్డాయి. వాటి కంటెంట్ చదవడానికి ప్రత్యేక కోడ్ అవసరం."
        );
      });
    }
  }

  function setupClock() {
    const update = () => {
      const now = new Date();

      if ($("clock")) {
        $("clock").textContent = new Intl.DateTimeFormat("en-IN", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: true
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

    if (
      "serviceWorker" in navigator &&
      location.protocol.startsWith("http")
    ) {
      navigator.serviceWorker.register("./sw.js").catch((error) => {
        console.warn("Service worker registration failed.", error);
      });
    }

    setStatus(
      getSettings().key
        ? "JARVIS సిద్ధంగా ఉంది. మీ ప్రశ్న అడగండి."
        : "సిద్ధంగా ఉంది. AI సమాధానాల కోసం Settings‌లో API key నమోదు చేయండి."
    );
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
