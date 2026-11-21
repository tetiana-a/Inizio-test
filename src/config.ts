import { SerpApiProvider } from "./search/providers/serpapi.js";
import { SerperProvider } from "./search/providers/serper.js";
import type { SearchLocale, SerpProvider } from "./search/types.js";

type Env = Record<string, string | undefined>;

/**
 * Vybere zdroj dat podle proměnných prostředí:
 * SERP_PROVIDER=serpapi|serper (nepovinné), SERPAPI_API_KEY, SERPER_API_KEY.
 * Bez klíče vrací null – aplikace pak hlásí, že není nakonfigurovaná.
 */
export function providerFromEnv(env: Env = process.env): SerpProvider | null {
  const wanted = env.SERP_PROVIDER?.trim().toLowerCase();
  const serpApiKey = env.SERPAPI_API_KEY?.trim();
  const serperKey = env.SERPER_API_KEY?.trim();

  if (wanted === "serper") return serperKey ? new SerperProvider(serperKey) : null;
  if (wanted === "serpapi") return serpApiKey ? new SerpApiProvider(serpApiKey) : null;
  if (serpApiKey) return new SerpApiProvider(serpApiKey);
  if (serperKey) return new SerperProvider(serperKey);
  return null;
}

/** Výchozí lokalizace: česká verze Google. */
export function localeFromEnv(env: Env = process.env): SearchLocale {
  return {
    gl: env.SEARCH_GL?.trim() || "cz",
    hl: env.SEARCH_HL?.trim() || "cs",
    googleDomain: env.SEARCH_GOOGLE_DOMAIN?.trim() || "google.cz",
  };
}
