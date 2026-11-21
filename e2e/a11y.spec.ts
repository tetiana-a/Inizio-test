// Přístupnost (WCAG 2.2 AA) – automatická kontrola axe-core na každém zařízení,
// ve světlém i tmavém motivu, před vyhledáním i s výsledky. Plus ovládání klávesnicí.
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { openApp, searchFor } from "./helpers.js";

async function seriousViolations(page: Page) {
  const { violations } = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  return violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map((v) => `${v.id}: ${v.help} → ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`);
}

test.describe("přístupnost", () => {
  test.beforeEach(async ({ page }) => {
    // Animace vypnuté, aby axe měřil kontrast finálního stavu, ne mezisnímků.
    await page.emulateMedia({ reducedMotion: "reduce" });
  });

  test("světlý motiv – úvodní stránka i výsledky bez závažných chyb", async ({ page }) => {
    await openApp(page);
    expect(await seriousViolations(page)).toEqual([]);
    await searchFor(page);
    expect(await seriousViolations(page)).toEqual([]);
  });

  test("tmavý motiv – úvodní stránka i výsledky bez závažných chyb", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce", colorScheme: "dark" });
    await openApp(page);
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    expect(await seriousViolations(page)).toEqual([]);
    await searchFor(page);
    expect(await seriousViolations(page)).toEqual([]);
  });

  test("chybová hláška je přístupná (role=status)", async ({ page }) => {
    await openApp(page);
    await page.locator("#submit").click();
    await expect(page.getByRole("status").first()).toHaveText("Zadejte klíčové slovo.");
    expect(await seriousViolations(page)).toEqual([]);
  });

  test("vše jde ovládat klávesnicí s viditelným fokusem", async ({ page }, testInfo) => {
    test.skip(!!testInfo.project.use.isMobile, "klávesnice se testuje na desktopu");
    await openApp(page);
    await expect(page.locator("#q")).toBeFocused(); // autofocus
    await page.keyboard.type("kávovar");
    await page.keyboard.press("Tab");
    await expect(page.locator("#submit")).toBeFocused();
    const outline = await page.locator("#submit").evaluate((el) => getComputedStyle(el).outlineStyle);
    expect(outline).not.toBe("none");
    await page.keyboard.press("Enter");
    await expect(page.locator("#results .result:not(.skeleton)")).toHaveCount(6);

    // Tabem se dá dojít na stažení i na první výsledek.
    const reached = new Set<string>();
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press("Tab");
      reached.add(
        await page.evaluate(() => {
          const el = document.activeElement;
          if (!el) return "";
          return el.closest(".result") ? "result" : el.id || el.tagName;
        }),
      );
    }
    expect([...reached]).toEqual(expect.arrayContaining(["download-json", "download-csv", "result"]));

    // Přepínač motivu jde zapnout mezerníkem.
    await page.locator("#theme-toggle").focus();
    await page.keyboard.press("Space");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  });
});
