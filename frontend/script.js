 "use strict";

(() => {
  // ==========================================
  // JARVIS AI ASSISTANT
  // ==========================================

  const $ = (id) => document.getElementById(id);

  const messages = $("messages");
  const input = $("userInput");
  const typing = $("typing");
  const dialog = $("settingsDialog");
  const toolOutput = $("toolOutput");

  let lastReply = "Hello! I am Jarvis AI Assistant.";
  let chatHistory = [];
  let timerHandle = null;
  let recognition = null;

  // ==========================================
  // CLOCK AND DATE
  // ==========================================

  function updateClock() {
    const now = new Date();

    if ($("clock")) {
      $("clock").textContent = now.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false
      });
    }

    if ($("dateLine")) {
      $("dateLine").textContent = now.toLocaleDateString([], {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric"
      });
    }
  }

  updateClock();
  setInterval(updateClock, 1000);

  // ==========================================
  // CHAT MESSAGE DISPLAY
  // ==========================================

  function addMessage(text, sender = "assistant") {
    const article = document.createElement("article");
    article.className = `message ${sender}`;

    const avatar = document.createElement("div");
    avatar.className = "avatar";
    avatar.textContent = sender === "assistant" ? "J" : "YOU";

    const bubble = document.createElement("div");
    bubble.className = "bubble";

    // Use textContent to prevent HTML injection.
    bubble.textContent = String(text);

    article.append(avatar, bubble);
    messages.appendChild(article);

    messages.scrollTop = messages.scrollHeight;

    if (sender === "assistant") {
      lastReply = String(text);
    }
  }

  function showTool(text) {
    toolOutput.hidden = false;
    toolOutput.textContent = String(text);
  }

  // ==========================================
  // API SETTINGS
  // ==========================================

  function getApiKey() {
    return sessionStorage.getItem("jarvis_api_key") || "";
  }

  function getApiEndpoint() {
    return $("apiUrl").value.trim() ||
      "https://api.openai.com/v1/chat/completions";
  }

  function getModel() {
    return $("modelName").value.trim() || "gpt-4o-mini";
  }

  $("settingsBtn").addEventListener("click", () => {
    $("apiKey").value = getApiKey();
    dialog.showModal();
  });

  $("closeSettingsBtn").addEventListener("click", () => {
    dialog.close();
  });

  $("settingsForm").addEventListener("submit", (event) => {
    event.preventDefault();

    const key = $("apiKey").value.trim();

    if (key) {
      sessionStorage.setItem("jarvis_api_key", key);
      addMessage("AI settings saved for this browser tab.");
    } else {
      sessionStorage.removeItem("jarvis_api_key");
      addMessage("No API key saved. Local tools are still available.");
    }

    dialog.close();
  });

  $("removeKeyBtn").addEventListener("click", () => {
    sessionStorage.removeItem("jarvis_api_key");
    $("apiKey").value = "";

    addMessage("Your API key has been removed from this browser tab.");
  });

  // ==========================================
  // AI CHAT REQUEST
  // ==========================================

  async function askAI(userText) {
    const apiKey = getApiKey();

    if (!apiKey) {
      addMessage(
        "Please open Settings ⚙ and enter your AI API key. " +
        "Local tools such as the clock, calculator, timer and web search " +
        "can work without an AI key."
      );
      return;
    }

    const endpoint = getApiEndpoint();

    let parsedUrl;

    try {
      parsedUrl = new URL(endpoint);
    } catch {
      addMessage("The API endpoint URL is invalid. Please check Settings.");
      return;
    }

    if (parsedUrl.protocol !== "https:") {
      addMessage("For security, the API endpoint must use HTTPS.");
      return;
    }

    if (typing) typing.hidden = false;

    const previousHistory = chatHistory.slice();

    chatHistory.push({
      role: "user",
      content: userText
    });

    // Keep the request reasonably small.
    if (chatHistory.length > 16) {
      chatHistory = chatHistory.slice(-16);
    }

    try {
      const response = await fetch(endpoint, {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
        },

        body: JSON.stringify({
          model: getModel(),

          messages: [
            {
              role: "system",
              content:
                "You are JARVIS, a helpful and friendly AI assistant. " +
                "Give accurate, clear and useful answers. " +
                "If the user writes in Telugu, reply in Telugu. " +
                "Do not claim to have performed actions that you did not perform."
            },
            ...chatHistory
          ],

          temperature: 0.7
        })
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data.error?.message ||
          `API request failed with status ${response.status}`
        );
      }

      const answer = data.choices?.[0]?.message?.content;

      if (typeof answer !== "string" || !answer.trim()) {
        throw new Error("No answer returned by the AI provider.");
      }

      chatHistory.push({
        role: "assistant",
        content: answer
      });

      addMessage(answer);
    } catch (error) {
      chatHistory = previousHistory;

      addMessage(
        "AI connection failed: " + error.message +
        "\n\nCheck your internet connection, API key, model name, " +
        "endpoint URL and provider CORS settings."
      );
    } finally {
      if (typing) typing.hidden = true;
    }
  }

  // ==========================================
  // LOCAL COMMANDS
  // ==========================================

  function handleLocalCommand(text) {
    const q = text.trim();
    const lower = q.toLowerCase();

    if (/^(hi|hello|hey|namaste)\b/i.test(q)) {
      return "Hello! I am Jarvis. How can I help you?";
    }

    if (/\b(time|date|today)\b/i.test(lower)) {
      return "Your local date and time is " +
        new Date().toLocaleString() + ".";
    }

    if (/\b(joke|funny)\b/i.test(lower)) {
      const jokes = [
        "Why did the computer go to the doctor? It had a virus!",
        "Why do programmers like dark mode? Because light attracts bugs!",
        "What did the Wi-Fi say to the phone? I feel a connection!"
      ];

      return jokes[Math.floor(Math.random() * jokes.length)];
    }

    if (/\b(quote|motivation|inspiration)\b/i.test(lower)) {
      const quotes = [
        "Great things are done by a series of small things brought together.",
        "It always seems impossible until it is done.",
        "The secret of getting ahead is getting started."
      ];

      return quotes[Math.floor(Math.random() * quotes.length)];
    }

    if (/\b(weather|temperature)\b/i.test(lower)) {
      window.open(
        "https://www.google.com/search?q=" +
        encodeURIComponent("weather near me"),
        "_blank",
        "noopener,noreferrer"
      );

      return "I opened a web search for current weather.";
    }

    if (
      /\b(search|google|web search)\b/i.test(lower)
    ) {
      window.open(
        "https://www.google.com/search?q=" +
        encodeURIComponent(q),
        "_blank",
        "noopener,noreferrer"
      );

      return "I opened a web search for: " + q;
    }

    if (/\b(timer)\b/i.test(lower)) {
      startTimer(1);
      return "A one-minute timer has started.";
    }

    if (/\b(password)\b/i.test(lower)) {
      return generatePassword();
    }

    return null;
  }

  // ==========================================
  // CHAT FORM
  // ==========================================

  $("chatForm").addEventListener("submit", async (event) => {
    event.preventDefault();

    const text = input.value.trim();

    if (!text) return;

    input.value = "";

    addMessage(text, "user");

    const localAnswer = handleLocalCommand(text);

    if (localAnswer !== null) {
      addMessage(localAnswer);
      return;
    }

    await askAI(text);
  });

  // ==========================================
  // QUICK ACTION BUTTONS
  // ==========================================

  document.querySelectorAll("[data-command]").forEach((button) => {
    button.addEventListener("click", () => {
      input.value = button.dataset.command;
      $("chatForm").requestSubmit();
    });
  });

  $("clearBtn").addEventListener("click", () => {
    messages.replaceChildren();
    chatHistory = [];

    addMessage("Conversation cleared. How can I help you?");
  });

  // ==========================================
  // WEB SEARCH
  // ==========================================

  $("searchBtn").addEventListener("click", () => {
    const query = prompt("What would you like to search for?");

    if (!query || !query.trim()) return;

    window.open(
      "https://www.google.com/search?q=" +
      encodeURIComponent(query.trim()),
      "_blank",
      "noopener,noreferrer"
    );
  });

  // ==========================================
  // WEATHER SEARCH
  // ==========================================

  $("weatherBtn").addEventListener("click", () => {
    window.open(
      "https://www.google.com/search?q=" +
      encodeURIComponent("weather near me"),
      "_blank",
      "noopener,noreferrer"
    );
  });

  // ==========================================
  // TIMER
  // ==========================================

  function startTimer(minutes = 1) {
    if (timerHandle) {
      clearTimeout(timerHandle);
    }

    const duration = Number(minutes);

    if (!Number.isFinite(duration) ||
        duration < 1 ||
        duration > 180) {
      showTool("Please enter a duration from 1 to 180 minutes.");
      return;
    }

    showTool(`Timer running for ${duration} minute(s).`);

    timerHandle = setTimeout(() => {
      showTool("⏰ Your timer has finished!");

      if ("speechSynthesis" in window) {
        speechSynthesis.speak(
          new SpeechSynthesisUtterance(
            "Your Jarvis timer has finished."
          )
        );
      }

      if (
        "Notification" in window &&
        Notification.permission === "granted"
      ) {
        new Notification("Jarvis Timer", {
          body: "Your timer has finished."
        });
      }
    }, duration * 60 * 1000);
  }

  $("timerBtn").addEventListener("click", () => {
    const value = prompt(
      "Timer duration in minutes (1-180):",
      "1"
    );

    if (value === null) return;

    startTimer(value);
  });

  // ==========================================
  // CALCULATOR
  // ==========================================

  $("calcBtn").addEventListener("click", () => {
    const expression = prompt(
      "Enter a calculation, e.g. (12 + 8) * 3"
    );

    if (!expression || !expression.trim()) return;

    const safeExpression = expression.trim();

    // Only allow numeric arithmetic characters.
    if (!/^[0-9+\-*/%().\s]+$/.test(safeExpression)) {
      showTool(
        "Invalid input. Use numbers, parentheses and basic arithmetic operators only."
      );
      return;
    }

    try {
      const result = Function(
        '"use strict"; return (' + safeExpression + ');'
      )();

      if (!Number.isFinite(result)) {
        throw new Error("Invalid result");
      }

      showTool("Calculation result: " + result);
    } catch {
      showTool("Could not calculate that expression.");
    }
  });

  // ==========================================
  // PASSWORD GENERATOR
  // ==========================================

  function generatePassword() {
    const characters =
      "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*";

    const randomValues = new Uint32Array(18);
    crypto.getRandomValues(randomValues);

    const password = Array.from(
      randomValues,
      value => characters[value % characters.length]
    ).join("");

    showTool("Generated password:\n" + password);

    return "A new password was generated. See the Assistant Tools panel.";
  }

  $("passwordBtn").addEventListener("click", () => {
    generatePassword();
  });

  // ==========================================
  // TEXT TO SPEECH
  // ==========================================

  $("speakBtn").addEventListener("click", () => {
    if (!("speechSynthesis" in window)) {
      showTool("Text-to-speech is not supported in this browser.");
      return;
    }

    speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(lastReply);

    utterance.lang = navigator.language || "en-US";

    speechSynthesis.speak(utterance);
  });

  $("stopSpeakBtn").addEventListener("click", () => {
    if ("speechSynthesis" in window) {
      speechSynthesis.cancel();
    }
  });

  // ==========================================
  // VOICE INPUT
  // ==========================================

  const SpeechRecognition =
    window.SpeechRecognition ||
    window.webkitSpeechRecognition;

  $("micBtn").addEventListener("click", () => {
    if (!SpeechRecognition) {
      $("voiceStatus").textContent =
        "Voice recognition is not supported here. Try Chrome over HTTPS.";
      return;
    }

    recognition = new SpeechRecognition();

    recognition.lang = navigator.language || "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    $("micBtn").classList.add("listening");
    $("voiceStatus").textContent = "Listening... Speak now.";

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;

      input.value = transcript;
      $("chatForm").requestSubmit();
    };

    recognition.onerror = (event) => {
      $("voiceStatus").textContent =
        "Voice input error: " + event.error;
    };

    recognition.onend = () => {
      $("micBtn").classList.remove("listening");
    };

    try {
      recognition.start();
    } catch (error) {
      $("voiceStatus").textContent =
        "Could not start microphone: " + error.message;

      $("micBtn").classList.remove("listening");
    }
  });

  // ==========================================
  // MUSIC SEARCH
  // ==========================================

  $("musicBtn").addEventListener("click", () => {
    const query = prompt("Enter a song or artist name:");

    if (!query || !query.trim()) return;

    window.open(
      "https://www.youtube.com/results?search_query=" +
      encodeURIComponent(query.trim()),
      "_blank",
      "noopener,noreferrer"
    );
  });

  // ==========================================
  // FILE PICKER
  // ==========================================

  $("filesBtn").addEventListener("click", () => {
    $("filePicker").click();
  });

  $("filePicker").addEventListener("change", () => {
    const files = Array.from($("filePicker").files || []);

    if (!files.length) {
      showTool("No files selected.");
      return;
    }

    const summary = files.map((file) => {
      return `${file.name} — ${file.size} bytes`;
    });

    showTool(
      "Selected files:\n" + summary.join("\n") +
      "\n\nThe browser can access only files you choose."
    );
  });

  // ==========================================
  // OPTIONAL SERVICE WORKER
  // ==========================================

  if (
    "serviceWorker" in navigator &&
    location.protocol.startsWith("http")
  ) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js")
        .catch((error) => {
          console.warn("Service worker registration failed:", error);
        });
    });
  }

})();
