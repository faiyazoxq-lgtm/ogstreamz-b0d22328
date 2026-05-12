/**
 * Tiny structured logger for server code. Emits a single-line JSON object
 * per call so worker logs (and the `server-function-logs` tool) can be
 * filtered with a simple substring search like `"tag":"tg.webhook"` or
 * `"level":"error"`.
 *
 * Keep field names short and stable — they become the searchable contract.
 */
export type LogLevel = "info" | "warn" | "error";

export function log(
  level: LogLevel,
  tag: string,
  fields: Record<string, unknown> = {},
): void {
  const safe: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(fields)) {
    if (v instanceof Error) {
      safe[k] = { message: v.message, name: v.name };
    } else {
      safe[k] = v;
    }
  }
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    tag,
    ...safe,
  });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const logInfo = (tag: string, fields?: Record<string, unknown>) =>
  log("info", tag, fields);
export const logWarn = (tag: string, fields?: Record<string, unknown>) =>
  log("warn", tag, fields);
export const logError = (tag: string, fields?: Record<string, unknown>) =>
  log("error", tag, fields);