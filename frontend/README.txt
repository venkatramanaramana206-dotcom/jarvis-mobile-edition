
J.A.R.V.I.S. AI PROJECT
=======================

FILES
-----
index.html    Main HTML, CSS and JavaScript app
manifest.json App installation configuration
sw.js         Service Worker and basic offline caching
README.txt    Project instructions

HOW TO USE
----------
1. Keep all project files in the same folder.
2. Host the folder on an HTTPS website.
3. Open the website in a compatible Android browser.
4. Allow microphone permission when prompted.
5. Open Settings and enter your Gemini API key.
6. Enter an OpenWeather API key to enable weather.
7. Choose your preferred language and save settings.
8. Use the microphone or type a command.

VOICE COMMAND EXAMPLES
----------------------
What time is it?
What is the weather?
Open YouTube
Play music
Call 9876543210

IMPORTANT LIMITATIONS
---------------------
- This is a Progressive Web App (PWA), not an APK.
- Microphone recognition depends on browser support.
- Battery information may not be available in every browser.
- Weather requires an OpenWeather API key.
- AI answers require a valid Gemini API key and internet.
- Video styles are preview filters, not AI-generated effects.
- Downloading saves the original video without rendering filters.
- Actual AI video generation needs a suitable video service.
- Phone calls require confirmation on the device.

API KEY SECURITY
----------------
This starter stores keys in browser local storage.
Do not use this approach for a public production app.
A secure backend is recommended to protect API keys.
