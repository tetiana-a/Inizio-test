import { isGoogleHost } from "./redirects.js";
import type { OrganicResult } from "./types.js";

/** Položka ve tvaru, do kterého si ji převede každý poskytovatel. */
export interface RawOrganicItem {
  position?: number;
  title?: string;
  link?: string;
  displayedLink?: string;
  snippet?: string;
  /** Název zdroje od poskytovatele, např. „YouTube · Collabim“ (SerpApi pole `source`). */
  source?: string;
}

/**
 * Sjednotí organické výsledky od poskytovatele:
 * - seřadí podle pozice, kterou vrátil poskytovatel,
 * - zahodí položky bez titulku nebo bez platné http(s) URL,
 * - odstraní duplicitní URL,
 * - očísluje pozice znovu 1..n, aby pořadí v exportu nemělo díry.
 */
export function normalizeOrganic(items: readonly RawOrganicItem[]): OrganicResult[] {
  const sorted = items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => (a.item.position ?? a.index + 1) - (b.item.position ?? b.index + 1));

  const seen = new Set<string>();
  const results: OrganicResult[] = [];

  for (const { item } of sorted) {
    const title = clean(item.title);
    const url = parseHttpUrl(item.link);
    if (!title || !url || seen.has(url.href)) continue;
    seen.add(url.href);

    const displayedLink = clean(item.displayedLink);
    // U přesměrování google.com/goto by doména byla „google.com“, což je špatně. Vezmeme ji
    // ze zobrazené URL, případně ze známého zdroje (YouTube…); jinak zůstane prázdná (neznámá).
    const host = isGoogleHost(url.hostname)
      ? (hostFromDisplayed(displayedLink) ?? hostFromSource(clean(item.source)) ?? "")
      : url.hostname;
    const domain = host.replace(/^www\./, "");
    results.push({
      position: results.length + 1,
      title,
      url: url.href,
      displayedUrl: displayedLink || domain,
      domain,
      snippet: clean(item.snippet),
    });
  }

  return results;
}

/** "https://www.firmy.cz › kraj › brno" → "www.firmy.cz" */
function hostFromDisplayed(displayed: string): string | null {
  const first = displayed.split(/\s+[›>]\s+/)[0] ?? "";
  try {
    const { hostname } = new URL(/^https?:\/\//.test(first) ? first : `https://${first}`);
    return hostname.includes(".") ? hostname : null;
  } catch {
    return null;
  }
}

/** Platformy, u kterých Google místo adresy zobrazí např. „1,1 tis.+ sledujících“. */
const SOURCE_HOSTS: Record<string, string> = {
  youtube: "youtube.com",
  facebook: "facebook.com",
  instagram: "instagram.com",
  linkedin: "linkedin.com",
  tiktok: "tiktok.com",
  x: "x.com",
  twitter: "x.com",
  reddit: "reddit.com",
};

/** "YouTube · Collabim" → "youtube.com"; neznámý zdroj → null */
function hostFromSource(source: string): string | null {
  const name = (source.split(/\s+[·|-]\s+/)[0] ?? "").trim().toLowerCase();
  return SOURCE_HOSTS[name] ?? null;
}

function clean(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function parseHttpUrl(value: unknown): URL | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}
