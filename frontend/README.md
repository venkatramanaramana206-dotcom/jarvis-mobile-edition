# JARVIS AI Assistant — starter project

A responsive, futuristic assistant interface inspired by the reference image. Includes a Gemini API settings dialog, chat requests, browser speech recognition and speech output, time/date responses, weather via Open-Meteo, YouTube search, local image preview/basic filters, video preview, and an installable PWA shell.

## Run it
1. Extract the ZIP.
2. Host the folder on HTTPS (for example, GitHub Pages or Netlify) or run a local static server.
3. Open `index.html` in a modern browser. Microphone, geolocation and service worker features generally require HTTPS or localhost.
4. Add your Gemini API key in Settings. The key is stored in this browser's localStorage on this device.
5. Use the microphone or text box to interact.

For local testing, use a static server such as `python -m http.server 8000`, then open `http://localhost:8000`.

## Project files
- `index.html` — app layout, dialogs, dashboard
- `styles.css` — responsive neon/holographic UI
- `app.js` — assistant logic, Gemini API call, voice, weather, media tools
- `manifest.webmanifest` — PWA metadata
- `sw.js` — basic same-origin shell caching

## Important limits (do not mistake this starter for a fully privileged Android assistant)
- This is a browser/PWA starter, not a native Android app. Browser JavaScript cannot reliably open arbitrary installed apps, answer/manage phone calls, announce caller ID, control the device while the screen is off, or keep running indefinitely in the background. Those features need native Android code, explicit Android permissions, and often a foreground service/notification.
- Voice recognition support varies by browser and may need internet. Speech output can stop when the browser/app is suspended or the screen is locked.
- Offline mode supports only the small built-in commands and cached app shell. Gemini responses and weather need internet. AI responses do not work offline with this cloud API.
- The photo tool applies a few simple CSS filters and exports a PNG. It is not a full professional image editor. The video tool previews files and links to an online editor; it does not provide a complete video-editing timeline.
- YouTube search opens search results; autoplay/background playback is controlled by YouTube and browser/device policy.
- A client-side API key is not secret. For public production apps, route Gemini calls through a secured backend, add rate limits, and never publish a private key in a public repository.
- The Gemini REST API/model availability can change. If you get a model or key error, verify the model name and API key permissions in Google AI Studio.

## Security and privacy
The app stores the key and preferred name locally in this browser only. It does not send the key anywhere except the configured Gemini API request. Weather uses browser location only after permission and calls Open-Meteo. Do not publish a build containing your personal key.
