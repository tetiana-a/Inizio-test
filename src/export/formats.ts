import type { SearchResponse } from "../search/types.js";

export const CSV_COLUMNS = ["position", "title", "url", "displayed_url", "domain", "snippet"] as const;

/** JSON export: celá odpověď včetně metadat (dotaz, čas, lokalizace). */
export function toJson(data: SearchResponse): string {
  return JSON.stringify(data, null, 2);
}

/**
 * CSV export podle RFC 4180: oddělovač čárka, řádky CRLF, hodnoty v uvozovkách,
 * uvozovky zdvojené. Na začátku UTF-8 BOM, aby Excel správně zobrazil diakritiku.
 */
export function toCsv(data: SearchResponse): string {
  const rows = data.results.map((r) => [r.position, r.title, r.url, r.displayedUrl, r.domain, r.snippet]);
  const lines = [CSV_COLUMNS, ...rows].map((row) => row.map(csvCell).join(","));
  return "﻿" + lines.join("\r\n") + "\r\n";
}

function csvCell(value: string | number): string {
  let text = String(value);
  // Ochrana proti CSV injection: text začínající = + @ by tabulkový procesor spustil jako vzorec.
  if (/^[=+@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

/** Název souboru: serp-<slovo-bez-diakritiky>-<YYYY-MM-DD>.<ext> */
export function exportFileName(data: SearchResponse, ext: "json" | "csv"): string {
  const slug =
    data.query
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "dotaz";
  return `serp-${slug}-${data.searchedAt.slice(0, 10)}.${ext}`;
}
