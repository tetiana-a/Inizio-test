import { normalizeOrganic } from "../normalize.js";
import { ProviderError, type FetchFn, type OrganicResult, type SearchLocale, type SerpProvider } from "../types.js";
import { fetchJson } from "./http.js";

const ENDPOINT = "https://google.serper.dev/search";

interface SerperResponse {
  message?: string;
  organic?: Array<{
    position?: number;
    title?: string;
    link?: string;
    snippet?: string;
  }>;
}

/** https://serper.dev – alternativní zdroj (2 500 dotazů zdarma při registraci). */
export class SerperProvider implements SerpProvider {
  readonly name = "serper";

  constructor(
    private readonly apiKey: string,
    private readonly fetchFn: FetchFn = fetch,
  ) {}

  async search(query: string, locale: SearchLocale): Promise<OrganicResult[]> {
    const { status, body } = await fetchJson<SerperResponse>(this.fetchFn, ENDPOINT, {
      method: "POST",
      headers: { "X-API-KEY": this.apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ q: query, gl: locale.gl, hl: locale.hl }),
    });

    if (status >= 400) {
      throw new ProviderError(`Serper: ${body.message ?? `HTTP ${status}`}`, status);
    }

    // Pole `organic` neobsahuje reklamy ani „Lidé se také ptají“, znalostní panel apod.
    return normalizeOrganic(
      (body.organic ?? []).map((r) => ({
        position: r.position,
        title: r.title,
        link: r.link,
        snippet: r.snippet,
      })),
    );
  }
}
