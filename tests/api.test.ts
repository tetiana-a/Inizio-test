import { parse } from "csv-parse/sync";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app.js";
import { ProviderError, type SerpProvider } from "../src/search/types.js";
import { CZ, sampleResponse } from "./helpers.js";

const NOW = new Date("2026-11-20T15:00:00.000Z");
const results = sampleResponse().results;

function setup(search: SerpProvider["search"] = async () => results) {
  const provider = { name: "test", search: vi.fn(search) };
  const app = createApp({ provider, locale: CZ, rateLimitPerIp: false, now: () => NOW });
  return { app, provider };
}

describe("GET /api/search", () => {
  it("vrátí JSON s organickými výsledky a metadaty", async () => {
    const { app, provider } = setup();
    const res = await request(app).get("/api/search").query({ q: "  kávovar " });

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/application\/json/);
    expect(res.body).toEqual(sampleResponse());
    expect(provider.search).toHaveBeenCalledWith("kávovar", CZ);
  });

  it("format=csv pošle CSV soubor ke stažení se správnými daty", async () => {
    const { app } = setup();
    const res = await request(app).get("/api/search").query({ q: "kávovar", format: "csv" });

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toBe("text/csv; charset=utf-8");
    expect(res.headers["content-disposition"]).toBe("attachment; filename=serp-kavovar-2026-11-20.csv");
    const rows = parse(res.text, { bom: true, columns: true }) as Record<string, string>[];
    expect(rows.map((r) => r.url)).toEqual(results.map((r) => r.url));
  });

  it("format=json&download=1 pošle JSON soubor ke stažení", async () => {
    const { app } = setup();
    const res = await request(app).get("/api/search").query({ q: "kávovar", format: "json", download: "1" });

    expect(res.headers["content-disposition"]).toBe("attachment; filename=serp-kavovar-2026-11-20.json");
    expect(JSON.parse(res.text)).toEqual(sampleResponse());
  });

  it("stejné slovo podruhé vezme z cache – SERP API se volá jen jednou", async () => {
    const { app, provider } = setup();
    const first = await request(app).get("/api/search").query({ q: "Kávovar" });
    const second = await request(app).get("/api/search").query({ q: "kávovar", format: "csv" });

    expect(first.headers["x-cache"]).toBe("MISS");
    expect(second.headers["x-cache"]).toBe("HIT");
    expect(provider.search).toHaveBeenCalledTimes(1);
  });

  it.each([
    [{}, "Zadejte klíčové slovo."],
    [{ q: "   " }, "Zadejte klíčové slovo."],
    [{ q: "kávovar", format: "xml" }, "Podporované formáty jsou json a csv."],
  ])("neplatný požadavek %j vrátí 400", async (query, message) => {
    const { app, provider } = setup();
    const res = await request(app).get("/api/search").query(query);

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: { message } });
    expect(provider.search).not.toHaveBeenCalled();
  });

  it("chyba SERP API vrátí 502 se srozumitelnou zprávou", async () => {
    const { app } = setup(async () => {
      throw new ProviderError("SerpApi: Your account has run out of searches.", 429);
    });
    const res = await request(app).get("/api/search").query({ q: "kávovar" });

    expect(res.status).toBe(502);
    expect(res.body.error.message).toContain("run out of searches");
  });

  it("bez API klíče vrátí 503", async () => {
    const app = createApp({ provider: null, locale: CZ, rateLimitPerIp: false });
    const res = await request(app).get("/api/search").query({ q: "kávovar" });
    expect(res.status).toBe(503);
  });

  it("rate limit vrátí 429 po překročení limitu", async () => {
    const app = createApp({ provider: { name: "t", search: async () => results }, locale: CZ, rateLimitPerIp: 2 });
    await request(app).get("/api/search").query({ q: "a" });
    await request(app).get("/api/search").query({ q: "a" });
    const res = await request(app).get("/api/search").query({ q: "a" });
    expect(res.status).toBe(429);
  });
});

describe("odkazy google.com/goto", () => {
  it("API vrátí skutečnou cílovou URL místo přesměrování Googlu", async () => {
    const goto = { ...results[0]!, url: "https://www.google.cz/goto?url=CAES123", domain: "kavarna-test.cz" };
    const app = createApp({
      provider: { name: "t", search: async () => [goto] },
      locale: CZ,
      rateLimitPerIp: false,
      redirectFetch: async () => new Response(null, { status: 302, headers: { Location: "https://kavarna-test.cz/menu" } }),
    });
    const res = await request(app).get("/api/search").query({ q: "kavárna" });

    expect(res.body.results[0]).toMatchObject({ url: "https://kavarna-test.cz/menu", domain: "kavarna-test.cz" });
  });
});

describe("GET /api/health", () => {
  it("ukáže, zda je nastavený zdroj dat", async () => {
    const { app } = setup();
    const res = await request(app).get("/api/health");
    expect(res.body).toEqual({ status: "ok", provider: "test", configured: true, locale: CZ });
  });
});

describe("statická stránka", () => {
  it("na / vrátí HTML stránku s jedním vstupním polem", async () => {
    const { app } = setup();
    const res = await request(app).get("/");
    expect(res.status).toBe(200);
    expect(res.text.match(/<input\b/g)).toHaveLength(1);
  });
});
