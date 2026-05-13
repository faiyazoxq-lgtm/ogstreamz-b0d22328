import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

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

type Hub = { path: string; label: string; source: "core" | "file" | "custom" };

/**
 * Built-in hub routes shipped by the app. Sourced from the route tree at
 * build time via import.meta.glob — any new file matching the pattern
 * `src/routes/<name>.tsx` whose name appears in CORE_HUB_NAMES is picked up
 * automatically with no manual edit here.
 *
 * Naming convention: hubs are single-segment top-level routes. Add a name
 * to CORE_HUB_NAMES once and the file scan will surface it.
 */
const CORE_HUB_NAMES = [
  "music", "jokes", "tools", "trade", "connect", "battle",
] as const;

const ROUTE_FILES = import.meta.glob("/src/routes/*.tsx", { eager: false });

function discoverFileHubs(): Hub[] {
  const known = new Set<string>(CORE_HUB_NAMES);
  const found: Hub[] = [];
  for (const fullPath of Object.keys(ROUTE_FILES)) {
    const m = fullPath.match(/\/src\/routes\/([a-z0-9-]+)\.tsx$/);
    if (!m) continue;
    const name = m[1];
    if (!known.has(name)) continue;
    found.push({
      path: `/${name}`,
      label: `${name.charAt(0).toUpperCase()}${name.slice(1)}HUB`,
      source: "file",
    });
  }
  return found.sort((a, b) => a.label.localeCompare(b.label));
}

const SCALES = [0.4, 0.6, 0.8, 1] as const;

function QaHubs() {
  const [scale, setScale] = useState<number>(0.6);
  const [showWallpaper, setShowWallpaper] = useState(true);
  const [diagBg, setDiagBg] = useState(false);
  const [alphaMask, setAlphaMask] = useState(false);
  // Threshold 0..1 — alpha values >= threshold are painted as the highlight
  // colour, everything else collapses to fully transparent. 0.05 catches even
  // faint glows / vignettes; raise it to ignore subtle gradients.
  const [alphaThreshold, setAlphaThreshold] = useState(0.05);
  const [customHubs, setCustomHubs] = useState<Hub[]>([]);

  // Custom hubs added via the boss UI live in the `custom_hubs` table and
  // are routed under `/h/:slug` (or whatever `href` they carry). Pull the
  // published ones live so newly spawned hubs show up here without a code
  // change. Realtime channel keeps the QA page hot.
  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      const { data } = await supabase
        .from("custom_hubs")
        .select("title,href,published")
        .eq("published", true);
      if (cancelled) return;
      setCustomHubs(
        (data ?? []).map((h: { title: string | null; href: string | null }) => ({
          path: (h.href || "/").startsWith("/") ? h.href! : `/${h.href ?? ""}`,
          label: h.title || h.href || "Custom hub",
          source: "custom" as const,
        })),
      );
    };
    void refresh();
    const channel = supabase
      .channel("custom_hubs:qa")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "custom_hubs" },
        () => { void refresh(); },
      )
      .subscribe();
    return () => { cancelled = true; void supabase.removeChannel(channel); };
  }, []);

  // Merge file-discovered + custom + the home route, dedupe by path.
  const hubs: Hub[] = (() => {
    const seen = new Set<string>();
    const out: Hub[] = [];
    const push = (h: Hub) => {
      if (seen.has(h.path)) return;
      seen.add(h.path);
      out.push(h);
    };
    discoverFileHubs().forEach(push);
    customHubs.forEach(push);
    push({ path: "/", label: "Home /", source: "core" });
    return out;
  })();

  // 411x900 mobile frame so portal headers render in their mobile layout —
  // matches the device size we've been auditing against.
  const frameW = 411;
  const frameH = 900;

  // Build a 256-entry discrete LUT for the alpha channel: every alpha sample
  // below the threshold becomes 0, every sample at/above becomes 1. This
  // produces a hard mask with no anti-alias smear, so leftovers show as
  // crisp shapes instead of soft blobs.
  const alphaLut = (() => {
    const cutoff = Math.round(alphaThreshold * 255);
    const vals: string[] = new Array(256);
    for (let i = 0; i < 256; i++) vals[i] = i >= cutoff ? "1" : "0";
    return vals.join(" ");
  })();

  return (
    <main className="relative min-h-screen w-full text-white">
      {/* SVG filter defs — applied to each iframe via CSS `filter: url(#…)`.
          feColorMatrix forces RGB to a fixed neon highlight (ignoring source
          colour entirely) and preserves alpha. feComponentTransfer then
          thresholds the alpha channel into a binary mask so we see a sharp
          silhouette of every non-transparent pixel inside the hub. */}
      <svg width="0" height="0" className="absolute" aria-hidden>
        <defs>
          <filter id="hub-alpha-mask" x="0" y="0" width="100%" height="100%">
            <feColorMatrix
              type="matrix"
              values="
                0 0 0 0 0.227
                0 0 0 0 1
                0 0 0 0 0.353
                0 0 0 1 0"
            />
            <feComponentTransfer>
              <feFuncA type="discrete" tableValues={alphaLut} />
            </feComponentTransfer>
          </filter>
        </defs>
      </svg>

      {/* Toolbar */}
      <header
        className="sticky top-0 z-30 flex flex-wrap items-center gap-3 border-b border-white/10 px-4 py-3 sm:px-6"
        style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(10px)" }}
      >
        <h1 className="text-sm font-bold uppercase tracking-[0.3em]">
          QA · Hub transparency check
        </h1>
        <span className="text-[10px] text-white/50">
          {hubs.length} hubs · auto-discovered from route files + custom_hubs
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
          <label className="flex items-center gap-2 text-[11px]">
            <input
              type="checkbox"
              checked={alphaMask}
              onChange={(e) => setAlphaMask(e.target.checked)}
            />
            Alpha mask
          </label>
          {alphaMask && (
            <label className="flex items-center gap-2 text-[11px] text-white/70">
              threshold
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={alphaThreshold}
                onChange={(e) => setAlphaThreshold(parseFloat(e.target.value))}
                className="w-24"
              />
              <span className="tabular-nums text-white/50">
                {alphaThreshold.toFixed(2)}
              </span>
            </label>
          )}
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
          {hubs.map(({ path, label, source }) => (
            <li key={path} className="flex flex-col items-center gap-2">
              <div className="flex w-full items-center justify-between">
                <span className="flex items-center gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-widest text-white/80">
                    {label}
                  </span>
                  <span
                    className="rounded px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-widest"
                    style={{
                      background: source === "custom" ? "oklch(0.72 0.22 245 / 0.25)" : "rgba(255,255,255,0.08)",
                      color: source === "custom" ? "oklch(0.85 0.15 245)" : "rgba(255,255,255,0.6)",
                    }}
                  >
                    {source}
                  </span>
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
                    filter: alphaMask ? "url(#hub-alpha-mask)" : undefined,
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