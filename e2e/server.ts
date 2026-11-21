// Server pro end-to-end testy: skutečná aplikace (createApp + public/),
// jen SerpApi je nahrazené uloženou odpovědí z tests/fixtures – testy tak
// nepotřebují API klíč ani síť a dávají pokaždé stejný výsledek.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createApp } from "../src/app.js";
import { SerpApiProvider } from "../src/search/providers/serpapi.js";
import type { FetchFn } from "../src/search/types.js";

const path = (rel: string) => fileURLToPath(new URL(rel, import.meta.url));
const fixture = readFileSync(path("../tests/fixtures/serpapi-kavovar.json"), "utf8");
const json = (body: string, status = 200) =>
  new Response(body, { status, headers: { "Content-Type": "application/json" } });

// Speciální dotazy pro testování chybových stavů.
const serpFetch: FetchFn = async (input) => {
  const q = new URL(String(input)).searchParams.get("q");
  if (q === "chyba-serveru") return json(JSON.stringify({ error: "Internal error" }), 500);
  if (q === "bez-vysledku") return json(JSON.stringify({ search_metadata: { status: "Success" }, organic_results: [] }));
  return json(fixture);
};

// Odkaz google.cz/goto se v produkci rozbaluje přes hlavičku Location.
const redirectFetch: FetchFn = async () =>
  new Response(null, { status: 302, headers: { Location: "https://www.firmy-test.cz/kraj-jihomoravsky/brno-mesto" } });

const port = Number(process.env.E2E_PORT ?? 4173);

createApp({
  provider: new SerpApiProvider("e2e-test-key", serpFetch),
  locale: { gl: "cz", hl: "cs", googleDomain: "google.cz" },
  publicDir: path("../public"),
  rateLimitPerIp: false,
  redirectFetch,
}).listen(port, "127.0.0.1", () => console.log(`e2e server: http://127.0.0.1:${port}`));
