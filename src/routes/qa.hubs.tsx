import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

/**
 * Visual consistency check page for hub backgrounds.
 *
 * Renders every hub route inside a side-by-side iframe grid so any leftover
 * non-transparent OG card / vignette / panel becomes visible against the
 * shared wallpaper. Iframe isolation keeps each hub's own auth + state
 * intact without cross-contamination.
 *
 * NOT linked from nav. Open manually at /qa/hubs.
 */

export const Route = createFileRoute("/qa/hubs")({
  head: () => ({
    meta: [
      { title: "QA — Hub transparency check" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: QaHubs,
});

const HUBS = [
  { path: "/music",   label: "MusicHUB" },
  { path: "/jokes",   label: "JokesHUB" },
  { path: "/tools",   label: "ToolHUB" },
  { path: "/trade",   label: "TradeHUB" },
  { path: "/connect", label: "ConnectHUB" },
  { path: "/battle",  label: "BattleHUB" },
  { path: "/",        label: "Home /" },
] as const;

const SCALES = [0.4, 0.6, 0.8, 1] as const;

function QaHubs() {
  const [scale, setScale] = useState<number>(0.6);
  const [showWallpaper, setShowWallpaper] = useState(true);
  const [diagBg, setDiagBg] = useState(false);

  // 411x900 mobile frame so portal headers render in their mobile layout —
  // matches the device size we've been auditing against.
  const frameW = 411;
  const frameH = 900;

  return (
    <main className="relative min-h-screen w-full text-white">
      {/* Toolbar */}
      <header
        className="sticky top-0 z-30 flex flex-wrap items-center gap-3 border-b border-white/10 px-4 py-3 sm:px-6"
        style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(10px)" }}
      >
        <h1 className="text-sm font-bold uppercase tracking-[0.3em]">
          QA · Hub transparency check
        </h1>
        <span className="text-[10px] text-white/50">
          Iframes render each hub at mobile width — anything opaque shows up.
        </span>
        <div className="ml-auto flex items-center gap-2">
          <label className="flex items-center gap-2 text-[11px]">
            <input
              type="checkbox"
              checked={showWallpaper}
              onChange={(e) => setShowWallpaper(e.target.checked)}
            />
            Wallpaper behind frames
          </label>
          <label className="flex items-center gap-2 text-[11px]">
            <input
              type="checkbox"
              checked={diagBg}
              onChange={(e) => setDiagBg(e.target.checked)}
            />
            Magenta diagnostic background
          </label>
          <select
            value={scale}
            onChange={(e) => setScale(parseFloat(e.target.value))}
            className="rounded border border-white/20 bg-black/60 px-2 py-1 text-[11px]"
            aria-label="Frame scale"
          >
            {SCALES.map((s) => (
              <option key={s} value={s}>
                {Math.round(s * 100)}%
              </option>
            ))}
          </select>
        </div>
      </header>

      {/* Backdrop layer — toggle wallpaper or magenta to spot opaque panels.
          When magenta is on, any non-transparent hub element shows as a
          dark blob over hot pink. */}
      {diagBg && (
        <div
          aria-hidden
          className="pointer-events-none fixed inset-0 -z-10"
          style={{ background: "#ff00aa" }}
        />
      )}
      {!diagBg && !showWallpaper && (
        <div
          aria-hidden
          className="pointer-events-none fixed inset-0 -z-10"
          style={{ background: "#000" }}
        />
      )}

      {/* Hub grid */}
      <div className="px-4 py-6 sm:px-6">
        <ul
          className="grid gap-6"
          style={{
            gridTemplateColumns: `repeat(auto-fill, minmax(${Math.ceil(frameW * scale) + 24}px, 1fr))`,
          }}
        >
          {HUBS.map(({ path, label }) => (
            <li key={path} className="flex flex-col items-center gap-2">
              <div className="flex w-full items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-widest text-white/80">
                  {label}
                </span>
                <a
                  href={path}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[10px] text-white/50 underline-offset-2 hover:text-white hover:underline"
                >
                  open ↗
                </a>
              </div>
              <div
                className="relative overflow-hidden rounded-xl border border-white/15 shadow-[0_0_30px_-12px_oklch(0.72_0.22_245/0.5)]"
                style={{
                  width: frameW * scale,
                  height: frameH * scale,
                }}
              >
                <iframe
                  title={`${label} preview`}
                  src={path}
                  loading="lazy"
                  // Render at full mobile size, then scale the frame down
                  // visually so its layout still matches what users see.
                  style={{
                    width: frameW,
                    height: frameH,
                    transform: `scale(${scale})`,
                    transformOrigin: "top left",
                    border: "0",
                    background: "transparent",
                  }}
                  // allow-same-origin so app auth/state mirror the parent.
                  sandbox="allow-same-origin allow-scripts allow-forms"
                />
              </div>
              <p className="text-[10px] text-white/40">{frameW}×{frameH} @ {Math.round(scale * 100)}%</p>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}

export default QaHubs;