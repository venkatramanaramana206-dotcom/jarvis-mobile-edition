export async function routeCommand(rawCommand, actions) {
  const command = rawCommand.toLowerCase().trim();

  if (!command) {
    return { message: "దయచేసి command ఇవ్వండి." };
  }

  const has = (...words) => words.some(word => command.includes(word));

  if (has("weather", "వాతావరణం", "వెదర్", "temperature")) {
    await actions.weather();
    return {};
  }

  if (has("news", "వార్తలు", "headlines")) {
    await actions.news();
    return {};
  }

  if (has("time", "సమయం", "టైమ్", "date", "తేదీ")) {
    const now = new Date();
    actions.say(
      "ప్రస్తుత సమయం: " +
      now.toLocaleTimeString() +
      " | తేదీ: " +
      now.toLocaleDateString()
    );
    return {};
  }

  if (has("youtube", "యూట్యూబ్")) {
    if (await actions.ask("YouTube తెరవాలా?")) {
      window.open("https://www.youtube.com/", "_blank", "noopener");
    }
    return { message: "YouTube కోసం browser తెరవడానికి ప్రయత్నించాను." };
  }

  if (has("google", "search", "వెతుకు", "సెర్చ్")) {
    const query = command
      .replace(/search|google|వెతుకు|సెర్చ్/gi, "")
      .trim();

    if (!query) {
      return { message: "ఏ విషయం కోసం వెతకాలో చెప్పండి." };
    }

    window.open(
      "https://www.google.com/search?q=" + encodeURIComponent(query),
      "_blank",
      "noopener"
    );
    return { message: `Googleలో వెతుకుతున్నాను: ${query}` };
  }

  if (has("wikipedia", "వికీపీడియా")) {
    window.open("https://www.wikipedia.org/", "_blank", "noopener");
    return { message: "Wikipedia తెరవడానికి ప్రయత్నించాను." };
  }

  if (has("camera", "కెమెరా", "ఫోటో")) {
    await actions.camera();
    return {};
  }

  if (has("music", "మ్యూజిక్", "పాట", "play song", "ఆడియో")) {
    actions.say("ఆడియో ఎంచుకోండి లేదా Music Centerలో play చేయండి.");
    actions.music();
    return {};
  }

  if (has("video editor", "edit video", "వీడియో ఎడిట్")) {
    document.getElementById("videoInput").click();
    return { message: "ఎడిట్ చేయడానికి వీడియో ఎంచుకోండి." };
  }

  if (has("call", "ఫోన్ చేయి", "కాల్ చేయి", "డయల్")) {
    await actions.call();
    return {};
  }

  if (has("share", "షేర్", "పంపించు")) {
    await actions.share();
    return {};
  }

  if (has("open", "తెరువు", "ఓపెన్")) {
    if (await actions.ask("మీరు కోరిన వెబ్‌సైట్‌ను తెరవడానికి ప్రయత్నించనా?")) {
      const query = command.replace(/open|తెరువు|ఓపెన్/gi, "").trim();
      if (query) {
        const knownSites = {
          youtube: "https://www.youtube.com/",
          google: "https://www.google.com/",
          whatsapp: "https://web.whatsapp.com/"
        };
        const url = knownSites[query] ||
          ("https://www.google.com/search?q=" + encodeURIComponent(query));
        window.open(url, "_blank", "noopener");
      }
    }
    return { message: "ఆదేశాన్ని ప్రాసెస్ చేశాను." };
  }

  return {
    message:
      "మీ ఆదేశం పూర్తిగా అర్థం కాలేదు. Weather, News, Time, YouTube, " +
      "Google search, Camera, Music లేదా Video Editor అని ప్రయత్నించండి."
  };
}
