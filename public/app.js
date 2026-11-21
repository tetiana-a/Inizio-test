const form = document.querySelector("#search-form");
const input = document.querySelector("#q");
const submit = document.querySelector("#submit");
const statusEl = document.querySelector("#status");
const output = document.querySelector("#output");
const meta = document.querySelector("#meta");
const list = document.querySelector("#results");
const downloadJson = document.querySelector("#download-json");
const downloadCsv = document.querySelector("#download-csv");

const apiUrl = (query, params = {}) => `/api/search?${new URLSearchParams({ q: query, ...params })}`;

// View Transitions API tam, kde ji prohlížeč umí; jinak se změna provede rovnou.
const transition = (update) => (document.startViewTransition ? document.startViewTransition(update) : update());

async function search(query) {
  setLoading(true);
  showStatus("Načítám výsledky z Google…");
  showSkeleton();
  try {
    const response = await fetch(apiUrl(query));
    const data = await response.json().catch(() => null);
    if (!response.ok) throw new Error(data?.error?.message ?? `Chyba serveru (HTTP ${response.status})`);
    transition(() => render(data));
    history.replaceState(null, "", `?${new URLSearchParams({ q: query })}`);
  } catch (err) {
    transition(() => {
      output.hidden = true;
      showStatus(err instanceof Error ? err.message : "Neznámá chyba", true);
    });
  } finally {
    setLoading(false);
  }
}

function render(data) {
  list.replaceChildren(...data.results.map(renderItem));
  const time = new Date(data.searchedAt).toLocaleString("cs-CZ");
  const count = document.createElement("strong");
  count.textContent = String(data.resultsCount);
  meta.replaceChildren(count, ` organických výsledků · ${data.locale.googleDomain} · ${time}`);
  downloadJson.href = apiUrl(data.query, { format: "json", download: "1" });
  downloadCsv.href = apiUrl(data.query, { format: "csv" });
  output.hidden = false;
  showStatus(data.resultsCount ? "" : "Google pro toto slovo nevrátil žádné organické výsledky.");
}

// Vše přes textContent – titulky a úryvky z Google se nikdy nevkládají jako HTML.
function renderItem(result, index) {
  const item = document.createElement("li");
  item.className = "result";
  item.style.setProperty("--i", String(index));

  const position = document.createElement("span");
  position.className = "position";
  position.textContent = String(result.position);

  const body = document.createElement("div");
  body.className = "result-body";

  const link = document.createElement("a");
  link.href = result.url;
  link.textContent = result.title;
  link.target = "_blank";
  link.rel = "noopener noreferrer nofollow";

  const url = document.createElement("p");
  url.className = "url";
  const favicon = document.createElement("img");
  favicon.src = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(result.domain)}&sz=32`;
  favicon.alt = "";
  favicon.loading = "lazy";
  favicon.addEventListener("error", () => favicon.remove());
  url.append(favicon, result.displayedUrl);

  const snippet = document.createElement("p");
  snippet.className = "snippet";
  snippet.textContent = result.snippet;

  body.append(link, url, snippet);
  item.append(position, body);
  return item;
}

function showSkeleton() {
  const items = Array.from({ length: 4 }, (_, i) => {
    const item = document.createElement("li");
    item.className = "result skeleton";
    item.style.setProperty("--i", String(i));
    item.innerHTML =
      '<span class="position">0</span><div><div class="bar title-bar"></div><div class="bar short"></div><div class="bar"></div></div>';
    return item;
  });
  list.replaceChildren(...items);
  meta.textContent = "";
  output.hidden = false;
}

// Zlatý „spotlight“ na kartě sleduje kurzor.
list.addEventListener("pointermove", (event) => {
  const card = event.target instanceof Element ? event.target.closest(".result") : null;
  if (!card) return;
  const rect = card.getBoundingClientRect();
  card.style.setProperty("--mx", `${event.clientX - rect.left}px`);
  card.style.setProperty("--my", `${event.clientY - rect.top}px`);
});

function showStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.classList.toggle("error", isError);
}

function setLoading(loading) {
  submit.disabled = loading;
  submit.firstElementChild.textContent = loading ? "Hledám…" : "Vyhledat";
  form.setAttribute("aria-busy", String(loading));
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const query = input.value.trim();
  if (!query) {
    showStatus("Zadejte klíčové slovo.", true);
    input.focus();
    return;
  }
  search(query);
});

// Odkaz ve tvaru ?q=slovo rovnou spustí vyhledávání.
const initial = new URLSearchParams(location.search).get("q");
if (initial?.trim()) {
  input.value = initial.trim();
  search(initial.trim());
}
