
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#030916">
  <title>J.A.R.V.I.S — Voice Assistant</title>

  <style>
    :root {
      color-scheme: dark;
      --bg: #030916;
      --panel: #07172d;
      --cyan: #22d7ff;
      --blue: #087dff;
      --text: #e7f7ff;
      --muted: #91b6d0;
      --border: #13528a;
    }

    * { box-sizing: border-box; }

    body {
      margin: 0;
      min-height: 100vh;
      padding: 24px 16px;
      display: grid;
      place-items: center;
      background:
        radial-gradient(circle at center, #09294c 0%, var(--bg) 65%);
      color: var(--text);
      font-family: system-ui, sans-serif;
    }

    .voice-app {
      width: 100%;
      max-width: 440px;
      text-align: center;
    }

    .brand {
      font-size: 28px;
      font-weight: 700;
      letter-spacing: 5px;
      color: var(--cyan);
      text-shadow: 0 0 20px #00aaff66;
    }

    .subtitle {
      color: var(--muted);
      margin: 8px 0 30px;
      letter-spacing: 2px;
      font-size: 12px;
    }

    .core {
      width: 250px;
      height: 250px;
      max-width: 75vw;
      max-height: 75vw;
      margin: 0 auto 25px;
      display: grid;
      place-items: center;
      position: relative;
      border: 1px solid #22d7ff55;
      border-radius: 50%;
      box-shadow: 0 0 50px #007dff18, inset 0 0 35px #007dff16;
    }

    .ring {
      position: absolute;
      inset: 15px;
      border: 2px solid transparent;
      border-top-color: var(--cyan);
      border-bottom-color: var(--blue);
      border-radius: 50%;
      animation: rotate 6s linear infinite;
    }

    .ring.two {
      inset: 31px;
      border-top-color: #a697ff;
      border-bottom-color: #22d7ff;
      animation-direction: reverse;
      animation-duration: 4s;
    }

    .ring.three {
      inset: 48px;
      border-style: dashed;
      border-right-color: var(--cyan);
      border-left-color: var(--blue);
      animation-duration: 10s;
    }

    .mic-button {
      width: 112px;
      height: 112px;
      border-radius: 50%;
      border: 3px solid var(--cyan);
      background: radial-gradient(circle, #0759a5, #031329);
      color: white;
      font-size: 46px;
      cursor: pointer;
      box-shadow: 0 0 25px #00bfff55, inset 0 0 18px #00aaff44;
      position: relative;
      z-index: 2;
      transition: transform .2s, box-shadow .2s;
    }

    .mic-button:active { transform: scale(.94); }

    .mic-button.listening {
      animation: pulse 1.3s ease-in-out infinite;
      box-shadow: 0 0 38px #00eaffaa;
    }

    h1 {
      font-size: 25px;
      margin: 12px 0;
    }

    #voice-status {
      color: var(--cyan);
      min-height: 25px;
      margin: 8px 0 20px;
    }

    .transcript {
      min-height: 70px;
      padding: 18px;
      border: 1px solid var(--border);
      border-radius: 14px;
      background: #07172dcc;
      color: var(--text);
      overflow-wrap: anywhere;
      text-align: left;
      line-height: 1.6;
    }

    .controls {
      display: flex;
      gap: 10px;
      margin-top: 20px;
    }

    .controls button, select {
      min-width: 0;
      flex: 1;
      padding: 12px 10px;
      border-radius: 10px;
      border: 1px solid var(--border);
      background: var(--panel);
      color: var(--text);
      font: inherit;
    }

    button { cursor: pointer; }

    button:focus-visible, select:focus-visible {
      outline: 2px solid var(--cyan);
      outline-offset: 3px;
    }

    .language {
      display: block;
      text-align: left;
      margin-top: 24px;
      color: var(--muted);
      font-size: 14px;
    }

    .language select {
      display: block;
      width: 100%;
      margin-top: 8px;
    }

    .hint {
      color: var(--muted);
      font-size: 12px;
      line-height: 1.6;
      margin-top: 22px;
    }

    @keyframes rotate {
      to { transform: rotate(360deg); }
    }

    @keyframes pulse {
      50% { transform: scale(1.06); }
    }

    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after {
        animation-duration: .01ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: .01ms !important;
      }
    }
  </style>
</head>

<body>
  <main class="voice-app">
    <div class="brand">J.A.R.V.I.S.</div>
    <p class="subtitle">VOICE INTERFACE</p>

    <div class="core" aria-hidden="true">
      <div class="ring"></div>
      <div class="ring two"></div>
      <div class="ring three"></div>

      <button id="mic-btn" class="mic-button"
        type="button" aria-label="Start voice recognition"
        aria-pressed="false">
        🎙
      </button>
    </div>

    <h1>Voice Assistant</h1>
    <p id="voice-status" role="status" aria-live="polite">
      Tap the microphone to speak.
    </p>

    <div class="transcript" id="transcript"
      aria-live="polite">
      Your recognized speech will appear here.
    </div>

    <div class="controls">
      <button type="button" id="stop-btn">■ Stop</button>
      <button type="button" id="clear-btn">Clear Text</button>
    </div>

    <label class="language" for="language-select">
      Recognition language
      <select id="language-select">
        <option value="te-IN">Telugu</option>
        <option value="en-IN">English (India)</option>
        <option value="en-US">English (US)</option>
        <option value="hi-IN">Hindi</option>
      </select>
    </label>

    <p class="hint">
      Microphone access requires permission. Voice recognition
      depends on browser support and may require an internet connection.
    </p>
  </main>

  <script>
    (() => {
      "use strict";

      const mic = document.getElementById("mic-btn");
      const stop = document.getElementById("stop-btn");
      const clear = document.getElementById("clear-btn");
      const status = document.getElementById("voice-status");
      const transcript = document.getElementById("transcript");
      const language = document.getElementById("language-select");

      const Recognition =
        window.SpeechRecognition ||
        window.webkitSpeechRecognition;

      let recognition = null;
      let listening = false;

      function setListening(value) {
        listening = value;
        mic.classList.toggle("listening", value);
        mic.setAttribute("aria-pressed", String(value));
        mic.setAttribute(
          "aria-label",
          value ? "Stop voice recognition" : "Start voice recognition"
        );
      }

      function stopListening(message) {
        setListening(false);

        if (recognition && listening === false) {
          try {
            recognition.stop();
          } catch (_) {}
        }

        if (message) status.textContent = message;
      }

      function startListening() {
        if (!Recognition) {
          status.textContent =
            "Voice recognition is not supported in this browser. Try a supported browser.";
          return;
        }

        if (listening) {
          stopListening("Voice recognition stopped.");
          return;
        }

        recognition = new Recognition();
        recognition.lang = language.value;
        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.maxAlternatives = 1;

        recognition.onstart = () => {
          setListening(true);
          status.textContent = "Listening... Speak now.";
        };

        recognition.onresult = event => {
          let text = "";

          for (let i = event.resultIndex; i < event.results.length; i++) {
            text += event.results[i][0].transcript;
          }

          transcript.textContent = text;
          status.textContent = "Speech detected.";
        };

        recognition.onerror = event => {
          setListening(false);

          const messages = {
            "not-allowed": "Microphone permission denied. Allow access in browser settings.",
            "no-speech": "No speech detected. Please try again.",
            "network": "Voice recognition network error. Check your internet.",
            "audio-capture": "No microphone was detected."
          };

          status.textContent =
            messages[event.error] || "Voice error: " + event.error;
        };

        recognition.onend = () => {
          setListening(false);

          if (status.textContent === "Listening... Speak now.") {
            status.textContent = "Voice recognition finished.";
          }
        };

        try {
          recognition.start();
        } catch (error) {
          setListening(false);
          status.textContent = "Could not start microphone. Try again.";
        }
      }

      mic.addEventListener("click", startListening);

      stop.addEventListener("click", () => {
        if (recognition) {
          try { recognition.stop(); } catch (_) {}
        }
        setListening(false);
        status.textContent = "Voice recognition stopped.";
      });

      clear.addEventListener("click", () => {
        transcript.textContent = "";
        status.textContent = "Transcript cleared.";
      });
    })();
  </script>
</body>
</html>
