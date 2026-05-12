import { useEffect, useState, useCallback } from "react";

/**
 * Dev-only visual QA overlay for the brand wordmark lockup.
 *
 * Activates when:
 *   • URL contains `?qa=align` (sticky for the session), OR
 *   • The user presses Alt+Shift+A
 *
 * It measures `.brand-glow__mark` and each of its direct children
 * (the eye lockup + every letter glyph) and draws bordered guides so you
 * can compare the eye's right edge against the "G"'s left edge — and the
 * baseline / cap-line of every letter — at each Tailwind breakpoint.
 */

const TW_BREAKPOINTS: Array<{ name: string; min: number }> = [
  { name: "2xl", min: 1536 },
  { name: "xl", min: 1280 },
  { name: "lg", min: 1024 },
  { name: "md", min: 768 },
  { name: "sm", min: 640 },
  { name: "xs", min: 0 },
];

function activeBreakpoint(w: number) {
  return TW_BREAKPOINTS.find((b) => w >= b.min)?.name ?? "xs";
}

type Box = {
  label: string;
  rect: DOMRect;
  kind: "eye" | "glyph";
  char?: string;
};

export function AlignmentQAOverlay() {
  const [enabled, setEnabled] = useState(false);
  const [boxes, setBoxes] = useState<Box[]>([]);
  const [hostRect, setHostRect] = useState<DOMRect | null>(null);
  const [vw, setVw] = useState(
    typeof window === "undefined" ? 0 : window.innerWidth,
  );

  // Initial enable from query param + hotkey toggle.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const qs = new URLSearchParams(window.location.search);
    if (qs.get("qa") === "align") setEnabled(true);
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey && e.shiftKey && (e.key === "A" || e.key === "a")) {
        setEnabled((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const measure = useCallback(() => {
    if (typeof document === "undefined") return;
    const host = document.querySelector(
      ".brand-glow__mark",
    ) as HTMLElement | null;
    if (!host) {
      setBoxes([]);
      setHostRect(null);
      return;
    }
    setHostRect(host.getBoundingClientRect());
    const out: Box[] = [];
    // First top-level span is the eye wrapper, the rest are letter glyphs.
    const kids = Array.from(host.children) as HTMLElement[];
    kids.forEach((el, i) => {
      const r = el.getBoundingClientRect();
      if (i === 0) {
        out.push({ label: "eye", rect: r, kind: "eye" });
      } else {
        out.push({
          label: el.textContent ?? "",
          rect: r,
          kind: "glyph",
          char: el.textContent ?? "",
        });
      }
    });
    setBoxes(out);
    setVw(window.innerWidth);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    measure();
    const ro = new ResizeObserver(() => measure());
    const host = document.querySelector(".brand-glow__mark");
    if (host) ro.observe(host);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    const id = window.setInterval(measure, 500); // catches font-load reflow
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
      window.clearInterval(id);
    };
  }, [enabled, measure]);

  if (!enabled || !hostRect) {
    return enabled ? <BadgeOnly vw={vw} onClose={() => setEnabled(false)} /> : null;
  }

  const eye = boxes.find((b) => b.kind === "eye");
  const firstGlyph = boxes.find((b) => b.kind === "glyph");
  const lastGlyph = [...boxes].reverse().find((b) => b.kind === "glyph");
  const bp = activeBreakpoint(vw);

  // Eye → first letter optical gap (negative means overlap, which is the goal).
  const gap =
    eye && firstGlyph ? firstGlyph.rect.left - eye.rect.right : null;

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[9999]"
      style={{ contain: "layout paint" }}
    >
      {/* Host outline */}
      <Frame
        rect={hostRect}
        color="rgba(80, 200, 255, 0.9)"
        label={`mark · ${Math.round(hostRect.width)}×${Math.round(hostRect.height)}`}
      />

      {/* Per-child outlines */}
      {boxes.map((b, i) => (
        <Frame
          key={i}
          rect={b.rect}
          color={
            b.kind === "eye"
              ? "rgba(255, 90, 90, 0.95)"
              : "rgba(255, 200, 60, 0.85)"
          }
          label={b.kind === "eye" ? "eye" : b.label}
          dashed={b.kind === "glyph"}
        />
      ))}

      {/* Cap-line + baseline guides spanning the full mark */}
      {firstGlyph && (
        <>
          <Hline
            y={firstGlyph.rect.top}
            x1={hostRect.left}
            x2={hostRect.right}
            color="rgba(120,255,160,0.55)"
            label="cap"
          />
          <Hline
            y={firstGlyph.rect.bottom}
            x1={hostRect.left}
            x2={hostRect.right}
            color="rgba(120,255,160,0.55)"
            label="baseline"
          />
        </>
      )}

      {/* Eye-right vs G-left vertical guides (the alignment seam) */}
      {eye && (
        <Vline
          x={eye.rect.right}
          y1={hostRect.top - 6}
          y2={hostRect.bottom + 6}
          color="rgba(255,90,90,0.95)"
          label="eye →"
        />
      )}
      {firstGlyph && (
        <Vline
          x={firstGlyph.rect.left}
          y1={hostRect.top - 6}
          y2={hostRect.bottom + 6}
          color="rgba(255,200,60,0.95)"
          label="← G"
        />
      )}
      {lastGlyph && (
        <Vline
          x={lastGlyph.rect.right}
          y1={hostRect.top - 6}
          y2={hostRect.bottom + 6}
          color="rgba(120,255,160,0.7)"
          label="end"
        />
      )}

      {/* HUD */}
      <div className="pointer-events-auto fixed top-2 right-2 rounded-lg border border-white/20 bg-black/85 px-3 py-2 text-[11px] font-mono text-white shadow-xl backdrop-blur">
        <div className="flex items-center gap-2">
          <span className="inline-block h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="font-bold tracking-wider">ALIGN QA</span>
          <span className="text-white/60">
            {vw}px · <span className="text-emerald-300">{bp}</span>
          </span>
          <button
            type="button"
            onClick={() => setEnabled(false)}
            className="ml-2 rounded border border-white/20 px-1.5 py-0.5 text-[10px] hover:bg-white/10"
          >
            close
          </button>
        </div>
        <div className="mt-1 text-white/80">
          eye→G gap:{" "}
          <span
            className={
              gap === null
                ? ""
                : gap < 0
                  ? "text-emerald-300"
                  : gap < 2
                    ? "text-amber-300"
                    : "text-rose-300"
            }
          >
            {gap === null ? "—" : `${gap.toFixed(2)}px`}
          </span>
        </div>
        {eye && firstGlyph && (
          <div className="text-white/60">
            eye {Math.round(eye.rect.width)}×{Math.round(eye.rect.height)} · G{" "}
            {Math.round(firstGlyph.rect.width)}×
            {Math.round(firstGlyph.rect.height)}
          </div>
        )}
        <div className="mt-1 text-white/40">Alt+Shift+A to toggle</div>
      </div>
    </div>
  );
}

function Frame({
  rect,
  color,
  label,
  dashed,
}: {
  rect: DOMRect;
  color: string;
  label?: string;
  dashed?: boolean;
}) {
  return (
    <div
      className="absolute"
      style={{
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
        border: `1px ${dashed ? "dashed" : "solid"} ${color}`,
        boxShadow: `inset 0 0 0 1px ${color.replace(/[\d.]+\)$/, "0.15)")}`,
      }}
    >
      {label && (
        <span
          className="absolute -top-4 left-0 px-1 text-[9px] font-mono leading-none whitespace-nowrap"
          style={{ color, background: "rgba(0,0,0,0.7)" }}
        >
          {label}
        </span>
      )}
    </div>
  );
}

function Hline({
  y,
  x1,
  x2,
  color,
  label,
}: {
  y: number;
  x1: number;
  x2: number;
  color: string;
  label?: string;
}) {
  return (
    <div
      className="absolute"
      style={{
        left: x1,
        top: y,
        width: x2 - x1,
        height: 0,
        borderTop: `1px dashed ${color}`,
      }}
    >
      {label && (
        <span
          className="absolute -top-3 right-0 px-1 text-[9px] font-mono leading-none"
          style={{ color, background: "rgba(0,0,0,0.7)" }}
        >
          {label}
        </span>
      )}
    </div>
  );
}

function Vline({
  x,
  y1,
  y2,
  color,
  label,
}: {
  x: number;
  y1: number;
  y2: number;
  color: string;
  label?: string;
}) {
  return (
    <div
      className="absolute"
      style={{
        left: x,
        top: y1,
        width: 0,
        height: y2 - y1,
        borderLeft: `1px solid ${color}`,
      }}
    >
      {label && (
        <span
          className="absolute -bottom-4 left-0.5 px-1 text-[9px] font-mono leading-none whitespace-nowrap"
          style={{ color, background: "rgba(0,0,0,0.7)" }}
        >
          {label}
        </span>
      )}
    </div>
  );
}

function BadgeOnly({ vw, onClose }: { vw: number; onClose: () => void }) {
  return (
    <div className="pointer-events-auto fixed top-2 right-2 z-[9999] rounded-lg border border-white/20 bg-black/85 px-3 py-2 text-[11px] font-mono text-white shadow-xl">
      ALIGN QA · waiting for .brand-glow__mark · {vw}px ·{" "}
      {activeBreakpoint(vw)}
      <button
        type="button"
        onClick={onClose}
        className="ml-2 rounded border border-white/20 px-1.5 py-0.5 text-[10px] hover:bg-white/10"
      >
        close
      </button>
    </div>
  );
}

export default AlignmentQAOverlay;