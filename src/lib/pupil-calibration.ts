/**
 * Pupil calibration: per-breakpoint % offsets nudging the iris hotspot inside
 * the OG wordmark artwork. Persisted to localStorage so the calibration mode
 * panel survives reloads. Shared by `OgWordmark` (consumer) and
 * `PupilCalibrator` (editor) via a tiny pub/sub.
 */

export type PupilBreakpoint = "mobile" | "tablet" | "desktop";
export type PupilOffset = { x: number; y: number };
export type PupilOffsetMap = Record<PupilBreakpoint, PupilOffset>;

export const PUPIL_CAL_KEY = "og.pupil.cal.v1";
export const PUPIL_CAL_FLAG = "og.pupil.cal.enabled";

const ZERO: PupilOffsetMap = {
  mobile: { x: 0, y: 0 },
  tablet: { x: 0, y: 0 },
  desktop: { x: 0, y: 0 },
};

export function getBreakpoint(width: number): PupilBreakpoint {
  if (width < 640) return "mobile";
  if (width < 1024) return "tablet";
  return "desktop";
}

export function readOffsets(): PupilOffsetMap {
  if (typeof window === "undefined") return { ...ZERO };
  try {
    const raw = window.localStorage.getItem(PUPIL_CAL_KEY);
    if (!raw) return { ...ZERO };
    const parsed = JSON.parse(raw) as Partial<PupilOffsetMap>;
    return {
      mobile: { ...ZERO.mobile, ...(parsed.mobile ?? {}) },
      tablet: { ...ZERO.tablet, ...(parsed.tablet ?? {}) },
      desktop: { ...ZERO.desktop, ...(parsed.desktop ?? {}) },
    };
  } catch {
    return { ...ZERO };
  }
}

export function writeOffsets(map: PupilOffsetMap) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PUPIL_CAL_KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
  for (const fn of subs) fn(map);
}

const subs = new Set<(m: PupilOffsetMap) => void>();

export function subscribePupilOffsets(fn: (m: PupilOffsetMap) => void): () => void {
  subs.add(fn);
  return () => {
    subs.delete(fn);
  };
}

/** True if the URL or localStorage requested calibration mode. */
export function isCalibrationEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get("calibrate") === "1") {
      window.localStorage.setItem(PUPIL_CAL_FLAG, "1");
      return true;
    }
    if (params.get("calibrate") === "0") {
      window.localStorage.removeItem(PUPIL_CAL_FLAG);
      return false;
    }
    return window.localStorage.getItem(PUPIL_CAL_FLAG) === "1";
  } catch {
    return false;
  }
}