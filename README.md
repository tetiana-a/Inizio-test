# SERP extraktor – praktický test Inizio

Webová stránka s jedním vstupním polem: zadáte klíčové slovo a aplikace vrátí **organické výsledky z 1. strany Google** (bez reklam). Výsledky lze stáhnout jako **JSON** nebo **CSV**.

- **Živá ukázka:** https://inizio-serp-kotolup.vercel.app
- **Zdrojový kód:** https://github.com/tetiana-a/Inizio-test (každý push do `main` se automaticky nasadí na Vercel)
- **Stack:** Node.js 22, TypeScript, Express 5, Vitest, Playwright + axe-core, Docker

## Jak to funguje

```
prohlížeč ──► GET /api/search?q=kávovar ──► SERP API (SerpApi / Serper) ──► Google.cz
   ▲                     │
   └── JSON / CSV ◄──────┘  normalizace → jen organické výsledky → cache 10 min
```

1. Stránka (`public/`) pošle klíčové slovo na `GET /api/search`.
2. Server slovo zkontroluje (prázdné / příliš dlouhé → 400) a zavolá poskytovatele SERP dat s lokalizací `google.cz`, `gl=cz`, `hl=cs`.
3. Z odpovědi se vezmou **jen organické výsledky**. Reklamy, místní výsledky (mapa), „Lidé se také ptají“ a znalostní panel se ignorují. Položky bez titulku nebo platné http(s) URL a duplicitní URL se vyřadí a pozice se očíslují 1..n.
4. U odkazů typu `google.com/goto?url=…` se aplikace pokusí zjistit skutečnou cílovou URL (viz níže).
5. Výsledek se uloží do paměťové cache (10 min), takže zobrazení a následné stažení JSON/CSV stojí jen jeden dotaz na API.

### Proč přes SERP API, a ne přímým stahováním google.com

- Google vyžaduje pro vyhledávání JavaScript a na požadavky z cloudových IP adres odpovídá CAPTCHA, takže jednoduchý `fetch` + parsování HTML z hostingu spolehlivě nefunguje.
- Oficiální Google Custom Search JSON API je od roku 2026 pro nové zákazníky uzavřené a 1. 1. 2027 končí.
- Proto se data berou přes SERP API, které řeší proxy a CAPTCHA a vrací strukturovaná data. Zdroj je za rozhraním `SerpProvider` (`src/search/types.ts`), takže ho jde vyměnit (jiné API, vlastní scraper s proxy) bez zásahu do zbytku aplikace. Implementováni jsou dva poskytovatelé:
  - **SerpApi** (`SERPAPI_API_KEY`) – výchozí, 250 dotazů měsíčně zdarma,
  - **Serper** (`SERPER_API_KEY`) – alternativa, 2 500 dotazů zdarma při registraci.

### Odkazy google.com/goto

Od srpna 2026 Google u výsledků nahrazuje cílovou adresu přesměrováním `google.com/goto?url=<token>` a SERP API (včetně SerpApi) je u části výsledků vrací tak, jak jsou. Token nejde dekódovat, cíl Google vrací v hlavičce `Location`. Aplikace proto pro tyto odkazy pošle jeden požadavek bez následování přesměrování (`redirect: "manual"`, timeout 3 s) a URL nahradí cílem (`src/search/redirects.ts`).

Od konce října 2026 ale Google zjišťování cílů ze serverů v datacentrech zpomaluje a omezuje, takže se to na Vercelu někdy nepovede. Pak:

- v `url` zůstane původní přesměrování – je funkční, po kliknutí vede na správnou stránku,
- `domain` se vezme ze zobrazené URL (`https://www.firmy.cz › …` → `firmy.cz`), u výsledků bez adresy (např. video na YouTube, kde Google ukáže „1,1 tis.+ sledujících“) ze zdroje (`source`: „YouTube · …“ → `youtube.com`),
- když doménu zjistit nejde, zůstane prázdná. Nikdy to není chybné „google.com“.

## Vzhled

- Světlý a tmavý režim (slonovinová / černá + zlatá). Přepínač vpravo nahoře; volba se pamatuje, bez volby platí nastavení systému. Nový režim se odhalí kruhem od přepínače (View Transitions API).
- Animované pozadí v Canvasu (zlaté stuhy a třpytivý prach), „tekuté sklo“ (`backdrop-filter`), rotující zlatý okraj vyhledávání (`@property`), postupný nájezd karet (`@starting-style`), linka průběhu scrollu (CSS scroll-driven animations).
- Rádio v rohu: generativní ambient přímo ve Web Audio API a veřejné streamy Českého rozhlasu (Jazz, D-dur) a Radio Paradise. Hraje až po kliknutí.
- Respektuje `prefers-reduced-motion`; stránka má pořád jen jedno vstupní pole.

### Mobily, tablety, desktop

- Rozvržení od 320 px (iPhone SE) po 2560 px, na výšku i na šířku. Vyhledávání je vždy na první obrazovce bez scrollování.
- Nic nesmí rozšířit stránku do strany (jinak by ji mobilní prohlížeč oddálil): „dýchající“ pozadí je ořezané ve vlastním rámu, `overflow-x: clip`, dlouhé titulky a URL se zalamují.
- `viewport-fit=cover` + `env(safe-area-inset-*)`: přepínač a rádio nezajedou pod výřez ani pod lištu iPhonu.
- Na telefonu je rádio lišta přes celou šířku dole; na telefonu na šířku kompaktní tlačítka vlevo nahoře, aby nezakrylo vyhledávání.
- Dotykové cíle min. 44 × 44 px (`pointer: coarse`), hover efekty jen pro myš (`hover: hover`), text min. 12 px, vstupní pole 16 px (iOS při psaní nepřibližuje), přiblížení stránky povolené.

## API

| Požadavek | Odpověď |
|---|---|
| `GET /api/search?q=kávovar` | JSON s výsledky (viz níže) |
| `GET /api/search?q=kávovar&format=json&download=1` | soubor `serp-kavovar-2026-11-20.json` |
| `GET /api/search?q=kávovar&format=csv` | soubor `serp-kavovar-2026-11-20.csv` |
| `GET /api/health` | stav aplikace a zda je nastaven klíč |

Chyby: `400` neplatný vstup, `429` příliš mnoho požadavků (60 / 15 min z jedné IP), `502` chyba SERP API, `503` chybí API klíč. Tělo chyby: `{ "error": { "message": "…" } }`.

### Formát JSON

```json
{
  "query": "kávovar",
  "provider": "serpapi",
  "searchedAt": "2026-11-20T15:00:00.000Z",
  "locale": { "gl": "cz", "hl": "cs", "googleDomain": "google.cz" },
  "resultsCount": 9,
  "results": [
    {
      "position": 1,
      "title": "Kávovar – Wikipedie",
      "url": "https://cs.wikipedia.org/wiki/K%C3%A1vovar",
      "displayedUrl": "https://cs.wikipedia.org › wiki › Kávovar",
      "domain": "cs.wikipedia.org",
      "snippet": "Kávovar je přístroj určený k přípravě kávy…"
    }
  ]
}
```

### Formát CSV

Sloupce `position, title, url, displayed_url, domain, snippet`. Podle RFC 4180 (čárka, CRLF, hodnoty v uvozovkách), s UTF-8 BOM kvůli diakritice v Excelu. Buňky začínající `=`, `+` nebo `@` dostanou prefix `'` (ochrana proti CSV injection).

## Spuštění lokálně

Potřebujete klíč k SerpApi (https://serpapi.com) nebo Serper (https://serper.dev).

```bash
cp .env.example .env      # a doplnit SERPAPI_API_KEY
```

**Docker Compose (vývoj s hot reloadem):**

```bash
docker compose up                       # http://localhost:3000
docker compose run --rm test            # unit testy v kontejneru
docker compose --profile prod up prod   # produkční build z Dockerfile, http://localhost:8080
```

**Bez Dockeru (Node.js 20+):**

```bash
npm install
npm run dev     # http://localhost:3000
```

## Testy

```bash
npm test            # unit testy
npm run test:e2e    # end-to-end testy v prohlížeči (první spuštění: npx playwright install chromium)
npm run test:all    # obojí
```

### Unit testy

61 unit testů (Vitest + Supertest), bez přístupu k síti – odpovědi SERP API jsou ve `tests/fixtures/`:

- **poskytovatelé** (`serpapi.test.ts`, `serper.test.ts`): správně sestavený dotaz, do výstupu se dostanou jen organické výsledky (reklamy, místní výsledky, „Lidé se také ptají“ ne), mapování polí, prázdné výsledky, chyby API,
- **normalizace** (`normalize.test.ts`): pořadí, vyřazení neplatných URL, duplicit a `javascript:` odkazů, doména u přesměrování Googlu,
- **přesměrování** (`redirects.test.ts`): rozpoznání `google.com/goto`, dohledání cíle z hlavičky `Location`, bezpečný návrat k původnímu odkazu, když to nejde,
- **export** (`export.test.ts`): JSON obsahuje stejná data; CSV načte nezávislý parser (`csv-parse`) zpět do stejných hodnot včetně uvozovek, čárek, nových řádků a diakritiky,
- **API** (`api.test.ts`): JSON i CSV odpověď, hlavičky pro stažení, cache, chybové stavy, rate limit, stránka s jedním inputem,
- validace vstupu, cache, konfigurace.

### End-to-end testy (Playwright + axe-core)

27 testů × 9 zařízení = 243 běhů (Chromium s emulací zařízení): iPhone SE (320 px), iPhone 15 Pro Max, Pixel 7, Galaxy S24, iPhone 15 na šířku, iPad Mini, Galaxy Tab S9 na šířku, desktop 1280 a 1920 px. Testy spouští skutečnou aplikaci (`e2e/server.ts`) jen s uloženou odpovědí SerpApi místo sítě, takže nepotřebují API klíč.

- **rozvržení** (`responsive.spec.ts`): stránka není širší než displej ani během animací, dlouhé texty se zalomí, vyhledávání je na první obrazovce, plovoucí ovladače nezakrývají nadpis, vyhledávání ani konec stránky a jsou celé na displeji, dotykové cíle ≥ 44 px, text ≥ 12 px, správný viewport, `prefers-reduced-motion`; snímky obrazovky (světlý i tmavý motiv) jsou přiložené v HTML reportu,
- **funkce** (`app.spec.ts`): jedno vstupní pole s popiskem, výsledky ve správném pořadí včetně rozbaleného `/goto` odkazu, Enter, odkaz `?q=`, stažení JSON a CSV (hlavičky, BOM, název souboru), prázdný dotaz, chyba poskytovatele, dotaz bez výsledků, přepínač motivu (pamatuje si volbu, respektuje systém), rádio se samo nespustí,
- **přístupnost** (`a11y.spec.ts`): axe-core podle WCAG 2.2 AA bez závažných chyb ve světlém i tmavém motivu, před vyhledáním i s výsledky; ovládání klávesnicí s viditelným fokusem.

HTML report s výsledky a snímky: `npm run test:e2e:report`. Vlastní Chrome místo staženého Chromia: `PW_CHROMIUM_EXECUTABLE=/cesta/k/chrome npm run test:e2e`.

Unit i e2e testy běží také v GitHub Actions (`.github/workflows/test.yml`); report z e2e se ukládá jako artefakt.

## Struktura

```
public/            stránka (HTML, CSS, JS bez frameworku): app.js, effects.js, radio.js, theme.js, pozadí AVIF
src/app.ts         Express aplikace a endpointy
src/main.ts        lokální spuštění serveru
src/config.ts      výběr poskytovatele a lokalizace z proměnných prostředí
src/search/        typy, poskytovatelé SERP dat, normalizace, přesměrování /goto, validace, cache
src/export/        převod do JSON a CSV
tests/             unit testy a fixtures
e2e/               end-to-end testy (Playwright + axe-core) a testovací server
```

## Nasazení

Projekt je připravený pro Vercel (Express bez konfigurace: `src/app.ts` exportuje aplikaci, `public/` obsluhuje CDN). V nastavení projektu stačí přidat proměnnou `SERPAPI_API_KEY`. Díky Dockerfile jde nasadit i kamkoli, kde běží kontejnery (Railway, Render, Fly.io).

## Omezení

- Výsledky odpovídají tomu, co Google vrátí poskytovateli API pro `google.cz` z jeho lokace; osobní výsledek v prohlížeči se může lišit (personalizace, poloha).
- Cache a rate limit jsou v paměti – na serverless hostingu platí jen pro jednu instanci. Pro produkci by se hodil Redis.
- Bezplatný tarif SerpApi má 250 dotazů měsíčně.
- Google od konce října 2026 dohledání cílů `/goto` z datacenter omezuje; v produkci proto u části výsledků zůstává (funkční) přesměrovací odkaz a doména ze zobrazené URL (viz výše).
