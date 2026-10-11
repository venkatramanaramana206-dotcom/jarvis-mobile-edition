 
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#030916">
  <meta name="robots" content="noindex,nofollow">
  <title>J.A.R.V.I.S — Build Diagnostics</title>

  <style>
    :root {
      color-scheme: dark;
      --bg: #030916;
      --panel: #09172b;
      --border: #123b60;
      --cyan: #36cfff;
      --green: #22f59b;
      --yellow: #ffce65;
      --red: #ff6178;
      --text: #e6f5ff;
      --muted: #88a7c1;
    }

    * { box-sizing: border-box; }

    body {
      margin: 0;
      padding: 20px;
      background:
        radial-gradient(ellipse at top, #0a2345 0%, var(--bg) 65%);
      color: var(--text);
      font-family: system-ui, sans-serif;
      min-height: 100vh;
    }

    main {
      width: 100%;
      max-width: 900px;
      margin: auto;
    }

    header {
      padding: 22px 0;
      border-bottom: 1px solid var(--border);
      margin-bottom: 22px;
    }

    h1 {
      margin: 0;
      color: var(--cyan);
      letter-spacing: 4px;
      font-size: clamp(23px, 5vw, 34px);
      text-shadow: 0 0 18px #168bff66;
    }

    .subtitle {
      color: var(--muted);
      margin: 8px 0 0;
    }

    .panel {
      background: linear-gradient(145deg, #0a1c33, #061020);
      border: 1px solid var(--border);
      border-radius: 15px;
      padding: 18px;
      margin: 14px 0;
      box-shadow: 0 0 24px #008cff0b;
    }

    h2 {
      margin: 0 0 15px;
      font-size: 17px;
      color: var(--cyan);
    }

    .overall {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
    }

    .dot {
      height: 11px;
      width: 11px;
      background: var(--yellow);
      border-radius: 50%;
      box-shadow: 0 0 12px currentColor;
      flex-shrink: 0;
    }

    .status-text {
      font-weight: 700;
    }

    .muted {
      color: var(--muted);
      font-size: 13px;
      margin-top: 7px;
      overflow-wrap: anywhere;
    }

    .checks {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 10px;
    }

    .check {
      background: #061326;
      border: 1px solid #163654;
      border-radius: 10px;
      padding: 13px;
      min-width: 0;
    }

    .check-title {
      font-weight: 650;
      margin-bottom: 7px;
    }

    .check-status {
      font-size: 13px;
      color: var(--muted);
      overflow-wrap: anywhere;
    }

    .pass { color: var(--green) !important; }
    .warn { color: var(--yellow) !important; }
    .fail { color: var(--red) !important; }

    button {
      border: 1px solid #168fca;
      border-radius: 9px;
      padding: 11px 15px;
      color: var(--text);
      background: #09294a;
      font: inherit;
      font-weight: 600;
      cursor: pointer;
      margin: 4px 4px 4px 0;
    }

    button:focus-visible {
      outline: 2px solid var(--cyan);
      outline-offset: 3px;
    }

    button:disabled {
      opacity: .45;
      cursor: not-allowed;
    }

    pre {
      white-space: pre-wrap;
      overflow-wrap: anywhere;
      color: #c2e7ff;
      font: 13px/1.65 ui-monospace, monospace;
      margin: 0;
      max-height: 360px;
      overflow: auto;
    }

    footer {
      color: var(--muted);
      text-align: center;
      padding: 20px 0;
      font-size: 12px;
    }
  </style>
</head>

<body>
<main>
  <header>
    <h1>J.A.R.V.I.S.</h1>
    <p class="subtitle">SYSTEM DIAGNOSTICS / BUILD LOG</p>
  </header>

  <section class="panel">
    <h2>Overall Status</h2>
    <div class="overall">
      <span class="dot" id="overall-dot"></span>
      <span class="status-text" id="overall-status" aria-live="polite">
        CHECKING SYSTEM...
      </span>
    </div>
    <p class="muted" id="checked-at">Diagnostics not yet completed.</p>
    <p class="muted" id="page-url"></p>
    <button id="run-checks" type="button">Run Diagnostics</button>
    <button id="copy-log" type="button">Copy Report</button>
  </section>

  <section class="panel">
    <h2>Environment Checks</h2>
    <div class="checks" id="checks">
      <div class="check">
        <div class="check-title">Browser</div>
        <div class="check-status">Waiting for diagnostics...</div>
      </div>
    </div>
  </section>

  <section class="panel">
    <h2>Installation Readiness</h2>
    <div class="check">
      <div class="check-title">PWA Installation</div>
      <div class="check-status" id="install-status">
        Checking manifest and browser support...
      </div>
      <button id="install-app" type="button" hidden>
        Install JARVIS
      </button>
      <p class="muted">
        Installation availability depends on browser support and the
        validity of the web app manifest and icons.
      </p>
    </div>
  </section>

  <section class="panel">
    <h2>Diagnostic Report</h2>
    <pre id="report" aria-live="polite">JARVIS diagnostic log initialized.</pre>
  </section>

  <footer>J.A.R.V.I.S. · Diagnostic dashboard</footer>
</main>

<script>
(() => {
  "use strict";

  const $ = id => document.getElementById(id);
  const logLines = [];
  const results = [];
  let deferredInstallPrompt = null;
  let running = false;

  function log(message) {
    const line = "[" + new Date().toLocaleTimeString() + "] " + message;
    logLines.push(line);
    if (logLines.length > 250) logLines.shift();
    $("report").textContent = logLines.join("\n");
  }

  function addCheck(name, status, detail, type) {
    results.push({ name, status, detail, type });

    const card = document.createElement("div");
    card.className = "check";

    const title = document.createElement("div");
    title.className = "check-title";
    title.textContent = name;

    const value = document.createElement("div");
    value.className = "check-status " + (type || "");
    value.textContent = status + " — " + detail;

    card.append(title, value);
    $("checks").appendChild(card);
    log(name + ": " + status + " — " + detail);
  }

  async function checkResource(url, label) {
    try {
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) {
        addCheck(label, "WARNING", "HTTP " + response.status, "warn");
        return false;
      }
      addCheck(label, "OK", "Resource is reachable", "pass");
      return true;
    } catch (error) {
      addCheck(label, "WARNING",
        "Could not fetch resource; check path or network", "warn");
      return false;
    }
  }

  async function runDiagnostics() {
    if (running) return;
    running = true;

    $("run-checks").disabled = true;
    $("checks").replaceChildren();
    results.length = 0;
    logLines.length = 0;

    $("overall-status").textContent = "CHECKING...";
    $("overall-dot").style.background = "var(--yellow)";
    $("checked-at").textContent = "Started: " + new Date().toLocaleString();
    $("page-url").textContent = "Page: " + location.href;

    log("JARVIS diagnostics started.");

    addCheck("HTTPS", location.protocol === "https:" ? "OK" : "WARNING",
      location.protocol === "https:"
        ? "Secure context detected"
        : "Use HTTPS for GitHub Pages and service workers",
      location.protocol === "https:" ? "pass" : "warn");

    addCheck("JavaScript", "OK", "Diagnostic script is running", "pass");

    addCheck("Service Worker support",
      "serviceWorker" in navigator ? "OK" : "WARNING",
      "serviceWorker" in navigator
        ? "Browser API is available"
        : "Browser does not support Service Workers",
      "serviceWorker" in navigator ? "pass" : "warn");

    addCheck("Online status", navigator.onLine ? "OK" : "WARNING",
      navigator.onLine ? "Browser reports online" : "Browser reports offline",
      navigator.onLine ? "pass" : "warn");

    addCheck("Speech recognition",
      ("SpeechRecognition" in window ||
       "webkitSpeechRecognition" in window) ? "SUPPORTED" : "WARNING",
      "Voice recognition depends on browser support and permissions",
      ("SpeechRecognition" in window ||
       "webkitSpeechRecognition" in window) ? "pass" : "warn");

    addCheck("Text-to-speech",
      "speechSynthesis" in window ? "SUPPORTED" : "WARNING",
      "Voice availability may vary by device",
      "speechSynthesis" in window ? "pass" : "warn");

    addCheck("Camera / image input",
      "mediaDevices" in navigator &&
      "getUserMedia" in (navigator.mediaDevices || {})
        ? "SUPPORTED" : "LIMITED",
      "Image file selection can still work without camera API access",
      "warn");

    await checkResource("./manifest.json", "Manifest");
    await checkResource("./style.css", "Stylesheet");
    await checkResource("./script.js", "Application JavaScript");
    await checkResource("./sw.js", "Service Worker file");
    await checkResource("./icons/icon-192.png", "192px app icon");
    await checkResource("./icons/icon-512.png", "512px app icon");

    if ("serviceWorker" in navigator &&
        location.protocol === "https:") {
      try {
        const registration = await navigator.serviceWorker.getRegistration();
        addCheck("Service Worker registration",
          registration ? "REGISTERED" : "NOT REGISTERED",
          registration
            ? "Scope: " + registration.scope
            : "Registration missing; check index.html and sw.js",
          registration ? "pass" : "warn");
      } catch (error) {
        addCheck("Service Worker registration", "WARNING",
          "Unable to inspect registration", "warn");
      }
    }

    const failures = results.filter(item => item.type === "fail").length;
    const warnings = results.filter(item => item.type === "warn").length;

    $("overall-status").textContent =
      failures ? "CHECK FAILED" :
      warnings ? "CHECK COMPLETE — WARNINGS FOUND" :
      "CHECK COMPLETE";

    $("overall-dot").style.background =
      failures ? "var(--red)" :
      warnings ? "var(--yellow)" : "var(--green)";

    $("checked-at").textContent =
      "Completed: " + new Date().toLocaleString() +
      " · Warnings: " + warnings;

    log("Diagnostics completed. Warnings: " + warnings +
        "; failures: " + failures + ".");
    running = false;
    $("run-checks").disabled = false;
  }

  window.addEventListener("beforeinstallprompt", event => {
    event.preventDefault();
    deferredInstallPrompt = event;
    $("install-app").hidden = false;
    $("install-status").textContent =
      "Browser reports that installation is available.";
    log("Install prompt is available.");
  });

  window.addEventListener("appinstalled", () => {
    deferredInstallPrompt = null;
    $("install-app").hidden = true;
    $("install-status").textContent = "App installed.";
    log("App installation event received.");
  });

  $("install-app").addEventListener("click", async () => {
    if (!deferredInstallPrompt) {
      $("install-status").textContent =
        "Install prompt unavailable. Use the browser menu and check PWA setup.";
      return;
    }

    deferredInstallPrompt.prompt();
    const choice = await deferredInstallPrompt.userChoice;
    log("Install choice: " + choice.outcome);
    deferredInstallPrompt = null;
    $("install-app").hidden = true;
  });

  $("run-checks").addEventListener("click", runDiagnostics);

  $("copy-log").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(logLines.join("\n"));
      $("copy-log").textContent = "Copied!";
      setTimeout(() => $("copy-log").textContent = "Copy Report", 1600);
    } catch (error) {
      log("Clipboard unavailable. Select and copy the report manually.");
    }
  });

  runDiagnostics();
})();
</script>
</body>
</html>
