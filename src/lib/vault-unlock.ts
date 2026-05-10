const KEY = "vault:unlocked";

export function isVaultUnlocked(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.sessionStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function setVaultUnlocked(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(KEY, "1");
    window.dispatchEvent(new Event("vault:unlock-changed"));
  } catch {
    /* noop */
  }
}

export function clearVaultUnlock(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(KEY);
    window.dispatchEvent(new Event("vault:unlock-changed"));
  } catch {
    /* noop */
  }
}