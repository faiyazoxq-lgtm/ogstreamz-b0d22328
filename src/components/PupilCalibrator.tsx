import { useEffect, useMemo, useState } from "react";
import {
  getBreakpoint,
  isCalibrationEnabled,
  readOffsets,
  writeOffsets,
  type PupilBreakpoint,
  type PupilOffsetMap,
} from "@/lib/pupil-calibration";

/**
 * Calibration panel for the OG wordmark tracking pupil. Activated with
 * `?calibrate=1` (sticky) or `?calibrate=0` to disable. Lets you nudge
 * the iris hotspot in 0.5% increments per breakpoint and saves the
 * values to localStorage. Live-updates every visible OgWordmark.
 */
export function PupilCalibrator() {
  const [enabled, setEnabled] = useState(false);
  const [offsets, setOffsets] = useState<PupilOffsetMap>(() => readOffsets());
  const [autoBp, setAutoBp] = useState<PupilBreakpoint>("desktop");
  const [activeBp, setActiveBp] = useState<PupilBreakpoint | null>(null);

  useEffect(() => {
    setEnabled(isCalibrationEnabled());
    const onResize = () => setAutoBp(getBreakpoint(window.innerWidth));
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const bp = activeBp ?? autoBp;
  const cur = offsets[bp];

  const update = (dx: number, dy: number) => {
    const next: PupilOffsetMap = {
      ...offsets,
      [bp]: {
        x: round(cur.x + dx),
        y: round(cur.y + dy),
      },
    };
    setOffsets(next);
    writeOffsets(next);
  };

  const reset = () => {
    const next: PupilOffsetMap = { ...offsets, [bp]: { x: 0, y: 0 } };
    setOffsets(next);
    writeOffsets(next);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(offsets, null, 2));
    } catch {
      /* ignore */
    }
  };

  const disable = () => {
    try {
      window.localStorage.removeItem("og.pupil.cal.enabled");
    } catch {
      /* ignore */
    }
    setEnabled(false);
  };

  const summary = useMemo(
    () =>
      (Object.keys(offsets) as PupilBreakpoint[])
        .map((k) => `${k[0]}:${offsets[k].x.toFixed(1)},${offsets[k].y.toFixed(1)}`)
        .join("  "),
    [offsets],
  );

  if (!enabled) return null;

  return (
    <div
      className="fixed bottom-4 right-4 z-[200] w-[260px] rounded-lg border border-white/15 bg-black/85 p-3 text-[11px] text-white shadow-2xl backdrop-blur"
      style={{ fontFamily: "ui-monospace, SFMono-Regular, monospace" }}
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="font-semibold tracking-wider text-rose-300">
          PUPIL CALIBRATOR
        </span>
        <button
          onClick={disable}
          className="rounded px-1.5 py-0.5 text-[10px] text-white/60 hover:bg-white/10 hover:text-white"
          title="Disable (use ?calibrate=1 to re-enable)"
        >
          ✕
        </button>
      </div>

      <div className="mb-2 flex gap-1">
        {(["mobile", "tablet", "desktop"] as PupilBreakpoint[]).map((b) => (
          <button
            key={b}
            onClick={() => setActiveBp(b)}
            className={[
              "flex-1 rounded border px-1 py-1 text-[10px] uppercase tracking-wider transition",
              bp === b
                ? "border-rose-400 bg-rose-500/20 text-rose-100"
                : "border-white/15 text-white/60 hover:border-white/30 hover:text-white",
            ].join(" ")}
          >
            {b}
            {autoBp === b && <span className="ml-1 text-emerald-300">●</span>}
          </button>
        ))}
      </div>

      <div className="mb-2 text-center text-white/70">
        <span className="text-rose-200">x</span> {cur.x.toFixed(1)}%{"  "}
        <span className="text-rose-200">y</span> {cur.y.toFixed(1)}%
      </div>

      <div className="mx-auto mb-2 grid w-[120px] grid-cols-3 gap-1">
        <span />
        <Btn onClick={() => update(0, -0.5)}>↑</Btn>
        <span />
        <Btn onClick={() => update(-0.5, 0)}>←</Btn>
        <Btn onClick={reset}>·</Btn>
        <Btn onClick={() => update(0.5, 0)}>→</Btn>
        <span />
        <Btn onClick={() => update(0, 0.5)}>↓</Btn>
        <span />
      </div>

      <div className="mb-2 flex justify-center gap-2 text-[10px] text-white/50">
        <span>step 0.5%</span>
        <span>·</span>
        <span>shift = 0.1</span>
      </div>

      <div className="mb-2 text-[10px] leading-tight text-white/55">{summary}</div>

      <button
        onClick={copy}
        className="w-full rounded border border-white/20 px-2 py-1 text-[10px] uppercase tracking-wider text-white/80 hover:bg-white/10"
      >
        Copy values
      </button>
    </div>
  );
}

function Btn({ onClick, children }: { onClick: (e: React.MouseEvent) => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="rounded border border-white/20 bg-white/5 px-2 py-1 text-white hover:border-rose-400/60 hover:bg-rose-500/15"
    >
      {children}
    </button>
  );
}

function round(n: number): number {
  return Math.round(n * 10) / 10;
}

export default PupilCalibrator;