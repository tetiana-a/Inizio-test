import path from "node:path";
import express, { type Express, type Response } from "express";
import { rateLimit } from "express-rate-limit";
import { localeFromEnv, providerFromEnv } from "./config.js";
import { exportFileName, toCsv, toJson } from "./export/formats.js";
import { TtlCache } from "./search/cache.js";
import { parseQuery } from "./search/query.js";
import { resolveGoogleRedirects } from "./search/redirects.js";
import { ProviderError, type FetchFn, type SearchLocale, type SearchResponse, type SerpProvider } from "./search/types.js";

export interface AppOptions {
  provider: SerpProvider | null;
  locale: SearchLocale;
  cacheTtlMs?: number;
  /** Max. počet požadavků na /api/search z jedné IP za 15 minut; false = vypnuto (testy). */
  rateLimitPerIp?: number | false;
  now?: () => Date;
  publicDir?: string;
  /** fetch pro dohledání cílů odkazů google.com/goto (v testech podvržený). */
  redirectFetch?: FetchFn;
}

export function createApp(options: AppOptions): Express {
  const { provider, locale, cacheTtlMs = 10 * 60_000, rateLimitPerIp = 60, now = () => new Date() } = options;
  const cache = new TtlCache<SearchResponse>(cacheTtlMs);
  const app = express();

  app.disable("x-powered-by");
  app.set("trust proxy", 1); // za proxy (Vercel, Docker) – kvůli správné IP v rate limitu
  app.use((_req, res, next) => {
    // Základní bezpečnostní hlavičky.
    res.set({
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "Referrer-Policy": "strict-origin-when-cross-origin",
    });
    next();
  });
  // Na Vercelu statické soubory obsluhuje CDN ze složky public/, lokálně Express.
  app.use(express.static(options.publicDir ?? path.join(process.cwd(), "public")));

  if (rateLimitPerIp !== false) {
    app.use(
      "/api/search",
      rateLimit({
        windowMs: 15 * 60_000,
        limit: rateLimitPerIp,
        standardHeaders: "draft-8",
        legacyHeaders: false,
        handler: (_req, res) => sendError(res, 429, "Příliš mnoho požadavků, zkuste to prosím za chvíli."),
      }),
    );
  }

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", provider: provider?.name ?? null, configured: provider !== null, locale });
  });

  /**
   * GET /api/search?q=<klíčové slovo>[&format=json|csv][&download=1]
   * Vrací organické výsledky z 1. strany Google. format=csv a download=1 posílají soubor ke stažení.
   */
  app.get("/api/search", async (req, res) => {
    const parsed = parseQuery(req.query.q);
    if (!parsed.ok) return sendError(res, 400, parsed.error);

    const format = req.query.format ?? "json";
    if (format !== "json" && format !== "csv") return sendError(res, 400, "Podporované formáty jsou json a csv.");

    if (!provider) {
      return sendError(res, 503, "Server nemá nastavený klíč k SERP API (SERPAPI_API_KEY nebo SERPER_API_KEY).");
    }

    const cacheKey = [provider.name, locale.googleDomain, locale.gl, locale.hl, parsed.query.toLowerCase()].join("|");
    let data = cache.get(cacheKey);
    res.set("X-Cache", data ? "HIT" : "MISS");

    if (!data) {
      try {
        const results = await resolveGoogleRedirects(await provider.search(parsed.query, locale), options.redirectFetch);
        data = {
          query: parsed.query,
          provider: provider.name,
          searchedAt: now().toISOString(),
          locale,
          resultsCount: results.length,
          results,
        };
        cache.set(cacheKey, data);
      } catch (err) {
        if (err instanceof ProviderError) {
          console.error(`[search] ${err.message} (status ${err.status ?? "?"})`);
          return sendError(res, err.status === 504 ? 504 : 502, `Nepodařilo se získat výsledky: ${err.message}`);
        }
        throw err;
      }
    }

    if (format === "csv") {
      res.attachment(exportFileName(data, "csv"));
      res.type("text/csv; charset=utf-8").send(toCsv(data));
      return;
    }
    if (req.query.download === "1") {
      res.attachment(exportFileName(data, "json"));
      res.type("application/json; charset=utf-8").send(toJson(data));
      return;
    }
    res.json(data);
  });

  app.use("/api", (_req, res) => sendError(res, 404, "Neznámý endpoint."));

  return app;
}

function sendError(res: Response, status: number, message: string): void {
  res.status(status).json({ error: { message } });
}

/** Výchozí instance pro Vercel (zero-config Express) – konfigurace z proměnných prostředí. */
export default createApp({ provider: providerFromEnv(), locale: localeFromEnv() });
