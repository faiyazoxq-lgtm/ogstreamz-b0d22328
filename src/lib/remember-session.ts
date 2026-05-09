// "Remember me" preference + per-tab session enforcement.
// When remember=false, the session is signed out the next time the user
// returns in a fresh tab/window (no sessionStorage marker present).

const REMEMBER_KEY = "auth_remember"; // "1" remember | "0" tab-only
const TAB_KEY = "auth_tab_session";

export function getRemember(): boolean {
  if (typeof localStorage === "undefined") return true;
  return localStorage.getItem(REMEMBER_KEY) !== "0";
}

export function setRemember(remember: boolean) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(REMEMBER_KEY, remember ? "1" : "0");
}

export function markTabSession() {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.setItem(TAB_KEY, "1");
}

export function hasTabSession(): boolean {
  if (typeof sessionStorage === "undefined") return true;
  return sessionStorage.getItem(TAB_KEY) === "1";
}

export function clearTabSession() {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.removeItem(TAB_KEY);
}