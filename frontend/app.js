(() => {
  "use strict";
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const STORE = { settings: "jarvis-settings-v1", notes: "jarvis-notes-v1" };
  let settings = { aiProvider: "gemini", aiKey: "", aiModel: "gemini-2.5-flash", aiEndpoint: "https://api.openai.com/v1/chat/completions", weatherKey: "", language: "en-US", autoSpeak: false };
  let toastTimer, recognition = null, installPrompt = null, imageUrl = null, currentImage = null;
  const audioUrls = [];
  let tracks = [];

  function toast(message) {
    const node = $("#toast"); node.textContent = message; node.classList.add("show");
    clearTimeout(toastTimer); toastTimer = setTimeout(() => node.classList.remove("show"), 2800);
  }
  function safeGet(key, fallback) {
    try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch (_) { return fallback; }
  }
  function safeSet(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch (_) { toast("Could not save: browser storage may be full or disabled."); return false; }
  }
  function updateClock() {
    const now = new Date();
    $("#clock").textContent = now.toLocaleTimeString([], {hour:"2-digit",minute:"2-digit",second:"2-digit"});
    $("#dateText").textContent = now.toLocaleDateString([], {weekday:"long",year:"numeric",month:"short",day:"numeric"});
    $("#networkText").textContent = navigator.onLine ? "Internet connection available" : "Offline · local tools available";
    $("#onlineStatus").textContent = navigator.onLine ? "● ONLINE" : "● OFFLINE";
    $("#onlineStatus").style.color = navigator.onLine ? "var(--green)" : "#ffbd65";
  }
  function setView(name) {
    const target = $("#view-" + name);
    if (!target) return;
    $$(".view").forEach(v => v.classList.toggle("active", v === target));
    $$(".nav-item").forEach(b => b.classList.toggle("active", b.dataset.view === name));
    $("#sidebar").classList.remove("open");
    window.scrollTo({top:0, behavior:"smooth"});
  }
  $$(".nav-item").forEach(btn => btn.addEventListener("click", () => setView(btn.dataset.view)));
  $$("[data-open]").forEach(btn => btn.addEventListener("click", () => setView(btn.dataset.open)));
  $("#menuToggle").addEventListener("click", () => $("#sidebar").classList.toggle("open"));
  $("#settingsShortcut").addEventListener("click", () => setView("settings"));
  $("#goChat").addEventListener("click", () => setView("chat"));
  window.addEventListener("online", updateClock); window.addEventListener("offline", updateClock);
  updateClock(); setInterval(updateClock, 1000);

  function loadSettings() {
    settings = {...settings, ...safeGet(STORE.settings, {})};
    $("#aiProvider").value = settings.aiProvider;
    $("#aiKey").value = settings.aiKey || "";
    $("#aiModel").value = settings.aiModel || (settings.aiProvider === "gemini" ? "gemini-2.5-flash" : "gpt-4o-mini");
    $("#aiEndpoint").value = settings.aiEndpoint || "https://api.openai.com/v1/chat/completions";
    $("#weatherKey").value = settings.weatherKey || "";
    $("#language").value = settings.language || "en-US";
    $("#autoSpeak").checked = Boolean(settings.autoSpeak);
    $("#homeWeather").textContent = settings.weatherKey ? "API configured" : "Not configured";
  }
  $("#aiProvider").addEventListener("change", () => {
    if ($("#aiProvider").value === "gemini" && !$("#aiModel").value.startsWith("gemini")) $("#aiModel").value = "gemini-2.5-flash";
    if ($("#aiProvider").value === "openai" && $("#aiModel").value.startsWith("gemini")) $("#aiModel").value = "gpt-4o-mini";
  });
  $("#settingsForm").addEventListener("submit", e => {
    e.preventDefault();
    settings = {aiProvider:$("#aiProvider").value, aiKey:$("#aiKey").value.trim(), aiModel:$("#aiModel").value.trim() || ($("#aiProvider").value === "gemini" ? "gemini-2.5-flash" : "gpt-4o-mini"), aiEndpoint:$("#aiEndpoint").value.trim(), weatherKey:$("#weatherKey").value.trim(), language:$("#language").value, autoSpeak:$("#autoSpeak").checked};
    if (safeSet(STORE.settings, settings)) {
      $("#settingsStatus").textContent = "Settings saved in this browser.";
      $("#homeWeather").textContent = settings.weatherKey ? "API configured" : "Not configured";
      toast("Settings saved.");
    }
  });
  $$(".reveal-btn").forEach(btn => btn.addEventListener("click", () => {
    const input = $("#" + btn.dataset.reveal); const show = input.type === "password";
    input.type = show ? "text" : "password"; btn.textContent = show ? "Hide" : "Show";
  }));
  loadSettings();

  function addMessage(role, text) {
    const row = document.createElement("div"); row.className = "message " + role;
    const avatar = document.createElement("div"); avatar.className = "avatar"; avatar.textContent = role === "user" ? "YOU" : "J";
    const bubble = document.createElement("div"); bubble.className = "bubble";
    const strong = document.createElement("strong"); strong.textContent = role === "user" ? "YOU" : "J.A.R.V.I.S.";
    const p = document.createElement("p"); p.textContent = text;
    bubble.append(strong, p); row.append(avatar, bubble); $("#chatMessages").append(row);
    $("#chatMessages").scrollTop = $("#chatMessages").scrollHeight;
  }
  function localCommand(text) {
    const lower = text.toLowerCase().trim();
    if (/^(hi|hello|hey)\b/.test(lower)) return "Hello! J.A.R.V.I.S. is online. What would you like to do?";
    if (/\b(what can you do|help|commands)\b/.test(lower)) return "I can answer with your configured AI API, tell the time/date, calculate arithmetic, open app sections, read replies aloud, and help you use weather, notes, music, photo tools and phone shortcuts. Try: “calculate (12+8)*3”, “open notes”, or “what time is it”.";
    if (/\b(time|what time)\b/.test(lower)) return "The current local time is " + new Date().toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"}) + ".";
    if (/\b(date|today)\b/.test(lower)) return "Today is " + new Date().toLocaleDateString([], {weekday:"long",year:"numeric",month:"long",day:"numeric"}) + ".";
    const calcMatch = lower.match(/^(?:calculate|calc|what is|solve)?\s*([0-9().+\-*/%\s]+)\s*[?]?$/i) || lower.match(/\b(?:calculate|calc|solve)\s+(.+?)[?]?$/i);
    if (calcMatch && calcMatch[1] && /[0-9]/.test(calcMatch[1])) {
      try { return "Result: " + calculate(calcMatch[1]); } catch (_) { return "I couldn't calculate that expression. Try something like (12 + 8) * 3."; }
    }
    const section = lower.match(/\b(?:open|show|go to)\s+(weather|news|music|notes|settings|photo lab|photo|calculator|tools|chat|home)\b/);
    if (section) {
      const dest = {"photo lab":"media","photo":"media","calculator":"tools"}[section[1]] || section[1];
      if ($("#view-" + dest)) { setView(dest); return "Opening " + section[1] + "."; }
      if (section[1] === "news") { window.open("https://news.google.com/", "_blank", "noopener,noreferrer"); return "Opening Google News in a new tab."; }
    }
    if (/\b(weather)\b/.test(lower)) { setView("weather"); return "Opening Weather. Enter a city; live results need an OpenWeather API key in Settings."; }
    if (/\b(music|play music)\b/.test(lower)) { setView("music"); return "Opening Music Player. Choose an audio file stored on your device."; }
    if (/\b(note|notes)\b/.test(lower)) { setView("notes"); return "Opening Notes."; }
    return null;
  }
  // Recursive-descent arithmetic parser: only numbers, parentheses and arithmetic operators are accepted.
  function calculate(expression) {
    let s = String(expression).replace(/^(calculate|calc|what is|solve)\s*/i, "").replace(/\?$/, "").replace(/\s/g, "");
    if (!s || s.length > 120 || !/^[\d.+\-*/()%]+$/.test(s)) throw Error("Invalid expression");
    let i = 0;
    function expr(){let v=term();while(s[i]==="+"||s[i]==="-"){const op=s[i++],r=term();v=op==="+"?v+r:v-r;}return v;}
    function term(){let v=factor();while(s[i]==="*"||s[i]==="/"||s[i]==="%"){const op=s[i++],r=factor();if((op==="/"||op==="%")&&r===0)throw Error("Divide by zero");v=op==="*"?v*r:op==="/"?v/r:v%r;}return v;}
    function factor(){if(s[i]==="+"){i++;return factor();}if(s[i]==="-"){i++;return -factor();}if(s[i]==="("){i++;const v=expr();if(s[i++]!==")")throw Error("Parentheses");return v;}const start=i;while(/[0-9.]/.test(s[i]||"")&&i<s.length)i++;if(start===i)throw Error("Number");const n=Number(s.slice(start,i));if(!Number.isFinite(n))throw Error("Number");return n;}
    const result=expr();if(i!==s.length||!Number.isFinite(result))throw Error("Invalid expression");return Number(result.toPrecision(12)).toString();
  }
  async function askAI(prompt) {
    if (!settings.aiKey) return "No AI API key is configured, so I used local mode. " + (localCommand(prompt) || "Add your AI API key in Settings to enable AI answers. Local commands, notes, calculator, music and photo tools still work without a key.");
    if (settings.aiProvider === "gemini") {
      const model = encodeURIComponent(settings.aiModel || "gemini-2.5-flash");
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(settings.aiKey)}`;
      const res = await fetch(url, {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({contents:[{parts:[{text:prompt}]}],generationConfig:{temperature:0.7,maxOutputTokens:1200}})});
      const data = await res.json().catch(()=>({}));
      if (!res.ok) throw new Error(data.error?.message || `Gemini API error (${res.status})`);
      return (data.candidates?.[0]?.content?.parts || []).map(p=>p.text||"").join("\n").trim() || "The AI provider returned an empty response.";
    }
    const endpoint = settings.aiEndpoint || "https://api.openai.com/v1/chat/completions";
    const res = await fetch(endpoint,{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+settings.aiKey},body:JSON.stringify({model:settings.aiModel||"gpt-4o-mini",messages:[{role:"system",content:"You are J.A.R.V.I.S., a helpful, concise personal AI assistant."},{role:"user",content:prompt}],temperature:0.7})});
    const data = await res.json().catch(()=>({}));
    if(!res.ok) throw new Error(data.error?.message||`AI API error (${res.status})`);
    return data.choices?.[0]?.message?.content || "The AI provider returned an empty response.";
  }
  async function handlePrompt(raw) {
    const prompt = raw.trim(); if(!prompt) return;
    addMessage("user",prompt); $("#chatInput").value = "";
    const local = localCommand(prompt);
    if (local) { addMessage("assistant",local); if(settings.autoSpeak) speak(local); return; }
    const pending = document.createElement("div"); pending.className="message assistant"; pending.id="pendingMessage"; pending.innerHTML='<div class="avatar">J</div><div class="bubble"><strong>J.A.R.V.I.S.</strong><p>Thinking…</p></div>'; $("#chatMessages").append(pending); $("#chatMessages").scrollTop=$("#chatMessages").scrollHeight;
    try { const answer=await askAI(prompt); $("#pendingMessage")?.remove(); addMessage("assistant",answer); if(settings.autoSpeak)speak(answer); }
    catch(err){$("#pendingMessage")?.remove();addMessage("assistant","I couldn't reach the AI service: "+err.message+". Check your API key, model, endpoint and internet connection in Settings.");}
  }
  $("#chatForm").addEventListener("submit",e=>{e.preventDefault();handlePrompt($("#chatInput").value);});
  $("#clearChat").addEventListener("click",()=>{$("#chatMessages").replaceChildren();addMessage("assistant","Chat cleared. How can I help?");});
  $$(".suggestion").forEach(btn=>btn.addEventListener("click",()=>handlePrompt(btn.dataset.prompt)));

  function speak(text) {
    if (!("speechSynthesis" in window)) { toast("Text-to-speech is not supported in this browser."); return; }
    window.speechSynthesis.cancel(); const utterance=new SpeechSynthesisUtterance(text.slice(0,3500)); utterance.lang=settings.language||"en-US"; window.speechSynthesis.speak(utterance);
  }
  function startListening(onText) {
    const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
    if(!SR){toast("Voice recognition is not supported here. Try Chrome with microphone permission.");$("#voiceStatus").textContent="Voice recognition unsupported";return;}
    if(recognition){try{recognition.stop();}catch(_){} recognition=null;}
    recognition=new SR(); recognition.lang=settings.language||"en-US"; recognition.interimResults=false; recognition.maxAlternatives=1;
    $("#voiceStatus").textContent="Listening…"; recognition.onresult=e=>{const said=e.results[0][0].transcript;$("#voiceStatus").textContent="Heard: "+said;onText(said);};
    recognition.onerror=e=>{$("#voiceStatus").textContent="Voice error: "+e.error;toast("Voice input error: "+e.error);};
    recognition.onend=()=>{if($("#voiceStatus").textContent==="Listening…")$("#voiceStatus").textContent="Listening ended";};
    try{recognition.start();}catch(err){toast("Could not start microphone: "+err.message);}
  }
  $("#startVoice").addEventListener("click",()=>{setView("chat");startListening(handlePrompt);});
  $("#chatMic").addEventListener("click",()=>startListening(handlePrompt));
  $("#voiceToolBtn").addEventListener("click",()=>startListening(handlePrompt));
  $("#speakTestBtn").addEventListener("click",()=>speak("Hello. J.A.R.V.I.S. speech system is ready."));

  $("#weatherForm").addEventListener("submit",async e=>{
    e.preventDefault();const city=$("#weatherCity").value.trim();if(!city){toast("Enter a city name first.");return;}
    if(!settings.weatherKey){$("#weatherResult").innerHTML='<div class="big-weather-icon">🔑</div><h3>API key needed</h3><p>Add an OpenWeather API key in Settings, then try again.</p>';return;}
    $("#weatherResult").innerHTML='<p>Fetching current weather…</p>';
    try{
      const url=`https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${encodeURIComponent(settings.weatherKey)}&units=metric`;
      const res=await fetch(url);const d=await res.json();if(!res.ok)throw new Error(d.message||`Weather API error (${res.status})`);
      const icon=d.weather?.[0]?.icon;const image=icon?`https://openweathermap.org/img/wn/${icon}@2x.png`:"";
      $("#weatherResult").innerHTML=`<div class="weather-main">${image?`<img class="weather-icon" alt="" src="${image}">`:'<span class="weather-icon">☼</span>'}<div><div class="muted">${escapeHTML(d.name)}, ${escapeHTML(d.sys?.country||"")}</div><div class="weather-temp">${Math.round(d.main.temp)}°C</div><div>${escapeHTML(d.weather?.[0]?.description||"")}</div></div></div><div class="weather-details"><div><small>Feels like</small><strong>${Math.round(d.main.feels_like)}°C</strong></div><div><small>Humidity</small><strong>${d.main.humidity}%</strong></div><div><small>Wind</small><strong>${d.wind.speed} m/s</strong></div></div>`;
      $("#homeWeather").textContent=`${Math.round(d.main.temp)}°C · ${d.name}`;
    }catch(err){$("#weatherResult").innerHTML=`<h3>Weather unavailable</h3><p>${escapeHTML(err.message)}. Check your key, city and internet connection.</p>`;}
  });
  function escapeHTML(value){return String(value).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}

  $("#audioFile").addEventListener("change",e=>{
    for(const url of audioUrls)URL.revokeObjectURL(url);audioUrls.length=0;tracks=[];
    [...e.target.files].forEach(file=>{const url=URL.createObjectURL(file);audioUrls.push(url);tracks.push({name:file.name,url});});
    renderPlaylist();if(tracks.length)playTrack(0);
  });
  function renderPlaylist(){
    $("#trackCount").textContent=`${tracks.length} track${tracks.length===1?"":"s"}`;const list=$("#playlist");list.replaceChildren();
    if(!tracks.length){list.className="playlist empty-state";list.textContent="Your selected tracks will appear here.";return;}
    list.className="playlist";
    tracks.forEach((track,i)=>{const row=document.createElement("div");row.className="track-row";const play=document.createElement("button");play.className="track-play";play.textContent="▶";play.setAttribute("aria-label","Play "+track.name);play.addEventListener("click",()=>playTrack(i));const title=document.createElement("button");title.className="track-title";title.textContent=track.name;title.addEventListener("click",()=>playTrack(i));row.append(play,title);list.append(row);});
  }
  function playTrack(i){const track=tracks[i];if(!track)return;const player=$("#audioPlayer");player.src=track.url;$("#trackName").textContent=track.name;$("#trackMeta").textContent=`Track ${i+1} of ${tracks.length}`;player.play().catch(()=>toast("Press Play in the audio controls to start playback."));}
  $("#audioPlayer").addEventListener("ended",()=>{const idx=tracks.findIndex(t=>t.url===$("#audioPlayer").src);if(idx>=0&&idx<tracks.length-1)playTrack(idx+1);});

  const imageStage=$("#imageStage");
  $("#imageFile").addEventListener("change",e=>{
    const file=e.target.files?.[0];if(!file)return;if(imageUrl)URL.revokeObjectURL(imageUrl);imageUrl=URL.createObjectURL(file);
    const img=new Image();img.onload=()=>{currentImage=img;imageStage.replaceChildren(img);updateImageFilters();$("#downloadImage").disabled=false;};img.onerror=()=>toast("Could not load that image.");img.src=imageUrl;
  });
  function updateImageFilters(){
    if(!currentImage)return;const b=Number($("#brightness").value),c=Number($("#contrast").value),s=Number($("#saturation").value);
    imageStage.style.setProperty("--brightness",b/100);imageStage.style.setProperty("--contrast",c/100);imageStage.style.setProperty("--saturation",s/100);
    $("#brightnessOut").textContent=b+"%";$("#contrastOut").textContent=c+"%";$("#saturationOut").textContent=s+"%";
    const img=$("img",imageStage);if(img)img.style.filter=`brightness(${b/100}) contrast(${c/100}) saturate(${s/100})`;
  }
  ["brightness","contrast","saturation"].forEach(id=>$("#"+id).addEventListener("input",updateImageFilters));
  $("#resetImage").addEventListener("click",()=>{["brightness","contrast","saturation"].forEach(id=>$("#"+id).value=100);updateImageFilters();});
  $("#downloadImage").addEventListener("click",()=>{
    if(!currentImage)return;const b=Number($("#brightness").value)/100,c=Number($("#contrast").value)/100,s=Number($("#saturation").value)/100;
    const canvas=document.createElement("canvas");canvas.width=currentImage.naturalWidth;canvas.height=currentImage.naturalHeight;const ctx=canvas.getContext("2d");
    if(!ctx){toast("Canvas is not available.");return;}ctx.filter=`brightness(${b}) contrast(${c}) saturate(${s})`;ctx.drawImage(currentImage,0,0);canvas.toBlob(blob=>{if(!blob){toast("Could not export this image.");return;}const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download="jarvis-edited-photo.png";a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);}, "image/png");
  });

  function loadNotes(){const notes=safeGet(STORE.notes,[]);renderNotes(Array.isArray(notes)?notes:[]);}
  function renderNotes(notes){
    $("#notesCount").textContent=`${notes.length} note${notes.length===1?"":"s"}`;const list=$("#notesList");list.replaceChildren();
    if(!notes.length){list.className="notes-list empty-state";list.textContent="No notes yet. Create your first note.";return;}
    list.className="notes-list";
    notes.slice().reverse().forEach(note=>{const card=document.createElement("article");card.className="note-card";const h=document.createElement("h3");h.textContent=note.title||"Untitled note";const p=document.createElement("p");p.textContent=note.body;const meta=document.createElement("div");meta.className="note-meta";const date=document.createElement("span");date.textContent=new Date(note.created).toLocaleString();const del=document.createElement("button");del.className="delete-note";del.textContent="Delete";del.addEventListener("click",()=>{const next=safeGet(STORE.notes,[]).filter(n=>n.id!==note.id);safeSet(STORE.notes,next);renderNotes(next);});meta.append(date,del);card.append(h,p,meta);list.append(card);});
  }
  $("#noteForm").addEventListener("submit",e=>{e.preventDefault();const body=$("#noteBody").value.trim();if(!body)return;const notes=safeGet(STORE.notes,[]);notes.push({id:Date.now().toString(36)+Math.random().toString(36).slice(2,7),title:$("#noteTitle").value.trim()||"Untitled note",body,created:Date.now()});if(safeSet(STORE.notes,notes)){renderNotes(notes);$("#noteTitle").value="";$("#noteBody").value="";toast("Note saved on this device.");}});
  loadNotes();

  $("#calcForm").addEventListener("submit",e=>{e.preventDefault();try{$("#calcResult").textContent="= "+calculate($("#calcInput").value);}catch(_){$("#calcResult").textContent="Invalid expression. Use numbers, + − × ÷ %, and parentheses.";}});

  function getPhone(){return $("#phoneNumber").value.trim().replace(/[^\d+]/g,"");}
  $("#callBtn").addEventListener("click",()=>{const n=getPhone();if(!n){toast("Enter a phone number.");return;}window.location.href="tel:"+n;});
  $("#smsBtn").addEventListener("click",()=>{const n=getPhone();if(!n){toast("Enter a phone number.");return;}window.location.href="sms:"+n;});
  $("#waBtn").addEventListener("click",()=>{const n=getPhone().replace(/\D/g,"");if(!n){toast("Enter a phone number including country code.");return;}window.open("https://wa.me/"+n,"_blank","noopener,noreferrer");});
  $$("[data-url]").forEach(btn=>btn.addEventListener("click",()=>window.open(btn.dataset.url,"_blank","noopener,noreferrer")));

  window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();installPrompt=e;$("#installBtn").hidden=false;$("#installHelp").textContent="Your browser reports that installation is available.";});
  $("#installBtn").addEventListener("click",async()=>{if(!installPrompt){toast("Use Chrome menu → Install app / Add to Home screen.");return;}installPrompt.prompt();await installPrompt.userChoice;installPrompt=null;$("#installBtn").hidden=true;});
  window.addEventListener("appinstalled",()=>toast("J.A.R.V.I.S. AI installed."));
  if("serviceWorker" in navigator && (location.protocol==="https:"||location.hostname==="localhost")) {
    window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js").then(()=>console.log("Service worker registered")).catch(err=>console.warn("Service worker registration failed:",err)));
  }
})();
