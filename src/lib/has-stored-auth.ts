// Synchronously detect whether the Supabase auth client has a persisted
// session in localStorage. Used to skip the welcome-prompt flash on refresh
// while supabase.auth.getSession() resolves asynchronously.
export function hasStoredAuth(): boolean {
  if (typeof window === "undefined" || typeof localStorage === "undefined") {
    return false;
  }
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      // Supabase v2 default key shape: sb-<project-ref>-auth-token
      if (/^sb-.+-auth-token$/.test(key)) {
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        // Avoid false positives from cleared placeholders.
        if (raw === "null" || raw === "undefined" || raw === "") continue;
        return true;
      }
    }
  } catch {
    /* localStorage may throw in private mode */
  }
  return false;
}