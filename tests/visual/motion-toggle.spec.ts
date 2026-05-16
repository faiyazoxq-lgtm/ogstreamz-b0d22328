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

/**
 * Returns whether the top-most element at the given viewport coordinate
 * is the toggle (or one of its children). Used to verify probe points on
 * the toggle aren't covered by the BottomDock, an overlay, or a banner.
 */
async function isToggleHitAt(page: Page, x: number, y: number) {
  return page.evaluate(
    ({ x, y }) => {
      const el = document.elementFromPoint(x, y) as HTMLElement | null;
      if (!el) return { tag: null as string | null, isToggleOrChild: false };
      const toggle = el.closest('button[aria-label^="Motion:"]') as HTMLElement | null;
      return { tag: el.tagName.toLowerCase(), isToggleOrChild: !!toggle };
    },
    { x, y },
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

test.describe("ReducedMotionToggle is tappable", () => {
  for (const size of MOBILE_SIZES) {
    test(`every probe point hits the toggle @ ${size.name} (${size.width}x${size.height})`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: size.width, height: size.height });
      await page.goto("/");
      await waitForReady(page);

      const toggle = page.getByRole("button", { name: /^Motion:/ }).first();
      const box = await toggle.boundingBox();
      expect(box, "toggle box").toBeTruthy();

      // The toggle must keep enough surface to actually be tapped. We don't
      // enforce the full 44px HIG target (it's a small pill), but it must
      // not be SHRUNK or CLIPPED below ~28px by an overlapping element.
      expect(box!.width, `toggle width @ ${size.name}`).toBeGreaterThanOrEqual(28);
      expect(box!.height, `toggle height @ ${size.name}`).toBeGreaterThanOrEqual(28);

      // Hit-test 5 probe points spanning the toggle's bounding box. Every
      // point must resolve to the toggle (or one of its children) — if any
      // probe lands on a different element, something is overlapping it.
      const probes = [
        { dx: 0.5, dy: 0.5, label: "center" },
        { dx: 0.15, dy: 0.5, label: "left-mid" },
        { dx: 0.85, dy: 0.5, label: "right-mid" },
        { dx: 0.5, dy: 0.15, label: "top-mid" },
        { dx: 0.5, dy: 0.85, label: "bottom-mid" },
      ];

      for (const p of probes) {
        const x = box!.x + box!.width * p.dx;
        const y = box!.y + box!.height * p.dy;
        const hit = await isToggleHitAt(page, x, y);
        expect(
          hit.isToggleOrChild,
          `probe ${p.label} (${x.toFixed(1)}, ${y.toFixed(1)}) @ ${size.name} hit <${hit.tag}> instead of the toggle`,
        ).toBe(true);
      }

      // Final proof: a real click cycles the toggle's label
      // (auto → on → off → auto). If anything intercepts the tap, the
      // aria-label won't change.
      const before = await toggle.getAttribute("aria-label");
      await toggle.click();
      await page.waitForTimeout(120);
      const after = await toggle.getAttribute("aria-label");
      expect(after, `aria-label changes on tap @ ${size.name}`).not.toBe(before);
    });
  }
});