import { useCallback, useEffect, useRef, useState } from "react";
import { parseApiError, type ApiErrorCode } from "@/lib/api-error";

/** Codes that are safe to auto-retry — transient, not caller-fault. */
const RETRYABLE: ReadonlySet<ApiErrorCode> = new Set([
  "UNAVAILABLE",
  "INTERNAL",
  "RATE_LIMITED",
]);

type Options = {
  /** Max automatic retries before surfacing the error to the user. */
  maxAttempts?: number;
  /** Base delay in ms; doubles each attempt with ±25% jitter. */
  baseDelayMs?: number;
  /** Hard cap per delay step. */
  maxDelayMs?: number;
};

export type RetryState<T> = {
  status: "idle" | "loading" | "retrying" | "success" | "error";
  attempt: number;
  nextRetryInMs: number; // countdown to the upcoming auto-retry, 0 when not pending
  /** Total ms scheduled for the current backoff window (for progress bars). */
  currentDelayMs: number;
  /** Max attempts configured for this run. */
  maxAttempts: number;
  data: T | null;
  errorCode: ApiErrorCode | null;
  errorMessage: string | null;
  run: () => Promise<void>;
  retry: () => Promise<void>;
  reset: () => void;
};

/**
 * Wrap an async server-fn call with exponential backoff for transient
 * failures (UNAVAILABLE, INTERNAL, RATE_LIMITED). Non-retryable errors
 * (UNAUTHENTICATED, NOT_UNLOCKED, NOT_FOUND, FORBIDDEN, INVALID_INPUT)
 * surface immediately so the UI can show the right CTA.
 */
export function useRetryWithBackoff<T>(
  fn: () => Promise<T>,
  { maxAttempts = 3, baseDelayMs = 800, maxDelayMs = 8000 }: Options = {},
): RetryState<T> {
  const [status, setStatus] = useState<RetryState<T>["status"]>("idle");
  const [attempt, setAttempt] = useState(0);
  const [data, setData] = useState<T | null>(null);
  const [errorCode, setErrorCode] = useState<ApiErrorCode | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [nextRetryInMs, setNextRetryInMs] = useState(0);
  const [currentDelayMs, setCurrentDelayMs] = useState(0);

  const fnRef = useRef(fn);
  fnRef.current = fn;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cancelledRef = useRef(false);

  const clearTimers = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (tickRef.current) clearInterval(tickRef.current);
    timerRef.current = null;
    tickRef.current = null;
  };

  useEffect(() => () => { cancelledRef.current = true; clearTimers(); }, []);

  const reset = useCallback(() => {
    clearTimers();
    setStatus("idle");
    setAttempt(0);
    setData(null);
    setErrorCode(null);
    setErrorMessage(null);
    setNextRetryInMs(0);
    setCurrentDelayMs(0);
  }, []);

  const attemptRun = useCallback(async (n: number) => {
    if (cancelledRef.current) return;
    setStatus(n === 1 ? "loading" : "retrying");
    setAttempt(n);
    setNextRetryInMs(0);
    setCurrentDelayMs(0);
    try {
      const result = await fnRef.current();
      if (cancelledRef.current) return;
      setData(result);
      setErrorCode(null);
      setErrorMessage(null);
      setStatus("success");
    } catch (e) {
      if (cancelledRef.current) return;
      const { code, message } = parseApiError(e);
      setErrorCode(code);
      setErrorMessage(message);

      const canRetry = RETRYABLE.has(code) && n < maxAttempts;
      if (!canRetry) {
        setStatus("error");
        return;
      }

      // Exponential backoff with ±25% jitter, capped at maxDelayMs.
      const exp = Math.min(maxDelayMs, baseDelayMs * 2 ** (n - 1));
      const jitter = exp * (0.75 + Math.random() * 0.5);
      const delay = Math.round(jitter);
      setStatus("retrying");
      setNextRetryInMs(delay);
      setCurrentDelayMs(delay);

      // Tick down so the UI can show "Retrying in 3s…"
      const startedAt = Date.now();
      tickRef.current = setInterval(() => {
        const remaining = Math.max(0, delay - (Date.now() - startedAt));
        setNextRetryInMs(remaining);
        if (remaining <= 0 && tickRef.current) {
          clearInterval(tickRef.current);
          tickRef.current = null;
        }
      }, 200);

      timerRef.current = setTimeout(() => {
        clearTimers();
        attemptRun(n + 1);
      }, delay);
    }
  }, [maxAttempts, baseDelayMs, maxDelayMs]);

  const run = useCallback(async () => {
    cancelledRef.current = false;
    clearTimers();
    await attemptRun(1);
  }, [attemptRun]);

  // Manual retry: reset attempt counter so the user gets a fresh budget.
  const retry = useCallback(async () => {
    cancelledRef.current = false;
    clearTimers();
    await attemptRun(1);
  }, [attemptRun]);

  return {
    status,
    attempt,
    nextRetryInMs,
    currentDelayMs,
    maxAttempts,
    data,
    errorCode,
    errorMessage,
    run,
    retry,
    reset,
  };
}