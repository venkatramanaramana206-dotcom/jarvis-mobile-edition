export async function loadNews(apiKey, say = console.log) {
  if (!apiKey) {
    say("ముందుగా Settingsలో NewsAPI key నమోదు చేయండి.");
    return;
  }

  try {
    say("తాజా వార్తలు తెస్తున్నాను...");

    const url = new URL("https://newsapi.org/v2/top-headlines");
    url.searchParams.set("country", "in");
    url.searchParams.set("pageSize", "10");

    const response = await fetch(url, {
      headers: { "X-Api-Key": apiKey }
    });

    const data = await response.json();

    if (!response.ok || data.status !== "ok") {
      throw new Error(data.message || "News API request failed");
    }

    const articles = (data.articles || []).filter(article => article.title);

    if (!articles.length) {
      say("ప్రస్తుతం వార్తలు అందుబాటులో లేవు.");
      return;
    }

    const result = articles.map((article, index) =>
      `${index + 1}. ${article.title}\n${article.url || ""}`
    ).join("\n\n");

    say(result);

    const panel = document.getElementById("response");
    panel.replaceChildren();

    articles.slice(0, 5).forEach((article) => {
      const item = document.createElement("p");
      const link = document.createElement("a");

      link.textContent = article.title;
      link.href = article.url || "#";
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.style.color = "#42e8ff";

      item.append(link);
      panel.append(item);
    });
  } catch (error) {
    say("వార్తలు తెచ్చేటప్పుడు సమస్య: " + error.message);
  }
}
