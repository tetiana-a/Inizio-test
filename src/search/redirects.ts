import type { FetchFn, OrganicResult } from "./types.js";

const GOOGLE_HOST = /(^|\.)google\.[a-z.]{2,6}$/i;

/** Je to přesměrovací odkaz Googlu (google.cz/goto?url=…, google.com/url?…)? */
export function isGoogleRedirect(url: string): boolean {
  try {
    const { hostname, pathname } = new URL(url);
    return GOOGLE_HOST.test(hostname) && (pathname === "/goto" || pathname === "/url");
  } catch {
    return false;
  }
}

export function isGoogleHost(hostname: string): boolean {
  return GOOGLE_HOST.test(hostname);
}

/**
 * Google od srpna 2026 obaluje část odkazů ve výsledcích adresou google.com/goto?url=<token>.
 * Token nejde dekódovat; cíl vrací Google v hlavičce Location (302). Zjistíme ho jedním
 * požadavkem bez následování přesměrování. Když se to nepovede (timeout, ověření ze strany
 * Googlu), výsledek zůstane s původním – stále funkčním – přesměrovacím odkazem.
 */
export async function resolveGoogleRedirects(
  results: OrganicResult[],
  fetchFn: FetchFn = fetch,
  timeoutMs = 3000,
): Promise<OrganicResult[]> {
  return Promise.all(
    results.map(async (result) => {
      if (!isGoogleRedirect(result.url)) return result;
      const target = await readLocation(result.url, fetchFn, timeoutMs);
      return target ? { ...result, url: target.href, domain: target.hostname.replace(/^www\./, "") } : result;
    }),
  );
}

async function readLocation(url: string, fetchFn: FetchFn, timeoutMs: number): Promise<URL | null> {
  try {
    const response = await fetchFn(url, { method: "GET", redirect: "manual", signal: AbortSignal.timeout(timeoutMs) });
    await response.body?.cancel();
    const location = response.headers.get("location");
    if (!location) return null;
    const target = new URL(location, url);
    const isWeb = target.protocol === "http:" || target.protocol === "https:";
    return isWeb && !isGoogleHost(target.hostname) ? target : null;
  } catch {
    return null;
  }
}
