import { useEffect, useRef, useState } from "react";
import { useGlobalMood } from "@/hooks/use-global-mood";

/**
 * Fires a 1s "System Glitch" overlay every time the global mood changes.
 * Mounted once at the root.
 */
export function SystemGlitchOverlay() {
  const { mood, loading } = useGlobalMood();
  const [active, setActive] = useState(false);
  const [key, setKey] = useState(0);
  const last = useRef<string | null>(null);

  useEffect(() => {
    if (loading) return;
    if (last.current === null) {
      last.current = mood;
      return;
    }
    if (last.current === mood) return;
    last.current = mood;
    setKey((k) => k + 1);
    setActive(true);
    const t = setTimeout(() => setActive(false), 1000);
    return () => clearTimeout(t);
  }, [mood, loading]);

  if (!active) return null;
  return <div key={key} aria-hidden className="system-glitch-overlay" />;
}