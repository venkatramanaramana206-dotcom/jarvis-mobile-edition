
(() => {
  "use strict";

  const MODEL = "gemini-3.8-flash";
  const API_URL =
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

  const KEY_NAME = "jarvis_key";
  let apiKey = localStorage.getItem(KEY_NAME) || "";

  const $ = (...ids) =>
    ids.map(id => document.getElementById(id)).find(Boolean);

  function showMessage(text, type = "info") {
    const chat = $("chat", "chat-messages", "messages");
    if (!chat) {
      alert(text);
      return;
    }

    const bubble = document.createElement("div");
    bubble.className = `message ${type}`;
    bubble.style.cssText =
      "padding:12px;margin:10px 0;border-radius:12px;" +
      "white-space:pre-wrap;overflow-wrap:anywhere;";

    bubble.textContent = text;
    chat.appendChild(bubble);
    chat.scrollTop = chat.scrollHeight;
  }

  function createKeyScreen() {
    if ($("jarvis-api-screen")) return;

    const screen = document.createElement("div");
    screen.id = "jarvis-api-screen";
    screen.style.cssText = `
      position:fixed;inset:0;z-index:99999;
      background:#050b18;color:#eaf6ff;
      display:flex;align-items:center;justify-content:center;
      padding:22px;font-family:Arial,sans-serif;
    `;

    screen.innerHTML = `
      <div style="width:100%;max-width:420px;padding:24px;
        border:1px solid #24628b;border-radius:20px;
        background:#0b1729;box-shadow:0 0 30px #007bff30">
        <h2 style="color:#58d6ff;margin-top:0">J.A.R.V.I.S.</h2>
        <p>Enter your Gemini API key to start the AI assistant.</p>
        <form id="jarvis-api-form">
          <input id="jarvis-api-input" type="password"
            autocomplete="off" placeholder="Paste your API key"
            required style="box-sizing:border-box;width:100%;
            padding:14px;border-radius:10px;border:1px solid #345;
            background:#07101e;color:white;margin:10px 0">
          <label style="display:block;font-size:14px;margin:8px 0">
            <input id="jarvis-save-key" type="checkbox" checked>
            Save key on this device
          </label>
          <button type="submit" style="width:100%;padding:13px;
            border:0;border-radius:10px;background:#0785ff;
            color:white;font-weight:bold">Connect JARVIS</button>
          <p id="jarvis-api-status" role="status"
            style="overflow-wrap:anywhere;font-size:13px"></p>
        </form>
      </div>`;

    document.body.appendChild(screen);

    const input = $("jarvis-api-input");
    input.value = apiKey;

    $("jarvis-api-form").addEventListener("submit", async event => {
      event.preventDefault();

      const enteredKey = input.value.trim();
      const status = $("jarvis-api-status");
      const button = event.submitter;

      if (!enteredKey) {
        status.textContent = "Please enter your API key.";
        return;
      }

      button.disabled = true;
      status.textContent = "Checking API key...";

      try {
        const response = await fetch(API_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": enteredKey
          },
          body: JSON.stringify({
            contents: [{
              parts: [{ text: "Reply with: JARVIS connected successfully." }]
            }],
            generationConfig: { maxOutputTokens: 60 }
          })
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.error?.message || `API request failed (${response.status})`
          );
        }

        apiKey = enteredKey;

        if ($("jarvis-save-key").checked) {
          localStorage.setItem(KEY_NAME, apiKey);
        } else {
          localStorage.removeItem(KEY_NAME);
        }

        screen.remove();
        showMessage("JARVIS is connected and ready, Boss.", "jarvis");
      } catch (error) {
        status.textContent =
          "Connection failed: " + error.message +
          " Check the API key, model access, and internet connection.";
      } finally {
        button.disabled = false;
      }
    });
  }

  async function askJarvis(message) {
    if (!apiKey) {
      createKeyScreen();
      return;
    }

    const prompt = message.trim();
    if (!prompt) return;

    showMessage(prompt, "user");

    const sendButton = $("send-btn", "send-button");
    if (sendButton) sendButton.disabled = true;

    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey
        },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: prompt }]
          }],
          generationConfig: { maxOutputTokens: 1024 }
        })
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 400 || response.status === 403) {
          showMessage(
            "API request failed. Check your key, model access, and API settings.",
            "error"
          );
        } else {
          showMessage(
            data.error?.message || `Request failed (${response.status})`,
            "error"
          );
        }
        return;
      }

      const answer = (data.candidates?.[0]?.content?.parts || [])
        .map(part => part.text || "")
        .join("\n")
        .trim();

      showMessage(answer || "No text response received.", "jarvis");
    } catch (error) {
      showMessage(
        "Network error. Please check your internet connection and try again.",
        "error"
      );
    } finally {
      if (sendButton) sendButton.disabled = false;
    }
  }

  function init() {
    const form = $("chat-form");
    const input = $("message-input", "chat-input", "user-input");
    const send = $("send-btn", "send-button");

    if (form && input) {
      form.addEventListener("submit", event => {
        event.preventDefault();
        const text = input.value.trim();
        if (!text) return;
        input.value = "";
        askJarvis(text);
      });
    } else if (send && input) {
      send.addEventListener("click", () => {
        const text = input.value.trim();
        if (!text) return;
        input.value = "";
        askJarvis(text);
      });
    }

    const settings = $("settings-btn", "settings-button");
    if (settings) {
      settings.addEventListener("click", () => {
        apiKey = "";
        localStorage.removeItem(KEY_NAME);
        createKeyScreen();
      });
    }

    if (!apiKey) createKeyScreen();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
