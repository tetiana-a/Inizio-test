import { describe, expect, it } from "vitest";
import { MAX_QUERY_LENGTH, parseQuery } from "../src/search/query.js";

describe("parseQuery", () => {
  it("ořízne a sloučí mezery", () => {
    expect(parseQuery("  kávovar    brno ")).toEqual({ ok: true, query: "kávovar brno" });
  });

  it.each([undefined, "", "   ", ["a", "b"], 42])("odmítne neplatný vstup %j", (input) => {
    expect(parseQuery(input)).toMatchObject({ ok: false });
  });

  it("odmítne příliš dlouhé klíčové slovo", () => {
    expect(parseQuery("a".repeat(MAX_QUERY_LENGTH)).ok).toBe(true);
    expect(parseQuery("a".repeat(MAX_QUERY_LENGTH + 1)).ok).toBe(false);
  });
});
