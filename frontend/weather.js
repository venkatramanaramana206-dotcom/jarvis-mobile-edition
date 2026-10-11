async function fetchJson(url) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error("Weather service error: " + response.status);
  }

  return response.json();
}

function describeWeather(code) {
  const descriptions = {
    0: "Clear sky",
    1: "Mainly clear",
    2: "Partly cloudy",
    3: "Overcast",
    45: "Fog",
    48: "Depositing rime fog",
    51: "Light drizzle",
    53: "Drizzle",
    55: "Dense drizzle",
    61: "Light rain",
    63: "Moderate rain",
    65: "Heavy rain",
    71: "Light snow",
    80: "Rain showers",
    81: "Rain showers",
    82: "Heavy rain showers",
    95: "Thunderstorm"
  };

  return descriptions[code] || "Weather code " + code;
}

async function fetchWeather(latitude, longitude, label, say) {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", latitude);
  url.searchParams.set("longitude", longitude);
  url.searchParams.set("current", "temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m");
  url.searchParams.set("timezone", "auto");

  const data = await fetchJson(url.toString());
  const current = data.current;

  document.getElementById("temperature").textContent =
    Math.round(current.temperature_2m) + "°C";

  document.getElementById("weatherText").textContent =
    `${label} · ${describeWeather(current.weather_code)}`;

  say(
    `${label}: ${current.temperature_2m}°C, ` +
    `${describeWeather(current.weather_code)}, feels like ` +
    `${current.apparent_temperature}°C, humidity ${current.relative_humidity_2m}%.`
  );
}

export async function weatherByCity(city, say = console.log) {
  try {
    say("నగరానికి సంబంధించిన వాతావరణాన్ని తెస్తున్నాను...");

    const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
    url.searchParams.set("name", city);
    url.searchParams.set("count", "1");
    url.searchParams.set("language", "en");
    url.searchParams.set("format", "json");

    const data = await fetchJson(url.toString());

    if (!data.results?.length) {
      throw new Error("నగరం కనబడలేదు. పేరును సరిచూసుకోండి.");
    }

    const place = data.results[0];

    await fetchWeather(place.latitude, place.longitude, place.name, say);
  } catch (error) {
    say("Weather పొందలేకపోయాను: " + error.message);
  }
}

export async function weatherByLocation(say = console.log) {
  if (!navigator.geolocation) {
    say("ఈ browserలో location అందుబాటులో లేదు. నగరం పేరును నమోదు చేయండి.");
    return;
  }

  navigator.geolocation.getCurrentPosition(
    async (position) => {
      await fetchWeather(
        position.coords.latitude,
        position.coords.longitude,
        "Current location",
        say
      ).catch(error => say("Weather error: " + error.message));
    },
    (error) => {
      say(
        "Location అనుమతి లభించలేదు (" + error.message +
        "). నగరం పేరును మాన్యువల్‌గా నమోదు చేయండి."
      );
    },
    { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
  );
}

export async function loadWeather(say = console.log) {
  const city = document.getElementById("cityInput").value.trim();

  if (city) {
    await weatherByCity(city, say);
  } else {
    await weatherByLocation(say);
  }
}
