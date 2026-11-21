// Funkční end-to-end testy: skutečný prohlížeč → Express API → (fixture) SerpApi.
import { expect, test } from "@playwright/test";
import { openApp, searchFor } from "./helpers.js";

// Funkčnost nezávisí na animacích – bez nich jsou testy rychlejší a stabilnější.
// (Rozvržení s animacemi hlídá responsive.spec.ts.)
test.use({ reducedMotion: "reduce" });

test.describe("vyhledávání a export", () => {
  test("stránka má právě jedno vstupní pole s popiskem", async ({ page }) => {
    await openApp(page);
    await expect(page.locator("input")).toHaveCount(1);
    await expect(page.getByRole("searchbox", { name: "Klíčové slovo" })).toBeVisible();
  });

  test("zobrazí organické výsledky 1. strany ve správném pořadí", async ({ page }) => {
    await openApp(page);
    await searchFor(page);
    const items = page.locator("#results .result");
    await expect(items.locator(".position")).toHaveText(["1", "2", "3", "4", "5", "6"]);
    await expect(items.first().locator("a")).toHaveText("Kávovar – Wikipedie");
    await expect(items.first().locator("a")).toHaveAttribute("href", "https://cs.wikipedia.org/wiki/K%C3%A1vovar");
    // Odkaz google.cz/goto je rozbalený na cílovou adresu.
    await expect(items.nth(5).locator("a")).toHaveAttribute("href", /^https:\/\/www\.firmy-test\.cz\//);
    await expect(page.locator("#meta")).toContainText("6 organických výsledků");
    await expect(page).toHaveURL(/\?q=k%C3%A1vovar$/);
  });

  test("vyhledávání jde spustit klávesou Enter", async ({ page }) => {
    await openApp(page);
    await page.locator("#q").fill("kávovar");
    await page.locator("#q").press("Enter");
    await expect(page.locator("#results .result:not(.skeleton)")).toHaveCount(6);
  });

  test("odkaz ?q= rovnou načte výsledky", async ({ page }) => {
    await openApp(page, "/?q=k%C3%A1vovar");
    await expect(page.locator("#results .result:not(.skeleton)")).toHaveCount(6);
    await expect(page.locator("#q")).toHaveValue("kávovar");
  });

  test("výsledky jdou stáhnout jako JSON i CSV", async ({ page }) => {
    await openApp(page);
    await searchFor(page);

    const jsonHref = await page.locator("#download-json").getAttribute("href");
    const json = await page.request.get(jsonHref!);
    expect(json.headers()["content-type"]).toContain("application/json");
    expect(json.headers()["content-disposition"]).toMatch(/attachment; filename="?serp-kavovar-\d{4}-\d{2}-\d{2}\.json/);
    const data = await json.json();
    expect(data.results).toHaveLength(6);
    expect(data.results.map((r: { position: number }) => r.position)).toEqual([1, 2, 3, 4, 5, 6]);

    const csvHref = await page.locator("#download-csv").getAttribute("href");
    const csv = await page.request.get(csvHref!);
    expect(csv.headers()["content-type"]).toContain("text/csv");
    const raw = await csv.body();
    expect([...raw.subarray(0, 3)], "UTF-8 BOM kvůli Excelu").toEqual([0xef, 0xbb, 0xbf]);
    const text = raw.subarray(3).toString("utf8");
    expect(text.split("\r\n")[0]).toBe('"position","title","url","displayed_url","domain","snippet"');
    expect(text.trim().split("\r\n")).toHaveLength(7);

    // Stažení přes prohlížeč (atribut download) uloží soubor se správným jménem.
    const [download] = await Promise.all([page.waitForEvent("download"), page.locator("#download-csv").click()]);
    expect(download.suggestedFilename()).toMatch(/^serp-kavovar-\d{4}-\d{2}-\d{2}\.csv$/);
  });

  test("prázdný dotaz zobrazí výzvu a nic nehledá", async ({ page }) => {
    await openApp(page);
    let apiCalls = 0;
    page.on("request", (r) => r.url().includes("/api/search") && apiCalls++);
    await page.locator("#submit").click();
    await expect(page.locator("#status")).toHaveText("Zadejte klíčové slovo.");
    await expect(page.locator("#q")).toBeFocused();
    expect(apiCalls).toBe(0);
  });

  test("chyba poskytovatele se zobrazí uživateli", async ({ page }) => {
    await openApp(page);
    await page.locator("#q").fill("chyba-serveru");
    await page.locator("#submit").click();
    await expect(page.locator("#status")).toHaveClass(/error/);
    await expect(page.locator("#status")).not.toBeEmpty();
    await expect(page.locator("#output")).toBeHidden();
    await expect(page.locator("#submit")).toBeEnabled();
  });

  test("dotaz bez výsledků to srozumitelně oznámí", async ({ page }) => {
    await openApp(page);
    await searchFor(page, "bez-vysledku", 0);
    await expect(page.locator("#status")).toContainText("žádné organické výsledky");
  });
});

test.describe("motiv a rádio", () => {
  test("přepínač tmavého motivu funguje a volba vydrží po obnovení", async ({ page }) => {
    await openApp(page);
    const html = page.locator("html");
    const toggle = page.getByRole("switch", { name: "Tmavý režim" });
    await expect(toggle).toHaveAttribute("aria-checked", "false");

    await toggle.click();
    await expect(html).toHaveAttribute("data-theme", "dark");
    await expect(toggle).toHaveAttribute("aria-checked", "true");

    await page.reload();
    await expect(html).toHaveAttribute("data-theme", "dark");
    await expect(page.getByRole("switch", { name: "Tmavý režim" })).toHaveAttribute("aria-checked", "true");

    await page.getByRole("switch", { name: "Tmavý režim" }).click();
    await expect(html).toHaveAttribute("data-theme", "light");
  });

  test("tmavý motiv respektuje nastavení systému", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await openApp(page);
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  });

  test("rádio se samo nespustí", async ({ page }) => {
    await openApp(page);
    await page.waitForTimeout(500);
    await expect(page.locator("#radio")).toHaveAttribute("data-state", "paused");
    await expect(page.locator("#radio-play")).toHaveAttribute("aria-pressed", "false");
    expect(await page.locator("html").getAttribute("data-music")).not.toBe("on");
  });
});
