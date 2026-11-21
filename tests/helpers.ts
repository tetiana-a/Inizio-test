import { vi } from "vitest";
import type { FetchFn, SearchResponse } from "../src/search/types.js";

/** Falešný fetch – vrací zadaný HTTP status a JSON tělo, bez sítě. */
export function fakeFetch(status: number, body: unknown) {
  return vi.fn<FetchFn>(async () =>
    new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }),
  );
}

export const CZ = { gl: "cz", hl: "cs", googleDomain: "google.cz" };

export function sampleResponse(overrides: Partial<SearchResponse> = {}): SearchResponse {
  return {
    query: "kávovar",
    provider: "test",
    searchedAt: "2026-11-20T15:00:00.000Z",
    locale: CZ,
    resultsCount: 2,
    results: [
      {
        position: 1,
        title: "Kávovar – Wikipedie",
        url: "https://cs.wikipedia.org/wiki/K%C3%A1vovar",
        displayedUrl: "https://cs.wikipedia.org › wiki › Kávovar",
        domain: "cs.wikipedia.org",
        snippet: "Kávovar je přístroj určený k přípravě kávy.",
      },
      {
        position: 2,
        title: 'Recenze: "nejlepší" kávovary, ceny, srovnání',
        url: "https://www.srovnavac-test.cz/kavovary/",
        displayedUrl: "https://www.srovnavac-test.cz › kavovary",
        domain: "srovnavac-test.cz",
        snippet: "Řádek 1\nřádek 2",
      },
    ],
    ...overrides,
  };
}
