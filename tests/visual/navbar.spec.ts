import { test, expect, type Page } from "@playwright/test";

/**
 * Visual regression for the live site chrome.
 *
 * Targets the REAL header/sidebar in `src/components/AppShell.tsx`:
 *   - Mobile: <header className="md:hidden ..."> (sticky, shown < 768px)
 *   - Desktop: <aside className="hidden md:flex ..."> (sticky sidebar)
 *
 * For each width we capture two states (top of page + scrolled 600px) and
 * snapshot ONLY the chrome element, not the whole viewport — so changes to
 * page content below don't poison the diff. A regression here means the
 * navbar/sidebar overflowed, clipped, or shifted height.
 *
 * NOTE: An older `src/components/NavBar.tsx` used to live in the tree but
 * was never imported. It has been deleted — `AppShell.tsx` is the only
 * site chrome. If a new top-level navbar component is introduced later,
 * add its spec here.
 */

const MOBILE_WIDTHS = [320, 360, 375, 390, 414, 420] as const;
const DESKTOP_WIDTHS = [1280, 1440] as const;

/**
 * Wait for the AppShell to actually render and for the route's loading
 * overlay to clear. Without this, snapshots capture the "LOADING…" state
 * and every diff is dominated by the spinner, not the navbar.
 */
async function waitForChromeReady(page: Page, selector: string) {
  await page.waitForLoadState("domcontentloaded");
  await page.locator(selector).first().waitFor({ state: "visible", timeout: 20_000 });
  // Loading overlay uses the literal text "LOADING…". Wait until it's gone.
  await page
    .getByText(/LOADING…/i)
    .first()
    .waitFor({ state: "detached", timeout: 20_000 })
    .catch(() => {
      // Some routes never show the overlay; that's fine.
    });
  // Settle one frame so any in-flight layout finishes before screenshot.
  await page.evaluate(
    () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(null)))),
  );
}

/**
 * Mask things that legitimately change between runs but aren't part of
 * the navbar's layout contract: live coin balance, animated glows, the
 * test-mode banner timestamp (if any).
 */
function dynamicMasks(page: Page) {
  return [
    page.locator("[data-testid='animated-credits']"),
    page.locator("[aria-label^='Coins:']"),
  ];
}

test.describe("Mobile header (AppShell)", () => {
  for (const width of MOBILE_WIDTHS) {
    test(`navbar @ ${width}px — top + scrolled`, async ({ page }) => {
      await page.setViewportSize({ width, height: 720 });
      await page.goto("/");
      await waitForChromeReady(page, "header.md\\:hidden");

      const header = page.locator("header.md\\:hidden").first();

      // 1. Unscrolled
      await page.evaluate(() => window.scrollTo(0, 0));
      await expect(header).toHaveScreenshot(`mobile-${width}-top.png`, {
        mask: dynamicMasks(page),
      });

      // 2. Scrolled — the header must NOT change height or clip the logo
      //    when the scroll-state class swap fires.
      await page.evaluate(() => window.scrollTo(0, 600));
      await page.waitForTimeout(200);
      await expect(header).toHaveScreenshot(`mobile-${width}-scrolled.png`, {
        mask: dynamicMasks(page),
      });
    });
  }

  test("mobile header height is stable across scroll", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 720 });
    await page.goto("/");
    await waitForChromeReady(page, "header.md\\:hidden");
    const header = page.locator("header.md\\:hidden").first();

    const topBox = await header.boundingBox();
    await page.evaluate(() => window.scrollTo(0, 800));
    await page.waitForTimeout(200);
    const scrolledBox = await header.boundingBox();

    expect(topBox?.height).toBeDefined();
    expect(scrolledBox?.height).toBeDefined();
    // Hard contract: zero height jump between states. If this ever drifts,
    // a sticky-header re-layout has been re-introduced.
    expect(Math.abs((scrolledBox!.height) - (topBox!.height))).toBeLessThanOrEqual(0.5);
  });

  test("mobile header logo never overflows its row", async ({ page }) => {
    for (const width of MOBILE_WIDTHS) {
      await page.setViewportSize({ width, height: 720 });
      await page.goto("/");
      await waitForChromeReady(page, "header.md\\:hidden");
      const header = page.locator("header.md\\:hidden").first();
      const logo = header.locator("img, span").filter({ hasText: /^$|OG/ }).first();
      const headerBox = await header.boundingBox();
      const logoBox = await header.locator("a[aria-label='Home']").first().boundingBox();
      expect(headerBox && logoBox, `boxes @ ${width}`).toBeTruthy();
      // Logo lockup must sit fully inside the header row (no vertical clip).
      expect(logoBox!.y, `top @ ${width}`).toBeGreaterThanOrEqual(headerBox!.y - 0.5);
      expect(logoBox!.y + logoBox!.height, `bottom @ ${width}`).toBeLessThanOrEqual(
        headerBox!.y + headerBox!.height + 0.5,
      );
      // And it must not extend past the right edge into the burger/coin pill.
      expect(logoBox!.x + logoBox!.width, `right @ ${width}`).toBeLessThanOrEqual(
        headerBox!.x + headerBox!.width + 0.5,
      );
      // Suppress unused locator lint
      void logo;
    }
  });
});

test.describe("Desktop sidebar brand (AppShell)", () => {
  for (const width of DESKTOP_WIDTHS) {
    test(`sidebar brand @ ${width}px — top + scrolled`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/");
      await waitForChromeReady(page, "aside.md\\:flex");

      // Snapshot just the brand row at the top of the sidebar — that's
      // where the OgWordmark lives and where overflow would show first.
      const brandRow = page
        .locator("aside.md\\:flex >> nth=0")
        .locator("a[aria-label='Home']")
        .first();

      await page.evaluate(() => window.scrollTo(0, 0));
      await expect(brandRow).toHaveScreenshot(`desktop-${width}-brand-top.png`, {
        mask: dynamicMasks(page),
      });

      await page.evaluate(() => window.scrollTo(0, 800));
      await page.waitForTimeout(200);
      await expect(brandRow).toHaveScreenshot(`desktop-${width}-brand-scrolled.png`, {
        mask: dynamicMasks(page),
      });
    });
  }
});