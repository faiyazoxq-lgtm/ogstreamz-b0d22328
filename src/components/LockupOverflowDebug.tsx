import { useEffect, useState } from "react";

/**
 * Debug overlay that highlights horizontal overflow / clipping for the
 * hero lockup across common viewport widths.
 *
 * Activate by appending `?debug=lockup` to the URL, or by setting
 * `localStorage.lockupDebug = "1"`. Press `Shift+L` to toggle at runtime.
 *
 * What it does:
 *  - Outlines the lockup `<h1>` and the inner OG wordmark image.
 *  - Live-reads each element's bounding rect plus document/window widths
 *    and flags any horizontal overflow vs the viewport (red) or vs the
 *    `<section>` container (amber).
 *  - Lists common breakpoints (360 → 2560) and pre-computes the resolved
 *    inline padding cap `min(clamp(0.5rem, 0.25rem + 2.5vw, 3rem),
 *    (100vw - 100%)/2)` so you can see at which widths the cap kicks in.
 */
export function LockupOverflowDebug({ targetSelector = "[data-lockup-root]" }: { targetSelector?: string }) {
  const [enabled, setEnabled] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const initial =
      params.get("debug") === "lockup" ||
      window.localStorage?.getItem("lockupDebug") === "1";
    setEnabled(initial);
    const onKey = (e: KeyboardEvent) => {
      if (e.shiftKey && (e.key === "L" || e.key === "l")) {
        setEnabled((v) => {
          const next = !v;
          try { window.localStorage?.setItem("lockupDebug", next ? "1" : "0"); } catch { /* ignore */ }
          return next;
        });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    let raf = 0;
    const loop = () => { setTick((n) => (n + 1) % 1_000_000); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [enabled]);

  if (!enabled || typeof window === "undefined") return null;

  const root = document.querySelector(targetSelector) as HTMLElement | null;
  const img = root?.querySelector("img, svg") as HTMLElement | null;
  const section = root?.closest("section") as HTMLElement | null;

  const vw = window.innerWidth;
  const docW = document.documentElement.scrollWidth;
  const docOverflow = Math.max(0, docW - vw);

  const rectInfo = (el: HTMLElement | null) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { left: r.left, right: r.right, width: r.width, top: r.top, bottom: r.bottom };
  };
  const rootR = rectInfo(root);
  const imgR = rectInfo(img);
  const sectionR = rectInfo(section);

  const overflowsViewport = !!rootR && (rootR.left < 0 || rootR.right > vw);
  const overflowsSection = !!rootR && !!sectionR && (rootR.left < sectionR.left - 0.5 || rootR.right > sectionR.right + 0.5);

  // Resolved cap: min(clamp(0.5rem, 0.25rem + 2.5vw, 3rem), (100vw - 100%)/2)
  // where 100% = parent (section) width.
  const root16 = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
  const computeCap = (w: number, parentW: number) => {
    const clampPx = Math.min(Math.max(0.5 * root16, (0.25 * root16) + (2.5 * w) / 100), 3 * root16);
    const gutter = Math.max(0, (w - parentW) / 2);
    return { clampPx, gutter, applied: Math.min(clampPx, gutter) };
  };
  const presetWidths = [360, 390, 414, 768, 834, 1024, 1280, 1440, 1920, 2560];

  const ringColor = overflowsViewport ? "#ff3355" : overflowsSection ? "#ffaa00" : "#00ff99";

  return (
    <>
      {/* Visual outlines */}
      {rootR && (
        <div
          aria-hidden
          style={{
            position: "fixed", pointerEvents: "none", zIndex: 99998,
            left: rootR.left, top: rootR.top, width: rootR.width, height: rootR.bottom - rootR.top,
            outline: `2px dashed ${ringColor}`, outlineOffset: 0,
            boxShadow: `inset 0 0 0 1px ${ringColor}55`,
          }}
        />
      )}
      {imgR && (
        <div
          aria-hidden
          style={{
            position: "fixed", pointerEvents: "none", zIndex: 99998,
            left: imgR.left, top: imgR.top, width: imgR.width, height: imgR.bottom - imgR.top,
            outline: "1px dashed #7fd5ff",
          }}
        />
      )}
      {/* Viewport edge guides */}
      <div aria-hidden style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 99997, borderLeft: "1px solid rgba(255,255,255,0.15)", borderRight: "1px solid rgba(255,255,255,0.15)" }} />

      {/* Stats panel */}
      <div
        role="status"
        aria-label="Lockup overflow debug panel"
        style={{
          position: "fixed", right: 12, bottom: 12, zIndex: 99999,
          font: "12px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace",
          background: "rgba(0,0,0,0.85)", color: "#e6f6ff",
          border: `1px solid ${ringColor}`, borderRadius: 8, padding: "10px 12px",
          maxWidth: 360, boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
        }}
        data-tick={tick}
      >
        <div style={{ fontWeight: 700, color: ringColor, letterSpacing: "0.1em" }}>
          LOCKUP DEBUG{overflowsViewport ? " · OVERFLOW!" : overflowsSection ? " · BLEED" : " · OK"}
        </div>
        <div style={{ marginTop: 6 }}>
          viewport: <b>{vw}px</b> · doc: <b>{docW}px</b> · h-overflow: <b style={{ color: docOverflow ? "#ff3355" : "#00ff99" }}>{docOverflow}px</b>
        </div>
        {rootR && (
          <div>h1: L {rootR.left.toFixed(0)} · R {rootR.right.toFixed(0)} · W {rootR.width.toFixed(0)}</div>
        )}
        {imgR && (
          <div>img: L {imgR.left.toFixed(0)} · R {imgR.right.toFixed(0)} · W {imgR.width.toFixed(0)}</div>
        )}
        {sectionR && (
          <div>section: L {sectionR.left.toFixed(0)} · R {sectionR.right.toFixed(0)} · W {sectionR.width.toFixed(0)}</div>
        )}
        <div style={{ marginTop: 8, paddingTop: 6, borderTop: "1px solid rgba(255,255,255,0.15)" }}>
          <div style={{ opacity: 0.7, marginBottom: 4 }}>cap @ width (clamp / gutter / applied)</div>
          {sectionR && presetWidths.map((w) => {
            // Approximate parent width at width w using current ratio.
            const parentRatio = sectionR.width / vw;
            const parentW = Math.min(w, parentRatio * w + (sectionR.width - parentRatio * vw));
            const c = computeCap(w, Math.min(w, parentW));
            const isCapped = c.applied < c.clampPx - 0.5;
            return (
              <div key={w} style={{ display: "flex", justifyContent: "space-between", color: isCapped ? "#ffaa00" : "#9fe3ff" }}>
                <span>{w}px</span>
                <span>{c.clampPx.toFixed(0)} / {c.gutter.toFixed(0)} / <b>{c.applied.toFixed(0)}</b></span>
              </div>
            );
          })}
        </div>
        <div style={{ marginTop: 8, opacity: 0.6, fontSize: 10 }}>
          Toggle: <kbd>Shift+L</kbd> · or <code>?debug=lockup</code>
        </div>
      </div>
    </>
  );
}