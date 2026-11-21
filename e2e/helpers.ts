import { expect, type Locator, type Page } from "@playwright/test";

export interface Box {
  x: number;
  y: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

/**
 * Počká, až doběhnou konečné animace a přechody (vstupní animace, View Transitions).
 * Nekonečné efekty (dýchání pozadí, rotace) a animace řízené scrollováním se nečekají.
 */
export async function settle(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const finite = document
      .getAnimations()
      .filter((a) => a.timeline === document.timeline && a.effect?.getComputedTiming().endTime !== Infinity);
    const timeout = new Promise((resolve) => setTimeout(resolve, 4000));
    await Promise.race([Promise.all(finite.map((a) => a.finished.catch(() => undefined))), timeout]);
  });
}

/** Otevře stránku a počká, až je vyhledávací pole připravené a úvodní animace doběhly. */
export async function openApp(page: Page, path = "/"): Promise<void> {
  await page.goto(path);
  await expect(page.locator("#q")).toBeVisible();
  await settle(page);
}

/** Vyhledá slovo přes UI a počká na vykreslení výsledků (fixture má 6 organických výsledků). */
export async function searchFor(page: Page, query = "kávovar", expected = 6): Promise<void> {
  await page.locator("#q").fill(query);
  await page.locator("#submit").click();
  await expect(page.locator("#results .result:not(.skeleton)")).toHaveCount(expected);
  await expect(page.locator("#submit")).toBeEnabled();
  await settle(page);
}

export async function box(locator: Locator): Promise<Box> {
  return locator.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { x: r.left, y: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
  });
}

/** Překrývají se dva obdélníky? (dotyk hranou se nepočítá) */
export const overlaps = (a: Box, b: Box): boolean =>
  a.x < b.right && b.x < a.right && a.y < b.bottom && b.y < a.bottom;

/** Šířka dokumentu a layout viewportu – na mobilu je přetečení vidět jako innerWidth > šířka zařízení. */
export async function pageWidth(page: Page): Promise<{ scrollWidth: number; innerWidth: number }> {
  return page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));
}

/** Nejmenší velikost písma ze všech viditelných textů na stránce. */
export async function smallestText(page: Page): Promise<{ size: number; text: string }> {
  return page.evaluate(() => {
    let smallest = { size: Infinity, text: "" };
    for (const el of document.querySelectorAll<HTMLElement>("body *")) {
      const ownText = [...el.childNodes]
        .filter((n) => n.nodeType === Node.TEXT_NODE)
        .map((n) => n.textContent?.trim() ?? "")
        .join("");
      if (!ownText || el.closest("[hidden], .visually-hidden") || el.getClientRects().length === 0) continue;
      const size = parseFloat(getComputedStyle(el).fontSize);
      if (size < smallest.size) smallest = { size, text: ownText.slice(0, 40) };
    }
    return smallest;
  });
}
