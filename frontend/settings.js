
const STORAGE_KEY = "jarvis_settings_v1";

function readSettings() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

export function getSetting(name) {
  return readSettings()[name] || "";
}

export function initSettings(say = console.log) {
  const keyInput = document.getElementById("newsApiKey");
  keyInput.value = getSetting("newsApiKey");

  document.getElementById("saveSettings").addEventListener("click", () => {
    const settings = readSettings();
    settings.newsApiKey = keyInput.value.trim();

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
      say("Settings ఈ browserలో సేవ్ అయ్యాయి.");
    } catch {
      say("Settings సేవ్ చేయలేకపోయాను. Browser storage అందుబాటులో ఉందో చూడండి.");
    }
  });
}
