import { ProviderError, type FetchFn } from "../types.js";

const TIMEOUT_MS = 20_000;

/** Zavolá API a vrátí status + JSON tělo. Síťové chyby a timeouty převádí na ProviderError. */
export async function fetchJson<T>(
  fetchFn: FetchFn,
  url: string,
  init: RequestInit,
): Promise<{ status: number; body: T }> {
  let response: Response;
  try {
    response = await fetchFn(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch (err) {
    const timedOut = err instanceof Error && err.name === "TimeoutError";
    // Do zprávy záměrně nedáváme URL – obsahuje API klíč.
    throw new ProviderError(timedOut ? "Zdroj dat neodpověděl včas" : "Zdroj dat je nedostupný", timedOut ? 504 : 502);
  }

  let body: T;
  try {
    body = (await response.json()) as T;
  } catch {
    throw new ProviderError(`Zdroj dat vrátil neplatnou odpověď (HTTP ${response.status})`, response.status);
  }
  return { status: response.status, body };
}
