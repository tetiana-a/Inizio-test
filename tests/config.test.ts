import { describe, expect, it } from "vitest";
import { localeFromEnv, providerFromEnv } from "../src/config.js";

describe("providerFromEnv", () => {
  it("bez klíče vrátí null", () => {
    expect(providerFromEnv({})).toBeNull();
  });

  it("dá přednost SerpApi, pokud je nastaven jeho klíč", () => {
    expect(providerFromEnv({ SERPAPI_API_KEY: "a", SERPER_API_KEY: "b" })?.name).toBe("serpapi");
    expect(providerFromEnv({ SERPER_API_KEY: "b" })?.name).toBe("serper");
  });

  it("respektuje SERP_PROVIDER", () => {
    expect(providerFromEnv({ SERP_PROVIDER: "serper", SERPAPI_API_KEY: "a", SERPER_API_KEY: "b" })?.name).toBe("serper");
    expect(providerFromEnv({ SERP_PROVIDER: "serper", SERPAPI_API_KEY: "a" })).toBeNull();
  });
});

describe("localeFromEnv", () => {
  it("výchozí je google.cz v češtině", () => {
    expect(localeFromEnv({})).toEqual({ gl: "cz", hl: "cs", googleDomain: "google.cz" });
  });
});
