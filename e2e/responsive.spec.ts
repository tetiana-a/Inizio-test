// Responzivní rozvržení – každý test běží na všech zařízeních z playwright.config.ts
// (iPhone SE 320 px … desktop 1920 px, na výšku i na šířku).
import { expect, test } from "@playwright/test";
import { box, openApp, overlaps, pageWidth, searchFor, smallestText } from "./helpers.js";

test.describe("responzivní rozvržení", () => {
  test("stránka není širší než displej – bez vodorovného posunu a oddálení", async ({ page }) => {
    const { width } = page.viewportSize()!;
    await openApp(page);
    let size = await pageWidth(page);
    expect(size.innerWidth, "layout viewport se roztáhl (mobil by stránku oddálil)").toBe(width);
    expect(size.scrollWidth, "obsah přetéká do strany").toBeLessThanOrEqual(width);

    await searchFor(page);
    size = await pageWidth(page);
    expect(size.innerWidth).toBe(width);
    expect(size.scrollWidth).toBeLessThanOrEqual(width);
  });

  test("dlouhé nezalomitelné titulky a URL se zalomí, nerozšíří stránku", async ({ page }) => {
    const long = "superdlouhenazevbezmezerkterysenevejdenazadnydisplej".repeat(3);
    await page.route("**/api/search?*", (route) =>
      route.fulfill({
        json: {
          query: "test",
          provider: "e2e",
          searchedAt: "2026-11-21T10:00:00.000Z",
          locale: { gl: "cz", hl: "cs", googleDomain: "google.cz" },
          resultsCount: 1,
          results: [
            {
              position: 1,
              title: long,
              url: `https://www.${long}.cz/`,
              displayedUrl: `https://www.${long}.cz › ${long}`,
              domain: `www.${long}.cz`,
              snippet: long,
            },
          ],
        },
      }),
    );
    await openApp(page);
    await searchFor(page, "test", 1);
    const { width } = page.viewportSize()!;
    const size = await pageWidth(page);
    expect(size.innerWidth).toBe(width);
    expect(size.scrollWidth).toBeLessThanOrEqual(width);
    const card = await box(page.locator(".result").first());
    expect(card.right).toBeLessThanOrEqual(width);
  });

  test("vyhledávání je na první obrazovce bez scrollování", async ({ page }) => {
    await openApp(page);
    await expect(page.locator("#q")).toBeInViewport({ ratio: 1 });
    await expect(page.locator("#submit")).toBeInViewport({ ratio: 1 });
    await expect(page.locator(".title")).toBeInViewport({ ratio: 1 });
  });

  test("plovoucí ovladače nezakrývají nadpis ani vyhledávání", async ({ page }) => {
    await openApp(page);
    const toggle = await box(page.locator("#theme-toggle"));
    const radio = await box(page.locator("#radio"));
    for (const selector of [".eyebrow", ".title", "#search-form"]) {
      const target = await box(page.locator(selector));
      expect(overlaps(toggle, target), `přepínač motivu zakrývá ${selector}`).toBe(false);
      expect(overlaps(radio, target), `rádio zakrývá ${selector}`).toBe(false);
    }
    expect(overlaps(toggle, radio), "přepínač motivu a rádio se překrývají").toBe(false);
  });

  test("plovoucí ovladače jsou celé na displeji", async ({ page }) => {
    await openApp(page);
    const { width, height } = page.viewportSize()!;
    for (const selector of ["#theme-toggle", "#radio"]) {
      const b = await box(page.locator(selector));
      expect(b.x, `${selector} vlevo mimo displej`).toBeGreaterThanOrEqual(0);
      expect(b.y, `${selector} nahoře mimo displej`).toBeGreaterThanOrEqual(0);
      expect(b.right, `${selector} vpravo mimo displej`).toBeLessThanOrEqual(width);
      expect(b.bottom, `${selector} dole mimo displej`).toBeLessThanOrEqual(height);
    }
  });

  test("na konci stránky není patička schovaná pod rádiem", async ({ page }) => {
    await openApp(page);
    await searchFor(page);
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForTimeout(150);
    const radio = await box(page.locator("#radio"));
    for (const span of await page.locator(".footer span:not(.dot)").all()) {
      expect(overlaps(await box(span), radio), `rádio zakrývá patičku: ${await span.textContent()}`).toBe(false);
    }
    const last = await box(page.locator(".result").last());
    const { height } = page.viewportSize()!;
    if (radio.y > height / 2) {
      // Rádio dole: na konci stránky musí být poslední výsledek nad ním (stránka má dost místa dole).
      expect(overlaps(last, radio), "rádio zakrývá poslední výsledek").toBe(false);
    } else {
      // Rádio nahoře (telefon na šířku): výsledek jde odscrollovat celý pod rádio.
      expect(radio.bottom + last.height, "výsledek se nevejde pod rádio").toBeLessThanOrEqual(height);
    }
  });

  test("dotykové cíle mají aspoň 44 × 44 px", async ({ page }, testInfo) => {
    test.skip(!testInfo.project.use.hasTouch, "jen pro dotyková zařízení");
    await openApp(page);
    await searchFor(page);
    for (const selector of ["#q", "#submit", "#theme-toggle", "#radio-play", "#radio-next", "#download-json", "#download-csv"]) {
      const el = page.locator(selector);
      if (!(await el.isVisible())) continue;
      const b = await box(el);
      expect(Math.round(b.width), `${selector} je úzký`).toBeGreaterThanOrEqual(44);
      expect(Math.round(b.height), `${selector} je nízký`).toBeGreaterThanOrEqual(44);
    }
  });

  test("žádný text není menší než 12 px", async ({ page }) => {
    await openApp(page);
    await searchFor(page);
    const smallest = await smallestText(page);
    expect(smallest.size, `nejmenší text: „${smallest.text}“`).toBeGreaterThanOrEqual(12);
  });

  test("vstupní pole má aspoň 16 px – iOS při psaní nepřibližuje stránku", async ({ page }) => {
    await openApp(page);
    const size = await page.locator("#q").evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    expect(size).toBeGreaterThanOrEqual(16);
  });

  test("viewport je nastavený pro mobily včetně výřezu displeje", async ({ page }) => {
    await openApp(page);
    const viewport = await page.locator('meta[name="viewport"]').getAttribute("content");
    expect(viewport).toContain("width=device-width");
    expect(viewport).toContain("initial-scale=1");
    expect(viewport).toContain("viewport-fit=cover");
    expect(viewport, "uživatel musí mít možnost přiblížit").not.toMatch(/user-scalable\s*=\s*no|maximum-scale\s*=\s*1(\D|$)/);
  });

  test("respektuje omezení animací (prefers-reduced-motion)", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await openApp(page);
    await expect(page.locator("#gold-canvas")).toBeHidden();
    const animations = await page.locator(".hero-art").evaluate((el) => [
      getComputedStyle(el).animationName,
      getComputedStyle(el, "::before").animationName,
    ]);
    expect(animations).toEqual(["none", "none"]);
  });

  test("snímky obrazovky pro report (světlý i tmavý motiv)", async ({ page }, testInfo) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await openApp(page);
    await testInfo.attach("1-uvod-svetly", { body: await page.screenshot(), contentType: "image/png" });
    await searchFor(page);
    await testInfo.attach("2-vysledky-svetly", { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
    await page.locator("#theme-toggle").click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await page.evaluate(() => window.scrollTo(0, 0));
    await testInfo.attach("3-vysledky-tmavy", { body: await page.screenshot(), contentType: "image/png" });
  });
});
