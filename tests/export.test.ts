import { parse } from "csv-parse/sync";
import { describe, expect, it } from "vitest";
import { CSV_COLUMNS, exportFileName, toCsv, toJson } from "../src/export/formats.js";
import { sampleResponse } from "./helpers.js";

describe("JSON export", () => {
  it("je platný JSON se stejnými daty včetně metadat", () => {
    const data = sampleResponse();
    expect(JSON.parse(toJson(data))).toEqual(data);
  });
});

describe("CSV export", () => {
  it("začíná UTF-8 BOM a hlavičkou, řádky končí CRLF", () => {
    const csv = toCsv(sampleResponse());
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv.slice(1).split("\r\n")[0]).toBe(CSV_COLUMNS.map((c) => `"${c}"`).join(","));
    expect(csv.endsWith("\r\n")).toBe(true);
  });

  it("nezávislý CSV parser načte přesně stejná data (uvozovky, čárky, nové řádky, diakritika)", () => {
    const data = sampleResponse();
    const rows = parse(toCsv(data), { bom: true, columns: true }) as Record<string, string>[];

    expect(rows).toHaveLength(data.results.length);
    expect(rows).toEqual(
      data.results.map((r) => ({
        position: String(r.position),
        title: r.title,
        url: r.url,
        displayed_url: r.displayedUrl,
        domain: r.domain,
        snippet: r.snippet,
      })),
    );
  });

  it("pro výsledek bez nálezů obsahuje jen hlavičku", () => {
    const rows = parse(toCsv(sampleResponse({ results: [], resultsCount: 0 })), { bom: true, columns: true });
    expect(rows).toEqual([]);
  });

  it("zneškodní buňky, které by Excel spustil jako vzorec", () => {
    const data = sampleResponse();
    data.results[0]!.title = "=HYPERLINK(\"http://zly.cz\")";
    data.results[0]!.snippet = "-50 % sleva"; // běžný text, nemá se měnit
    const [row] = parse(toCsv(data), { bom: true, columns: true }) as Record<string, string>[];
    expect(row?.title).toBe("'=HYPERLINK(\"http://zly.cz\")");
    expect(row?.snippet).toBe("-50 % sleva");
  });
});

describe("exportFileName", () => {
  it("vytvoří bezpečný název bez diakritiky s datem", () => {
    const data = sampleResponse({ query: "Kávovar Brno – pákový!" });
    expect(exportFileName(data, "csv")).toBe("serp-kavovar-brno-pakovy-2026-11-20.csv");
    expect(exportFileName(sampleResponse({ query: "ČŘ" }), "json")).toBe("serp-cr-2026-11-20.json");
    expect(exportFileName(sampleResponse({ query: "€€€" }), "json")).toBe("serp-dotaz-2026-11-20.json");
  });
});
