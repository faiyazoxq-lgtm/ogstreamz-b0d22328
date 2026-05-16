import { test, expect, type Page } from "@playwright/test";

/**
 * Regression for the floating ReducedMotionToggle (src/components/ReducedMotionToggle.tsx).
 *
 * Contract: the toggle must never overlap the mobile bottom nav (BottomDock,
 * `nav[aria-label="Quick navigation"]`) on phone-sized viewports, including
 * iOS safe-area sizes (home indicator inset ≈34px) and narrow Android widths.
 *
 * On md+ screens the BottomDock is hidden (`md:hidden`) and the toggle drops
 * back to `bottom-3`, so we only assert non-overlap where the dock is visible.
 */

// width × height pairs that exercise iPhone safe-area + small Androids.
const MOBILE_SIZES = [
  { name: "iphone-se", width: 320, height: 568 },
  { name: "android-small", width: 360, height: 800 },
  { name: "iphone-12-mini", width: 375, height: 812 },
  { name: "iphone-14", width: 390, height: 844 },
  { name: "iphone-14-plus", width: 414, height: 896 },
] as const;

async function waitForReady(page: Page) {
  await page.waitForLoadState("domcontentloaded");
  await page
    .locator('nav[aria-label="Quick navigation"]')
    .first()
    .waitFor({ state: "visible", timeout: 20_000 });
  await page
    .getByRole("button", { name: /^Motion:/ })
    .first()
    .waitFor({ state: "visible", timeout: 20_000 });
  await page.evaluate(
    () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(null)))),
  );
}

test.describe("ReducedMotionToggle vs BottomDock", () => {
  for (const size of MOBILE_SIZES) {
    test(`does not overlap bottom nav @ ${size.name} (${size.width}x${size.height})`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: size.width, height: size.height });
      await page.goto("/");
      await waitForReady(page);

      const dock = page.locator('nav[aria-label="Quick navigation"]').first();
      const toggle = page.getByRole("button", { name: /^Motion:/ }).first();

      const dockBox = await dock.boundingBox();
      const toggleBox = await toggle.boundingBox();
      expect(dockBox, "dock box").toBeTruthy();
      expect(toggleBox, "toggle box").toBeTruthy();

      // The toggle's bottom edge must sit above (smaller y) the dock's top edge.
      // A 1px tolerance covers subpixel rounding.
      expect(
        toggleBox!.y + toggleBox!.height,
        `toggle bottom (${toggleBox!.y + toggleBox!.height}) should be <= dock top (${dockBox!.y}) @ ${size.name}`,
      ).toBeLessThanOrEqual(dockBox!.y + 1);

      // Toggle must remain fully inside the viewport vertically.
      expect(toggleBox!.y, `toggle top in-viewport @ ${size.name}`).toBeGreaterThanOrEqual(0);
      expect(
        toggleBox!.y + toggleBox!.height,
        `toggle bottom in-viewport @ ${size.name}`,
      ).toBeLessThanOrEqual(size.height);
    });
  }

  test("on md+ viewport the dock is hidden and toggle sits near bottom-3", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");
    await page
      .getByRole("button", { name: /^Motion:/ })
      .first()
      .waitFor({ state: "visible", timeout: 20_000 });

    const dock = page.locator('nav[aria-label="Quick navigation"]').first();
    await expect(dock).toBeHidden();

    const toggle = page.getByRole("button", { name: /^Motion:/ }).first();
    const box = await toggle.boundingBox();
    expect(box).toBeTruthy();
    // bottom-3 = 12px from viewport bottom; allow some slack for borders/shadows.
    const distanceFromBottom = 800 - (box!.y + box!.height);
    expect(distanceFromBottom).toBeGreaterThanOrEqual(0);
    expect(distanceFromBottom).toBeLessThanOrEqual(32);
  });
});