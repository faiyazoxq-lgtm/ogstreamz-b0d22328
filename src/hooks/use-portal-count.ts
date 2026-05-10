/**
 * Shared helper for the portal count + pluralized label used across the app.
 * Keeps the "X portal(s)" phrasing consistent everywhere.
 */
export type PortalCountInput = {
  builtIn: ReadonlyArray<unknown> | number;
  custom: ReadonlyArray<unknown> | number;
};

export type PortalCount = {
  /** Total = built-in portals + custom hubs. */
  total: number;
  /** "1 portal" / "0 portals" / "12 portals". */
  label: string;
  /** Just the suffix — "" or "s". */
  suffix: "" | "s";
};

const sizeOf = (v: ReadonlyArray<unknown> | number) =>
  typeof v === "number" ? v : v.length;

/** Pure helper — safe in components, loaders, server fns. */
export function getPortalCount({ builtIn, custom }: PortalCountInput): PortalCount {
  const total = Math.max(0, sizeOf(builtIn)) + Math.max(0, sizeOf(custom));
  const suffix: "" | "s" = total === 1 ? "" : "s";
  return { total, label: `${total} portal${suffix}`, suffix };
}

/** Hook flavour for components that already have arrays in render scope. */
export function usePortalCount(
  builtIn: ReadonlyArray<unknown> | number,
  custom: ReadonlyArray<unknown> | number,
): PortalCount {
  return getPortalCount({ builtIn, custom });
}