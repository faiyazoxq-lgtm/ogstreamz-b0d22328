import { useEffect, useState } from "react";

const STORAGE_KEY = "ogs_reduced_motion"; // "on" | "off" | absent (= follow OS)
const EVENT = "ogs:reduced-motion-change";

function readPreference(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "on") return true;
    if (stored === "off") return false;
  } catch { /* ignore */ }
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

/** Returns true when the user prefers minimal animation (OS pref or manual override). */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState<boolean>(readPreference);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(readPreference());
    mq.addEventListener?.("change", update);
    window.addEventListener("storage", update);
    window.addEventListener(EVENT, update);
    return () => {
      mq.removeEventListener?.("change", update);
      window.removeEventListener("storage", update);
      window.removeEventListener(EVENT, update);
    };
  }, []);

  return reduced;
}

export type ReducedMotionMode = "auto" | "on" | "off";

export function getReducedMotionMode(): ReducedMotionMode {
  if (typeof window === "undefined") return "auto";
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "on" || v === "off") return v;
  } catch { /* ignore */ }
  return "auto";
}

export function setReducedMotionMode(mode: ReducedMotionMode) {
  if (typeof window === "undefined") return;
  try {
    if (mode === "auto") localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, mode);
    window.dispatchEvent(new Event(EVENT));
  } catch { /* ignore */ }
}