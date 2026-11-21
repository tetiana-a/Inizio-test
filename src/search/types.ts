/** Jeden organický (neplacený) výsledek z 1. strany Google. */
export interface OrganicResult {
  /** Pořadí mezi organickými výsledky (1 = první). */
  position: number;
  title: string;
  url: string;
  /** URL tak, jak ji zobrazuje Google (drobečková navigace), jinak hostname. */
  displayedUrl: string;
  /** Doména bez „www.“. */
  domain: string;
  snippet: string;
}

/** Lokalizace vyhledávání – stejné klíčové slovo dává v CZ a US jiné výsledky. */
export interface SearchLocale {
  /** Země (Google parametr gl), např. "cz". */
  gl: string;
  /** Jazyk rozhraní (Google parametr hl), např. "cs". */
  hl: string;
  /** Doména Google, např. "google.cz". */
  googleDomain: string;
}

/** Odpověď API a zároveň obsah exportovaného JSON souboru. */
export interface SearchResponse {
  query: string;
  provider: string;
  /** Čas vyhledání ve formátu ISO 8601. */
  searchedAt: string;
  locale: SearchLocale;
  resultsCount: number;
  results: OrganicResult[];
}

/**
 * Zdroj dat z Google. Přímé stahování google.com z cloudu končí na CAPTCHA,
 * proto se data berou přes SERP API. Rozhraní dovoluje zdroj vyměnit
 * (jiné API, vlastní scraper s proxy) bez zásahu do zbytku aplikace.
 */
export interface SerpProvider {
  readonly name: string;
  search(query: string, locale: SearchLocale): Promise<OrganicResult[]>;
}

/** Chyba poskytovatele dat (neplatný klíč, vyčerpaný kredit, výpadek…). */
export class ProviderError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "ProviderError";
  }
}

export type FetchFn = typeof fetch;
