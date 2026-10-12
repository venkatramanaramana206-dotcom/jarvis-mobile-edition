"use strict";

/* J.A.R.V.I.S — Chat, Gemini, history, voice, images, local tools and PWA */

const $ = id => document.getElementById(id);
const JARVIS = {
  model: "gemini-3.8-flash",
  models: ["gemini-3.8-flash", "gemini-2.5-flash"],
  keys: {
    api: "jarvis_key",
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
let deferredPrompt = null;

function safeGet(key, fallback = null) {
  try { const v = localStorage.getItem(key); return v === null ? fallback : v; }
  catch (e) { console.warn("Storage read failed", e); return fallback; }
}
function safeSet(key, value) {
  try { localStorage.setItem(key, String(value)); return localStorage.getItem(key) === String(value); }
  catch (e) { console.warn("Storage write failed", e); return false; }
}
function safeJSON(key, fallback) {
  try { return JSON.parse(safeGet(key, JSON.stringify(fallback))); } catch { return fallback; }
}
function toast(message) {
  const host = $("toast-container");
  if (!host) { console.log("[JARVIS]", message); return; }
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = String(message);
  host.appendChild(el);
  setTimeout(() => el.remove(), 4500);
}
function setStatus(message, type = "ready") {
  const status = $("system-status"), dot = $("status-dot"), thinking = $("thinking-status");
  if (status) status.textContent = message;
  if (thinking) thinking.textContent = type === "busy" ? message : "";
  if (dot) dot.style.background = type === "error" ? "#ff5252" : type === "busy" ? "#ffc857" : "#54e39b";
}
function setBusy(value) {
  isBusy = value;
  const button = $("send-btn");
  if (button) button.disabled = value;
  setStatus(value ? "J.A.R.V.I.S is thinking..." : "SYSTEM ONLINE", value ? "busy" : "ready");
}
function getApiKey() { return safeGet(JARVIS.keys.api, "") || ""; }
function loadApiKey() { const input = $("api-key-input"); if (input) input.value = getApiKey(); }

async function requestGemini(contents, apiKey, maxOutputTokens = 1024) {
  if (!apiKey) throw new Error("Open Settings and enter your Gemini API key.");
  let lastError = null;
  for (const model of JARVIS.models) {
    let response;
    try {
      response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: "You are J.A.R.V.I.S, a helpful personal AI assistant. Reply clearly. If the user writes Telugu, reply in Telugu unless asked otherwise." }] },
          contents,
          generationConfig: { temperature: 0.7, maxOutputTokens }
        })
      });
    } catch {
      throw new Error("Network request failed. Check your internet connection.");
    }
    let data;
    try { data = await response.json(); } catch { throw new Error("Gemini returned an unreadable response."); }
    if (!response.ok) {
      const detail = data?.error?.message || `HTTP ${response.status}`;
      lastError = new Error(`${model}: ${detail}`);
      if (response.status === 404 || (response.status === 400 && /model|not found|not supported/i.test(detail))) continue;
      if (response.status === 401 || response.status === 403) throw new Error("API key rejected or API access is unavailable. Check the key in Google AI Studio.");
      if (response.status === 429) throw new Error("Gemini request limit reached. Wait and try again.");
      throw lastError;
    }
    const answer = data?.candidates?.[0]?.content?.parts?.map(p => p.text || "").join("").trim();
    if (!answer) throw new Error(data?.promptFeedback?.blockReason ? `Request blocked: ${data.promptFeedback.blockReason}` : "Gemini returned an empty answer.");
    JARVIS.model = model;
    return answer;
  }
  throw new Error("No configured Gemini model worked. " + (lastError?.message || "Check available models and API access."));
}

async function saveSettings() {
  const input = $("api-key-input"), button = $("save-api-key-btn");
  if (!input) return toast("API key input is missing from HTML.");
  const key = input.value.trim();
  if (!key) { toast("Please enter your Gemini API key."); input.focus(); return; }
  if (/\s/.test(key)) { toast("The API key contains spaces. Check it and try again."); input.focus(); return; }
  const oldText = button?.textContent || "Save API Key";
  if (button) { button.disabled = true; button.textContent = "Saving..."; }
  try {
    // Persist first. A failed connection test never deletes the saved key.
    if (!safeSet(JARVIS.keys.api, key) || getApiKey() !== key) throw new Error("Browser storage could not save the API key.");
    toast("API key saved in this browser. Testing connection...");
    try {
      await requestGemini([{ role: "user", parts: [{ text: "Reply with OK." }] }], key, 32);
      setStatus("GEMINI CONNECTED");
      toast("API key saved and Gemini connection works.");
      closePanel("settings-panel");
    } catch (e) {
      console.error("Gemini test failed:", e);
      setStatus("CONNECTION ERROR", "error");
      toast("Key saved, but connection test failed: " + e.message);
    }
  } catch (e) { toast(e.message); }
  finally { if (button) { button.disabled = false; button.textContent = oldText; } }
}
function applyTheme(theme) {
  const valid = theme === "light" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", valid);
  safeSet(JARVIS.keys.theme, valid);
}
function initSettings() {
  loadApiKey();
  const theme = safeGet(JARVIS.keys.theme, "dark");
  if ($("theme-select")) $("theme-select").value = theme;
  applyTheme(theme);
  if ($("language-select")) $("language-select").value = safeGet(JARVIS.keys.language, "te-IN");
  if ($("voice-replies-toggle")) $("voice-replies-toggle").checked = safeGet(JARVIS.keys.voice, "true") !== "false";
}
function openPanel(id) {
  const panel = $(id); if (!panel) return;
  panel.hidden = false; panel.classList.add("active", "open");
}
function closePanel(id) {
  const panel = $(id); if (!panel) return;
  panel.classList.remove("active", "open"); panel.hidden = true;
}

function saveConversations() {
  safeSet(JARVIS.keys.history, JSON.stringify(conversations));
  if (activeConversation) safeSet(JARVIS.keys.active, activeConversation.id);
}
function newConversation() {
  activeConversation = { id: `${Date.now()}-${Math.random().toString(36).slice(2,7)}`, title: "New conversation", messages: [], updatedAt: Date.now() };
  conversations.unshift(activeConversation); conversations = conversations.slice(0, 30);
  saveConversations(); renderChat(); renderHistory();
}
function loadConversations() {
  const data = safeJSON(JARVIS.keys.history, []);
  conversations = Array.isArray(data) ? data.filter(c => c && typeof c.id === "string" && Array.isArray(c.messages)) : [];
  const id = safeGet(JARVIS.keys.active, "");
  activeConversation = conversations.find(c => c.id === id) || conversations[0] || null;
  if (!activeConversation) {
    activeConversation = { id: String(Date.now()), title: "New conversation", messages: [], updatedAt: Date.now() };
    conversations = [activeConversation];
  }
  saveConversations(); renderChat(); renderHistory();
}
function addMessage(role, text, image = null) {
  if (!activeConversation) newConversation();
  const message = { role, text: String(text || ""), timestamp: Date.now() };
  if (image) message.image = image;
  activeConversation.messages.push(message);
  activeConversation.updatedAt = Date.now();
  if (activeConversation.title === "New conversation" && role === "user") activeConversation.title = (String(text || "Image conversation")).slice(0, 42);
  saveConversations(); renderChat(); renderHistory();
}
function renderChat() {
  const chat = $("chat"); if (!chat) return;
  chat.replaceChildren();
  for (const m of activeConversation?.messages || []) {
    const wrap = document.createElement("article");
    wrap.className = "message " + (m.role === "user" ? "user-message" : "assistant-message");
    if (m.role !== "user") {
      const heading = document.createElement("div"); heading.className = "message-heading";
      const avatar = document.createElement("span"); avatar.className = "message-avatar"; avatar.textContent = "●";
      const name = document.createElement("strong"); name.textContent = "JARVIS";
      const time = document.createElement("time"); time.className = "message-time"; time.textContent = new Date(m.timestamp || Date.now()).toLocaleTimeString([], {hour:"2-digit", minute:"2-digit"});
      heading.append(avatar, name, time); wrap.appendChild(heading);
    }
    const content = document.createElement("div"); content.className = "message-content"; content.textContent = m.text || ""; wrap.appendChild(content);
    if (m.image) { const img = document.createElement("img"); img.src = m.image; img.alt = "Uploaded image"; wrap.appendChild(img); }
    chat.appendChild(wrap);
  }
  chat.scrollTop = chat.scrollHeight;
}
function renderHistory() {
  const list = $("history-list"); if (!list) return;
  list.replaceChildren();
  if (!conversations.length) { const p = document.createElement("p"); p.className = "empty-history"; p.textContent = "Your conversations will appear here."; list.appendChild(p); return; }
  conversations.forEach(c => {
    const b = document.createElement("button"); b.type = "button"; b.className = "history-item"; b.textContent = c.title || "Conversation";
    b.addEventListener("click", () => { activeConversation = c; saveConversations(); renderChat(); closePanel("history-panel"); });
    list.appendChild(b);
  });
}
function clearMemory() {
  if (!confirm("Clear saved conversation history? This cannot be undone.")) return;
  conversations = []; activeConversation = null;
  try { localStorage.removeItem(JARVIS.keys.history); localStorage.removeItem(JARVIS.keys.active); } catch {}
  newConversation(); toast("Conversation history cleared. API key was kept.");
}

function imageToGeminiPart(dataUrl) {
  const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/.exec(dataUrl);
  if (!match) throw new Error("Unsupported image format.");
  return { inlineData: { mimeType: match[1], data: match[2] } };
}
function showImagePreview(data) {
  pendingImage = data;
  if ($("image-preview")) $("image-preview").src = data;
  if ($("image-preview-container")) $("image-preview-container").hidden = false;
}
function handleImageFile(file) {
  if (!file) return;
  if (!file.type.startsWith("image/")) return toast("Please select an image file.");
  if (file.size > 8 * 1024 * 1024) return toast("Choose an image smaller than 8 MB.");
  const reader = new FileReader();
  reader.onload = () => showImagePreview(String(reader.result));
  reader.onerror = () => toast("Could not read the image.");
  reader.readAsDataURL(file);
}
function openCamera() {
  const input = $("img-input"); if (!input) return toast("Image input not found.");
  input.accept = "image/*"; input.setAttribute("capture", "environment"); input.click();
}
async function askGemini(userText, imageData = null) {
  const key = getApiKey();
  if (!key) { toast("Open Settings and save your Gemini API key first."); openPanel("settings-panel"); return null; }
  const history = (activeConversation?.messages || []).slice(-20)
    .filter(m => m.role === "user" || m.role === "assistant")
    .map(m => ({ role: m.role === "assistant" ? "model" : "user", parts: m.text ? [{text:m.text}] : [] }))
    .filter(m => m.parts.length);
  const parts = [];
  if (userText) parts.push({text:userText});
  if (imageData) parts.push(imageToGeminiPart(imageData));
  if (!parts.length) parts.push({text:"Please describe this image."});
  // Current user message is already in history; replace it with multimodal version.
  if (history.length && history[history.length - 1].role === "user") history.pop();
  history.push({role:"user", parts});
  return requestGemini(history, key);
}

async function sendMessage() {
  if (isBusy) return;
  const input = $("message-input"), text = input ? input.value.trim() : "";
  if (!text && !pendingImage) return;
  const image = pendingImage;
  if (input) input.value = "";
  pendingImage = null;
  if ($("image-preview-container")) $("image-preview-container").hidden = true;
  addMessage("user", text || "Please analyze this image.", image);
  try {
    if (await handleCommand(text)) return;
    setBusy(true);
    const answer = await askGemini(text || "Please analyze this image.", image);
    if (answer) { addMessage("assistant", answer); speak(answer); }
  } catch (e) {
    console.error("JARVIS request error:", e);
    addMessage("assistant", "Sorry, I couldn't complete that request. " + e.message);
    toast(e.message || "Request failed.");
  } finally { setBusy(false); }
}

async function handleCommand(raw) {
  const text = String(raw || "").trim().toLowerCase();
  if (!text) return false;
  if (/^(hi|hello|hey jarvis|హాయ్|హలో)$/.test(text)) { addMessage("assistant", "Hello! I am J.A.R.V.I.S. How can I help you?"); return true; }
  if (/\b(time|current time|what time)\b/.test(text) || /సమయం ఎంత/.test(text)) {
    addMessage("assistant", "Current time: " + new Intl.DateTimeFormat("en-IN", {hour:"2-digit",minute:"2-digit",second:"2-digit",timeZone:"Asia/Kolkata"}).format(new Date()) + " (India)"); return true;
  }
  if (/\b(today's date|what date|current date)\b/.test(text) || /ఈరోజు తేదీ/.test(text)) {
    addMessage("assistant", "Today's date: " + new Intl.DateTimeFormat("en-IN", {day:"numeric",month:"long",year:"numeric",timeZone:"Asia/Kolkata"}).format(new Date())); return true;
  }
  if (/\b(joke|tell me a joke)\b/.test(text) || /జోక్/.test(text)) {
    const jokes = ["Why did the computer go to the doctor? It had a virus!","Why was the math book sad? It had too many problems.","Why do programmers prefer dark mode? Because light attracts bugs!"];
    addMessage("assistant", jokes[Math.floor(Math.random()*jokes.length)]); return true;
  }
  if (/\b(flip a coin|coin toss|toss a coin)\b/.test(text) || /కాయిన్ టాస్/.test(text)) { addMessage("assistant", Math.random()<.5 ? "Heads!" : "Tails!"); return true; }
  if (/\b(roll a dice|roll dice|dice roll)\b/.test(text) || /డైస్ వేయి/.test(text)) { addMessage("assistant", "You rolled: " + (1+Math.floor(Math.random()*6))); return true; }
  const tm = text.match(/(?:set\s+)?timer(?:\s+for)?\s+(\d+)\s*(seconds?|secs?|minutes?|mins?|hours?|hrs?)/);
  if (tm) {
    const n = Number(tm[1]), u = tm[2], mult = u.startsWith("hour")||u.startsWith("hr") ? 3600000 : u.startsWith("min") ? 60000 : 1000;
    if (timerHandle) clearTimeout(timerHandle);
    addMessage("assistant", `Timer set for ${n} ${u}.`);
    timerHandle = setTimeout(() => { toast("Timer complete!"); addMessage("assistant","Your timer is complete!"); speak("Your timer is complete."); timerHandle=null; }, Math.min(n*mult, 2147480000));
    return true;
  }
  if (/\b(open\s+)?youtube\b/.test(text) || /\b(play|search)\b.*\b(song|music|youtube)\b/.test(text)) {
    const query = text.replace(/\b(open|play|search|on|youtube|song|music)\b/g,"").trim();
    window.open(query ? "https://www.youtube.com/results?search_query="+encodeURIComponent(query) : "https://www.youtube.com/","_blank","noopener,noreferrer");
    addMessage("assistant", "Opening YouTube" + (query ? " search for: "+query : "") + "."); return true;
  }
  if (/^(open|search|google)\b/.test(text)) {
    const q = text.replace(/^(open|search|google)\s*/i,"").trim();
    if (q) { window.open("https://www.google.com/search?q="+encodeURIComponent(q),"_blank","noopener,noreferrer"); addMessage("assistant","Searching Google for: "+q); return true; }
  }
  if (/\b(weather|temperature)\b/.test(text) || /వాతావరణం/.test(text)) {
    const match = raw.match(/(?:weather|temperature|వాతావరణం)(?:\s+(?:in|at|for))?\s+(.+)/i);
    const place = match?.[1]?.trim();
    if (!place) { addMessage("assistant","Please specify a city, for example: weather in Tirupati."); return true; }
    try {
      const g = await fetch("https://geocoding-api.open-meteo.com/v1/search?name="+encodeURIComponent(place)+"&count=1&language=en&format=json");
      if (!g.ok) throw new Error("Location lookup failed.");
      const location = (await g.json()).results?.[0];
      if (!location) { addMessage("assistant","I couldn't find that city. Check its spelling."); return true; }
      const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${location.latitude}&longitude=${location.longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m`);
      if (!r.ok) throw new Error("Weather service unavailable.");
      const w = (await r.json()).current;
      addMessage("assistant",`Weather in ${location.name}: ${w.temperature_2m}°C, feels like ${w.apparent_temperature}°C. Humidity: ${w.relative_humidity_2m}%. Wind: ${w.wind_speed_10m} km/h.`);
    } catch(e) { addMessage("assistant","Unable to get weather: "+e.message); }
    return true;
  }
  if (/\b(settings|open settings)\b/.test(text) || /సెట్టింగ్స్/.test(text)) { openPanel("settings-panel"); addMessage("assistant","Settings opened."); return true; }
  if (/\b(new chat|new conversation)\b/.test(text)) { newConversation(); addMessage("assistant","Started a new conversation."); return true; }
  return false;
}

function startVoiceInput() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return toast("Voice input is not supported in this browser. Try Chrome.");
  if (isListening && recognition) { recognition.stop(); return; }
  recognition = new SR();
  recognition.lang = $("language-select")?.value || "te-IN";
  recognition.interimResults = false; recognition.continuous = false;
  recognition.onstart = () => { isListening=true; $("mic-btn")?.setAttribute("aria-pressed","true"); $("voice-visualizer")?.classList.add("active"); toast("Listening..."); };
  recognition.onresult = e => { const transcript=e.results?.[0]?.[0]?.transcript || ""; if ($("message-input")) $("message-input").value=transcript; sendMessage(); };
  recognition.onerror = e => toast("Voice input error: "+(e.error || "unknown"));
  recognition.onend = () => { isListening=false; $("mic-btn")?.setAttribute("aria-pressed","false"); $("voice-visualizer")?.classList.remove("active"); };
  try { recognition.start(); } catch(e) { toast("Could not start voice input: "+e.message); }
}
function speak(text) {
  if (safeGet(JARVIS.keys.voice,"true")==="false" || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(String(text||""));
  u.lang = $("language-select")?.value || "te-IN"; u.rate=1; u.pitch=1; window.speechSynthesis.speak(u);
}
function stopVoice() {
  if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  if (recognition && isListening) recognition.stop();
}
function bindEvents() {
  $("save-api-key-btn")?.addEventListener("click", saveSettings);
  $("chat-form")?.addEventListener("submit", e => { e.preventDefault(); sendMessage(); });
  $("message-input")?.addEventListener("keydown", e => { if (e.key==="Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } });
  $("mic-btn")?.addEventListener("click", startVoiceInput);
  $("nav-voice")?.addEventListener("click", startVoiceInput);
  $("voice-card")?.addEventListener("click", startVoiceInput);
  $("stop-voice-btn")?.addEventListener("click", stopVoice);
  $("read-answer-btn")?.addEventListener("click", () => { const last=[...(activeConversation?.messages||[])].reverse().find(m=>m.role==="assistant"); last ? speak(last.text) : toast("There is no answer to read yet."); });
  $("cam-btn")?.addEventListener("click", openCamera);
  $("attach-btn")?.addEventListener("click", () => $("img-input")?.click());
  $("img-input")?.addEventListener("change", e => { handleImageFile(e.target.files?.[0]); e.target.value=""; });
  $("remove-image-btn")?.addEventListener("click", () => { pendingImage=null; if ($("image-preview-container")) $("image-preview-container").hidden=true; });
  $("clear-memory-btn")?.addEventListener("click", clearMemory);
  $("new-chat-btn")?.addEventListener("click", newConversation);
  $("settings-btn")?.addEventListener("click", () => openPanel("settings-panel"));
  $("nav-settings")?.addEventListener("click", () => openPanel("settings-panel"));
  $("history-btn")?.addEventListener("click", () => openPanel("history-panel"));
  $("nav-history")?.addEventListener("click", () => openPanel("history-panel"));
  $("close-settings-btn")?.addEventListener("click", () => closePanel("settings-panel"));
  $("close-history-btn")?.addEventListener("click", () => closePanel("history-panel"));
  $("theme-select")?.addEventListener("change", e => applyTheme(e.target.value));
  $("language-select")?.addEventListener("change", e => safeSet(JARVIS.keys.language,e.target.value));
  $("voice-replies-toggle")?.addEventListener("change", e => { safeSet(JARVIS.keys.voice,String(e.target.checked)); if(!e.target.checked) stopVoice(); });
  $("install-btn")?.addEventListener("click", async () => {
    if (!deferredPrompt) return toast("Chrome has not offered installation yet. Check the manifest and service worker, then reload.");
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    $("install-btn").hidden = true;
  });
  document.addEventListener("keydown", e => { if(e.key==="Escape"){closePanel("settings-panel");closePanel("history-panel");} });
}
window.addEventListener("beforeinstallprompt", e => { e.preventDefault(); deferredPrompt=e; if ($("install-btn")) $("install-btn").hidden=false; });
function initJarvis() {
  initSettings(); loadConversations(); bindEvents();
  setStatus(getApiKey() ? "SYSTEM ONLINE" : "API KEY NEEDED");
  // Do not force settings open on every reload; stored keys should remain remembered.
  if (!getApiKey()) toast("Open Settings and save your Gemini API key to use AI chat.");
  console.log("J.A.R.V.I.S initialized.");
}
if (document.readyState==="loading") document.addEventListener("DOMContentLoaded",initJarvis,{once:true}); else initJarvis();
