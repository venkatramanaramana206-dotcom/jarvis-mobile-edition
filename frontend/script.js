
"use strict";

/* JARVIS Voice AI — Automatic reply + speech */

const $ = (id) => document.getElementById(id);

const KEY = "jarvis_api_key";
const URL_KEY = "jarvis_api_url";
const MODEL_KEY = "jarvis_model";
const VOICE_KEY = "jarvis_auto_voice";

let listening = false;
let processing = false;
let recognition = null;
let speaking = false;
let lastAnswer = "";
let conversation = [];
let restartAfterSpeech = false;
let silenceTimer = null;

const apiKey = () => localStorage.getItem(KEY) || "";
const apiUrl = () =>
  localStorage.getItem(URL_KEY) ||
  "https://api.openai.com/v1/chat/completions";
const model = () =>
  localStorage.getItem(MODEL_KEY) || "gpt-4o-mini";
const autoVoice = () => localStorage.getItem(VOICE_KEY) !== "false";

function status(text) {
  if ($("voiceStatus")) $("voiceStatus").textContent = text;
}

function showThinking(show) {
  if ($("typing")) $("typing").hidden = !show;
}

function safeText(text) {
  return String(text).replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;",
    '"': "&quot;", "'": "&#39;"
  })[c]);
}

function displayMessage(role, text) {
  const area = $("messages");
  if (!area) return;

  const row = document.createElement("div");
  row.className = role === "user"
    ? "message user-message"
    : "message ai-message";

  const heading = document.createElement("strong");
  heading.textContent = role === "user" ? "YOU" : "JARVIS";

  const content = document.createElement("div");
  content.className = "message-content";
  content.innerHTML = safeText(text).replace(/\n/g, "<br>");

  row.append(heading, content);

  if (role === "assistant") {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = " 🔊";
    button.addEventListener("click", () => speak(text, false));
    row.appendChild(button);
  }

  area.appendChild(row);
  area.scrollTop = area.scrollHeight;
}

function detectLanguage(text) {
  if (/[\u0C00-\u0C7F]/.test(text)) return "te-IN";
  if (/[\u0900-\u097F]/.test(text)) return "hi-IN";
  if (/[\u0B80-\u0BFF]/.test(text)) return "ta-IN";
  if (/[\u0C80-\u0CFF]/.test(text)) return "kn-IN";
  return "en-IN";
}

/* Voice output */

function speak(text, resumeListening = false) {
  if (!("speechSynthesis" in window)) {
    status("ఈ బ్రౌజర్‌లో Voice Output అందుబాటులో లేదు.");
    return;
  }

  const answer = String(text || "").trim();
  if (!answer) return;

  restartAfterSpeech = resumeListening;
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(answer);
  utterance.lang = detectLanguage(answer);
  utterance.rate = 0.92;
  utterance.pitch = 1;
  utterance.volume = 1;

  const voices = window.speechSynthesis.getVoices();
  const prefix = utterance.lang.toLowerCase().split("-")[0];

  const voice = voices.find(v =>
    v.lang.toLowerCase() === utterance.lang.toLowerCase()
  ) || voices.find(v =>
    v.lang.toLowerCase().startsWith(prefix)
  );

  if (voice) utterance.voice = voice;

  utterance.onstart = () => {
    speaking = true;
    status("JARVIS మాట్లాడుతోంది...");
  };

  utterance.onend = () => {
    speaking = false;
    status("సమాధానం పూర్తయింది.");

    if (restartAfterSpeech) {
      restartAfterSpeech = false;
      setTimeout(startListening, 450);
    }
  };

  utterance.onerror = (event) => {
    speaking = false;
    console.error("Speech output error:", event.error);
    status("వాయిస్ అందుబాటులో లేదు. Speak బటన్ ప్రయత్నించు.");
  };

  window.speechSynthesis.speak(utterance);
}

/* Send user message to AI */

async function askAI(text) {
  const key = apiKey();

  if (!key) {
    status("ముందుగా Settingsలో API Key సేవ్ చేయి.");
    return "API Key లేదు. Settings తెరిచి నీ API Key సేవ్ చేయి.";
  }

  const messages = [
    {
      role: "system",
      content:
        "You are JARVIS, a friendly personal voice assistant. " +
        "Answer the user's actual request directly, not with generic listening messages. " +
        "Reply in the same language the user speaks. " +
        "For Telugu, use natural Telugu. Be concise when speaking aloud. " +
        "Do not claim to perform real-world actions unless actually performed."
    },
    ...conversation.slice(-16)
  ];

  const response = await fetch(apiUrl(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + key
    },
    body: JSON.stringify({
      model: model(),
      messages,
      temperature: 0.6
    })
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.error?.message || `API error ${response.status}`);
  }

  const answer = data?.choices?.[0]?.message?.content?.trim();
  if (!answer) throw new Error("AI నుంచి సమాధానం రాలేదు.");

  conversation.push(
    { role: "user", content: text },
    { role: "assistant", content: answer }
  );

  conversation = conversation.slice(-20);
  return answer;
}

/* Main conversation flow */

async function sendToJarvis(text, fromVoice = false) {
  text = String(text || "").trim();
  if (!text || processing) return;

  processing = true;
  displayMessage("user", text);

  if ($("userInput")) $("userInput").value = "";

  showThinking(true);
  status("నీ ప్రశ్నకు సమాధానం తయారు చేస్తున్నాను...");

  try {
    const answer = await askAI(text);
    lastAnswer = answer;

    displayMessage("assistant", answer);
    status("JARVIS సిద్ధంగా ఉంది.");

    if (autoVoice()) {
      // Voice conversations resume listening after the answer.
      speak(answer, fromVoice);
    } else if (fromVoice) {
      startListening();
    }
  } catch (error) {
    console.error(error);

    const message =
      "క్షమించు, AIకి కనెక్ట్ కాలేకపోయాను. " +
      "API Key, Model, Internet, API URL తనిఖీ చేయి.";

    displayMessage("assistant", message);
    status("API కనెక్షన్ సమస్య.");

    // Do not repeatedly read error messages aloud.
    if (fromVoice) {
      setTimeout(startListening, 800);
    }
  } finally {
    processing = false;
    showThinking(false);
  }
}

/* Microphone input */

function startListening() {
  if (listening || processing || speaking) return;

  const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    status("Voice Recognition కోసం Android Chrome ప్రయత్నించు.");
    return;
  }

  if (!recognition) {
    recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      listening = true;
      $("micBtn")?.classList.add("listening");
      $("assistantOrb")?.classList.add("listening");
      status("వింటున్నాను... ఇప్పుడు మాట్లాడు.");
    };

    recognition.onresult = (event) => {
      const transcript =
        event.results?.[0]?.[0]?.transcript?.trim();

      if (transcript) {
        listening = false;
        recognition.stop();
        sendToJarvis(transcript, true);
      }
    };

    recognition.onerror = (event) => {
      listening = false;
      $("micBtn")?.classList.remove("listening");
      $("assistantOrb")?.classList.remove("listening");

      if (event.error === "not-allowed") {
        status("Microphone permission ఇవ్వాలి.");
      } else if (event.error === "no-speech") {
        status("మాట వినిపించలేదు. మైక్ నొక్కి మళ్లీ మాట్లాడు.");
      } else {
        status("Microphone సమస్య: " + event.error);
      }
    };

    recognition.onend = () => {
      listening = false;
      $("micBtn")?.classList.remove("listening");
      $("assistantOrb")?.classList.remove("listening");
    };
  }

  // Use Telugu recognition by default.
  // Change this to "en-IN" if you mainly speak English.
  recognition.lang = "te-IN";

  try {
    recognition.start();
  } catch (error) {
    console.warn(error);
    status("మైక్ ప్రారంభం కాలేదు. మళ్లీ నొక్కు.");
  }
}

function stopListening() {
  if (recognition && listening) recognition.stop();
  listening = false;
}

/* Wire up existing page controls */

function initializeJarvisVoice() {
  $("chatForm")?.addEventListener("submit", event => {
    event.preventDefault();
    sendToJarvis($("userInput")?.value || "", false);
  });

  $("micBtn")?.addEventListener("click", () => {
    if (listening) {
      stopListening();
    } else {
      startListening();
    }
  });

  $("speakBtn")?.addEventListener("click", () => {
    if (lastAnswer) speak(lastAnswer, false);
    else status("ముందుగా ఒక ప్రశ్న అడుగు.");
  });

  $("stopSpeakBtn")?.addEventListener("click", () => {
    restartAfterSpeech = false;
    window.speechSynthesis?.cancel();
    speaking = false;
    status("Voice ఆపబడింది.");
  });

  $("settingsBtn")?.addEventListener("click", () => {
    const dialog = $("settingsDialog");
    if (!dialog) return;

    if ($("apiKey")) $("apiKey").value = apiKey();
    if ($("apiUrl")) $("apiUrl").value = apiUrl();
    if ($("modelName")) $("modelName").value = model();

    if (dialog.showModal) {
      if (!dialog.open) dialog.showModal();
    } else {
      dialog.setAttribute("open", "");
    }
  });

  $("closeSettingsBtn")?.addEventListener("click", () => {
    const dialog = $("settingsDialog");
    if (dialog?.close) dialog.close();
    else dialog?.removeAttribute("open");
  });

  $("settingsForm")?.addEventListener("submit", event => {
    event.preventDefault();

    const key = $("apiKey")?.value?.trim();
    const url = $("apiUrl")?.value?.trim();
    const modelName = $("modelName")?.value?.trim();

    if (!key || !url || !modelName) {
      alert("API Key, API URL, Model Name ఇవ్వాలి.");
      return;
    }

    try {
      if (new URL(url).protocol !== "https:") {
        throw new Error("HTTPS required");
      }
    } catch {
      alert("సరైన HTTPS API URL ఇవ్వు.");
      return;
    }

    localStorage.setItem(KEY, key);
    localStorage.setItem(URL_KEY, url);
    localStorage.setItem(MODEL_KEY, modelName);

    const dialog = $("settingsDialog");
    if (dialog?.close) dialog.close();

    status("API Key సేవ్ అయింది. ఇప్పుడు మాట్లాడవచ్చు.");
  });

  $("removeKeyBtn")?.addEventListener("click", () => {
    localStorage.removeItem(KEY);
    status("API Key తొలగించబడింది.");
    const dialog = $("settingsDialog");
    if (dialog?.close) dialog.close();
  });

  $("clearBtn")?.addEventListener("click", () => {
    if (!confirm("Chat మొత్తం తొలగించాలా?")) return;
    conversation = [];
    $("messages")?.replaceChildren();
  });

  // Prevent accidental duplicate listeners if this file is loaded once.
  status(apiKey()
    ? "JARVIS సిద్ధంగా ఉంది. మైక్ నొక్కి మాట్లాడు."
    : "Settingsలో API Key సేవ్ చేయి.");
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeJarvisVoice, {
    once: true
  });
} else {
  initializeJarvisVoice();
}
