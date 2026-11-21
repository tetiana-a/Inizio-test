import { normalizeOrganic } from "../normalize.js";
import { ProviderError, type FetchFn, type OrganicResult, type SearchLocale, type SerpProvider } from "../types.js";
import { fetchJson } from "./http.js";

const ENDPOINT = "https://serpapi.com/search.json";

/** Část odpovědi SerpApi, kterou potřebujeme. Reklamy jsou v samostatném poli `ads`. */
interface SerpApiResponse {
  error?: string;
  organic_results?: Array<{
    position?: number;
    title?: string;
    link?: string;
    displayed_link?: string;
    snippet?: string;
    source?: string;
  }>;
}

/** https://serpapi.com/search-api – engine=google, vrací 1. stranu výsledků. */
export class SerpApiProvider implements SerpProvider {
  readonly name = "serpapi";

  constructor(
    private readonly apiKey: string,
    private readonly fetchFn: FetchFn = fetch,
  ) {}

  buildUrl(query: string, locale: SearchLocale): string {
    const params = new URLSearchParams({
      engine: "google",
      q: query,
      google_domain: locale.googleDomain,
      gl: locale.gl,
      hl: locale.hl,
      api_key: this.apiKey,
    });
    return `${ENDPOINT}?${params}`;
  }

  async search(query: string, locale: SearchLocale): Promise<OrganicResult[]> {
    const { status, body } = await fetchJson<SerpApiResponse>(this.fetchFn, this.buildUrl(query, locale), {
      method: "GET",
    });

    if (body.error) {
      // Prázdná výsledková stránka není chyba – jen nic nenalezeno.
      if (/hasn't returned any results/i.test(body.error)) return [];
      throw new ProviderError(`SerpApi: ${body.error}`, status);
    }
    if (status >= 400) throw new ProviderError(`SerpApi vrátilo HTTP ${status}`, status);

    // Bereme jen `organic_results`; `ads`, `local_results`, `related_questions` atd. ignorujeme.
    return normalizeOrganic(
      (body.organic_results ?? []).map((r) => ({
        position: r.position,
        title: r.title,
        link: r.link,
        displayedLink: r.displayed_link,
        snippet: r.snippet,
        source: r.source,
      })),
    );
  }
}
