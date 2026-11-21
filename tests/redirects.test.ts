import { describe, expect, it, vi } from "vitest";
import { isGoogleRedirect, resolveGoogleRedirects } from "../src/search/redirects.js";
import type { FetchFn, OrganicResult } from "../src/search/types.js";

const GOTO = "https://www.google.cz/goto?url=CAESiQEBxCJF18x36GdBHH";

function result(url: string, domain = "google.cz"): OrganicResult {
  return { position: 1, title: "T", url, displayedUrl: "https://www.firmy.cz › brno", domain, snippet: "" };
}

/** Falešná odpověď Googlu na /goto: přesměrování s hlavičkou Location. */
const redirectTo = (location: string | null, status = 302) =>
  vi.fn<FetchFn>(async () => new Response(null, { status, headers: location ? { Location: location } : {} }));

describe("isGoogleRedirect", () => {
  it.each([
    [GOTO, true],
    ["https://www.google.com/url?q=https://a.cz/&sa=U", true],
    ["https://google.de/goto?url=CAES", true],
    ["https://www.google.cz/search?q=kavovar", false],
    ["https://www.firmy.cz/goto", false],
    ["neni url", false],
  ])("%s → %s", (url, expected) => {
    expect(isGoogleRedirect(url)).toBe(expected);
  });
});

describe("resolveGoogleRedirects", () => {
  it("nahradí /goto odkaz cílem z hlavičky Location a opraví doménu", async () => {
    const fetchFn = redirectTo("https://www.firmy.cz/kraj-jihomoravsky/brno-mesto");
    const [resolved] = await resolveGoogleRedirects([result(GOTO)], fetchFn);

    expect(resolved).toMatchObject({ url: "https://www.firmy.cz/kraj-jihomoravsky/brno-mesto", domain: "firmy.cz" });
    expect(fetchFn.mock.calls[0]?.[1]).toMatchObject({ redirect: "manual" });
  });

  it("běžné odkazy nechá být a nevolá síť", async () => {
    const fetchFn = redirectTo("https://x.cz/");
    const input = [result("https://www.dokonalakava.cz/", "dokonalakava.cz")];
    expect(await resolveGoogleRedirects(input, fetchFn)).toEqual(input);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it.each([
    ["bez hlavičky Location", redirectTo(null, 200)],
    ["Location vede zpět na Google (ověření)", redirectTo("https://www.google.cz/sorry/index")],
    ["Location není http(s)", redirectTo("javascript:alert(1)")],
    [
      "síťová chyba",
      vi.fn<FetchFn>(async () => {
        throw new TypeError("fetch failed");
      }),
    ],
  ])("když cíl nejde zjistit (%s), ponechá původní odkaz", async (_case, fetchFn) => {
    const input = [result(GOTO, "firmy.cz")];
    expect(await resolveGoogleRedirects(input, fetchFn)).toEqual(input);
  });
});
