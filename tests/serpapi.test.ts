import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { SerpApiProvider } from "../src/search/providers/serpapi.js";
import { ProviderError } from "../src/search/types.js";
import { CZ, fakeFetch } from "./helpers.js";

const fixture = JSON.parse(readFileSync(new URL("./fixtures/serpapi-kavovar.json", import.meta.url), "utf8"));

describe("SerpApiProvider", () => {
  it("sestaví dotaz na českou verzi Google (engine, q, google_domain, gl, hl, api_key)", async () => {
    const fetchFn = fakeFetch(200, fixture);
    await new SerpApiProvider("tajny-klic", fetchFn).search("kávovar brno", CZ);

    const url = new URL(String(fetchFn.mock.calls[0]?.[0]));
    expect(url.origin + url.pathname).toBe("https://serpapi.com/search.json");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      engine: "google",
      q: "kávovar brno",
      google_domain: "google.cz",
      gl: "cz",
      hl: "cs",
      api_key: "tajny-klic",
    });
  });

  it("vrátí jen organické výsledky – bez reklam, místních výsledků a „Lidé se také ptají“", async () => {
    const results = await new SerpApiProvider("k", fakeFetch(200, fixture)).search("kávovar", CZ);

    expect(results).toHaveLength(fixture.organic_results.length);
    const urls = results.map((r) => r.url);
    for (const ad of fixture.ads) expect(urls).not.toContain(ad.link);
    expect(results.map((r) => r.title)).not.toContain("Kavárna U Testu");
  });

  it("převede pole do jednotného formátu a zachová pořadí 1..n", async () => {
    const results = await new SerpApiProvider("k", fakeFetch(200, fixture)).search("kávovar", CZ);

    expect(results.map((r) => r.position)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(results[0]).toEqual({
      position: 1,
      title: "Kávovar – Wikipedie",
      url: "https://cs.wikipedia.org/wiki/K%C3%A1vovar",
      displayedUrl: "https://cs.wikipedia.org › wiki › Kávovar",
      domain: "cs.wikipedia.org",
      snippet:
        "Kávovar je přístroj určený k přípravě kávy. Existuje mnoho typů, např. pákový, automatický nebo překapávač.",
    });
    expect(results[1]?.domain).toBe("srovnavac-test.cz");
  });

  it("u odkazu google.cz/goto vezme doménu ze zobrazené URL", async () => {
    const results = await new SerpApiProvider("k", fakeFetch(200, fixture)).search("kávovar", CZ);
    expect(results[5]).toMatchObject({
      url: "https://www.google.cz/goto?url=CAESiQEBxCJF18x36GdBHHRHJEwFOcc",
      domain: "firmy-test.cz",
    });
  });

  it("prázdná výsledková stránka vrátí prázdný seznam, ne chybu", async () => {
    const body = { error: "Google hasn't returned any results for this query." };
    await expect(new SerpApiProvider("k", fakeFetch(200, body)).search("xqzv", CZ)).resolves.toEqual([]);
  });

  it("neplatný API klíč vyhodí ProviderError se statusem a bez klíče ve zprávě", async () => {
    const provider = new SerpApiProvider("spatny-klic", fakeFetch(401, { error: "Invalid API key." }));
    const error = await provider.search("kávovar", CZ).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ProviderError);
    expect((error as ProviderError).status).toBe(401);
    expect((error as ProviderError).message).toContain("Invalid API key");
    expect((error as ProviderError).message).not.toContain("spatny-klic");
  });

  it("síťová chyba se převede na ProviderError", async () => {
    const failing = async () => {
      throw new TypeError("fetch failed");
    };
    await expect(new SerpApiProvider("k", failing).search("kávovar", CZ)).rejects.toThrow(ProviderError);
  });
});
