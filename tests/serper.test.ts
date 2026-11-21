import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { SerperProvider } from "../src/search/providers/serper.js";
import { ProviderError } from "../src/search/types.js";
import { CZ, fakeFetch } from "./helpers.js";

const fixture = JSON.parse(readFileSync(new URL("./fixtures/serper-kavovar.json", import.meta.url), "utf8"));

describe("SerperProvider", () => {
  it("pošle POST s klíčem v hlavičce a lokalizací v těle", async () => {
    const fetchFn = fakeFetch(200, fixture);
    await new SerperProvider("klic", fetchFn).search("kávovar", CZ);

    const [url, init] = fetchFn.mock.calls[0] ?? [];
    expect(url).toBe("https://google.serper.dev/search");
    expect(init?.method).toBe("POST");
    expect(init?.headers).toMatchObject({ "X-API-KEY": "klic" });
    expect(JSON.parse(String(init?.body))).toEqual({ q: "kávovar", gl: "cz", hl: "cs" });
  });

  it("vrátí jen pole organic – bez znalostního panelu a „Lidé se také ptají“", async () => {
    const results = await new SerperProvider("k", fakeFetch(200, fixture)).search("kávovar", CZ);

    expect(results.map((r) => r.position)).toEqual([1, 2, 3]);
    expect(results.map((r) => r.url)).not.toContain("https://www.paa-test.cz/");
    // Serper nevrací zobrazenou URL → použije se doména.
    expect(results[1]).toMatchObject({ domain: "srovnavac-test.cz", displayedUrl: "srovnavac-test.cz" });
  });

  it("chybová odpověď vyhodí ProviderError", async () => {
    const provider = new SerperProvider("k", fakeFetch(403, { message: "Unauthorized.", statusCode: 403 }));
    const error = await provider.search("kávovar", CZ).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ProviderError);
    expect(error).toMatchObject({ message: "Serper: Unauthorized.", status: 403 });
  });
});
