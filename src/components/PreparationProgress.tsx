import { useEffect, useState } from "react";
import type { RetryState } from "@/hooks/use-retry-with-backoff";

type Props = {
  retry: RetryState<unknown>;
  accent: string;
  secondary: string;
  /** Optional label override, e.g. "Preparing download…" */
  label?: string;
};

/**
 * Visual progress bar for download/stream preparation.
 * - "loading"   → indeterminate shimmer sweep
 * - "retrying" while waiting → animated countdown fill toward next attempt
 * - "retrying" while in-flight → indeterminate shimmer
 * Segmented base reflects attempt N of maxAttempts so users see budget used.
 */
export function PreparationProgress({ retry, accent, secondary, label }: Props) {
  const { status, attempt, maxAttempts, nextRetryInMs, currentDelayMs } = retry;
  const [tick, setTick] = useState(0);

  // Drive the shimmer animation cheaply via local state.
  useEffect(() => {
    if (status !== "loading" && !(status === "retrying" && nextRetryInMs === 0)) return;
    const id = setInterval(() => setTick((t) => t + 1), 80);
    return () => clearInterval(id);
  }, [status, nextRetryInMs]);

  if (status !== "loading" && status !== "retrying") return null;

  const baseFrac = Math.min(1, Math.max(0, (attempt - 1) / maxAttempts));
  const slot = 1 / maxAttempts;
  const waiting = status === "retrying" && nextRetryInMs > 0 && currentDelayMs > 0;
  const waitFrac = waiting ? 1 - nextRetryInMs / currentDelayMs : 0;
  const filled = Math.min(1, baseFrac + slot * waitFrac);
  const shimmer = (tick * 6) % 100;

  const text =
    status === "loading"
      ? label ?? "Preparing…"
      : nextRetryInMs > 0
      ? `Retrying in ${Math.ceil(nextRetryInMs / 1000)}s · attempt ${attempt} of ${maxAttempts}`
      : `Retrying… attempt ${attempt} of ${maxAttempts}`;

  return (
    <div className="mt-3" aria-live="polite" role="status">
      <div
        className="relative h-1.5 rounded-full overflow-hidden"
        style={{ background: "rgba(255,255,255,0.08)" }}
      >
        {/* Filled progress */}
        <div
          className="absolute inset-y-0 left-0 transition-[width] duration-200 ease-linear"
          style={{
            width: `${(waiting ? filled : Math.max(filled, 0.08)) * 100}%`,
            background: `linear-gradient(90deg, ${accent}, ${secondary})`,
            boxShadow: `0 0 10px ${accent}aa`,
          }}
        />
        {/* Indeterminate shimmer when actively in-flight */}
        {!waiting && (
          <div
            className="absolute inset-y-0 w-1/3 opacity-70 mix-blend-screen"
            style={{
              left: `${shimmer - 33}%`,
              background: `linear-gradient(90deg, transparent, ${accent}cc, transparent)`,
            }}
          />
        )}
        {/* Attempt tick marks */}
        {Array.from({ length: maxAttempts - 1 }).map((_, i) => (
          <div
            key={i}
            className="absolute inset-y-0 w-px"
            style={{
              left: `${((i + 1) / maxAttempts) * 100}%`,
              background: "rgba(255,255,255,0.18)",
            }}
          />
        ))}
      </div>
      <p
        className="mt-1.5 text-[10px] uppercase tracking-[0.25em] text-center"
        style={{ color: accent }}
      >
        {text}
      </p>
    </div>
  );
}