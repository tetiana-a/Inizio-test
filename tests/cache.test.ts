import { describe, expect, it } from "vitest";
import { TtlCache } from "../src/search/cache.js";

describe("TtlCache", () => {
  it("vrací hodnotu do vypršení platnosti, potom už ne", () => {
    let now = 0;
    const cache = new TtlCache<string>(1000, 10, () => now);
    cache.set("k", "v");
    now = 999;
    expect(cache.get("k")).toBe("v");
    now = 1000;
    expect(cache.get("k")).toBeUndefined();
  });

  it("při překročení kapacity zahodí nejstarší záznam", () => {
    const cache = new TtlCache<number>(60_000, 2);
    cache.set("a", 1);
    cache.set("b", 2);
    cache.set("c", 3);
    expect([cache.get("a"), cache.get("b"), cache.get("c")]).toEqual([undefined, 2, 3]);
  });
});
