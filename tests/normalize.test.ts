import { describe, expect, it } from "vitest";
import { normalizeOrganic } from "../src/search/normalize.js";

describe("normalizeOrganic", () => {
  it("seřadí podle pozice poskytovatele a očísluje znovu od 1", () => {
    const results = normalizeOrganic([
      { position: 3, title: "C", link: "https://c.cz/" },
      { position: 1, title: "A", link: "https://a.cz/" },
      { position: 2, title: "B", link: "https://b.cz/" },
    ]);
    expect(results.map((r) => [r.position, r.title])).toEqual([
      [1, "A"],
      [2, "B"],
      [3, "C"],
    ]);
  });

  it("vynechá položky bez titulku, bez URL nebo s jiným protokolem než http(s)", () => {
    const results = normalizeOrganic([
      { position: 1, title: "", link: "https://prazdny-titulek.cz/" },
      { position: 2, title: "Bez odkazu" },
      { position: 3, title: "JS", link: "javascript:alert(1)" },
      { position: 4, title: "Rozbitá URL", link: "není url" },
      { position: 5, title: "OK", link: "https://ok.cz/" },
    ]);
    expect(results).toEqual([
      { position: 1, title: "OK", url: "https://ok.cz/", displayedUrl: "ok.cz", domain: "ok.cz", snippet: "" },
    ]);
  });

  it("odstraní duplicitní URL a ponechá první výskyt", () => {
    const results = normalizeOrganic([
      { position: 1, title: "První", link: "https://dup.cz/a" },
      { position: 2, title: "Duplicita", link: "https://dup.cz/a" },
      { position: 3, title: "Další", link: "https://dup.cz/b" },
    ]);
    expect(results.map((r) => r.title)).toEqual(["První", "Další"]);
    expect(results.map((r) => r.position)).toEqual([1, 2]);
  });

  it("vyčistí bílé znaky a odstraní www. z domény", () => {
    const [result] = normalizeOrganic([
      { position: 1, title: "  Titulek \n s mezerami ", link: "https://www.Example.CZ/cesta", snippet: " a\t b " },
    ]);
    expect(result).toMatchObject({ title: "Titulek s mezerami", domain: "example.cz", snippet: "a b" });
  });

  it("u přesměrování Googlu vezme doménu ze zobrazené URL nebo zdroje – nikdy ne google.com", () => {
    const [withDisplayed, withoutDisplayed, nonsense, video] = normalizeOrganic([
      { position: 1, title: "A", link: "https://www.google.com/goto?url=CAES1", displayedLink: "https://www.irs.gov › retirement" },
      { position: 2, title: "B", link: "https://www.google.com/goto?url=CAES2" },
      { position: 3, title: "C", link: "https://www.google.com/goto?url=CAES3", displayedLink: "Wikipedie" },
      {
        position: 4,
        title: "D",
        link: "https://www.google.cz/goto?url=CAES4",
        displayedLink: "1,1 tis.+ sledujících",
        source: "YouTube · Collabim",
      },
    ]);
    expect(withDisplayed?.domain).toBe("irs.gov");
    expect(withoutDisplayed?.domain).toBe("");
    expect(nonsense?.domain).toBe("");
    expect(video).toMatchObject({ domain: "youtube.com", displayedUrl: "1,1 tis.+ sledujících" });
  });

  it("u běžného odkazu bere doménu z URL, ne ze zdroje", () => {
    const [result] = normalizeOrganic([
      { position: 1, title: "A", link: "https://cs.wikipedia.org/wiki/K", displayedLink: "Wikipedie", source: "YouTube" },
    ]);
    expect(result?.domain).toBe("cs.wikipedia.org");
  });
});
