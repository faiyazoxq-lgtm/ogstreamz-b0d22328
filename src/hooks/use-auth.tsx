import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { promoteBossIfNeeded } from "@/lib/boss.functions";
import { notifyBossLoginIfNeeded } from "@/lib/boss-login-notify.functions";
import { getRemember, hasTabSession, markTabSession, clearTabSession } from "@/lib/remember-session";
import { hasStoredAuth } from "@/lib/has-stored-auth";
import { logSecurityEvent } from "@/lib/security-monitor.functions";
import { getDeviceHash } from "@/lib/device-id";

export type SyndicateRank = "prospect" | "enforcer" | "stream_user" | "vip" | "boss";
export type FeatureFlags = { jokes: boolean; music: boolean; tools: boolean; swearing: boolean; real_og?: boolean };

type Profile = {
  id: string;
  email: string;
  status: "free" | "vip";
  credits: number;
  rank: SyndicateRank;
  feature_flags: FeatureFlags;
  free_clicks_used: number;
  display_name: string | null;
  banned?: boolean;
  stream_status?: string | null;
  stream_expires_at?: string | null;
  stream_boss_verified_at?: string | null;
  stream_auto_checked_at?: string | null;
  og_pass_no?: number | null;
  member_tier?: string | null;
  avatar_url?: string | null;
  hub_access?: boolean;
};

type AuthCtx = {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  isAdmin: boolean;
  loading: boolean;
  // True when a persisted auth token was detected in localStorage at mount.
  // Lets UIs (e.g. the welcome prompt) skip the unauthenticated flash while
  // the session is being restored asynchronously.
  hasStoredSession: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  // Lazy init: read once at mount so SSR and first paint agree on the value.
  const [hasStoredSession, setHasStoredSession] = useState<boolean>(() => hasStoredAuth());
  const [loading, setLoading] = useState(true);

  const loadExtras = async (uid: string) => {
    try {
      const { data: { session: s } } = await supabase.auth.getSession();
      if (s?.access_token) await promoteBossIfNeeded({ data: { accessToken: s.access_token } });
    } catch { /* non-fatal */ }
    const [{ data: prof }, { data: roles }] = await Promise.all([
      supabase.from("profiles").select("id,email,status,credits,rank,feature_flags,free_clicks_used,display_name,banned,stream_status,stream_expires_at,stream_boss_verified_at,stream_auto_checked_at,og_pass_no,member_tier,avatar_url,hub_access").eq("id", uid).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", uid),
    ]);
    setProfile(prof as Profile | null);
    setIsAdmin(!!roles?.some((r) => r.role === "admin"));

    // Background: re-probe IPTV server for users who already have a linked
    // stream profile. Updates expiry/status silently. Throttled to once per
    // 10 minutes per browser session to avoid hammering the provider.
    try {
      const p = prof as Profile | null;
      if (p?.stream_status) {
        const last = Number(sessionStorage.getItem("stream:lastRefresh") || 0);
        if (Date.now() - last > 10 * 60 * 1000) {
          sessionStorage.setItem("stream:lastRefresh", String(Date.now()));
          const { reverifyStream } = await import("@/lib/stream-link.functions");
          reverifyStream({ data: {} })
            .then(async (res: any) => {
              if (res?.ok) {
                const { data: fresh } = await supabase
                  .from("profiles")
                  .select("stream_status,stream_expires_at,stream_auto_checked_at")
                  .eq("id", uid).maybeSingle();
                if (fresh) setProfile((cur) => cur ? { ...cur, ...fresh } as Profile : cur);
              }
            })
            .catch(() => { /* silent */ });
        }
      }
    } catch { /* non-fatal */ }
  };

  const refresh = async () => {
    if (user) await loadExtras(user.id);
  };

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        if (_event === "SIGNED_IN") {
          markTabSession();
          // Security audit: log sign-in with device fingerprint so Boss
          // gets alerted on new devices / unusual hours. Per-tab dedupe
          // so token refreshes don't spam events.
          try {
            const skey = "sec:signin-logged";
            if (typeof sessionStorage !== "undefined" && !sessionStorage.getItem(skey)) {
              sessionStorage.setItem(skey, "1");
              const tz =
                typeof Intl !== "undefined"
                  ? Intl.DateTimeFormat().resolvedOptions().timeZone || ""
                  : "";
              getDeviceHash()
                .then((deviceHash) =>
                  logSecurityEvent({ data: { event: "sign_in", deviceHash, timezone: tz } }),
                )
                .catch(() => {/* silent */});
            }
          } catch { /* sessionStorage may be unavailable */ }
          // Fire-and-forget: server fn no-ops for non-boss callers, and
          // silently dedupes per browser tab to avoid spamming Telegram on
          // tab focus / token refresh storms.
          try {
            const key = "boss:tg-login-notified";
            if (typeof sessionStorage !== "undefined" && !sessionStorage.getItem(key)) {
              sessionStorage.setItem(key, "1");
              const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
              const tz =
                typeof Intl !== "undefined"
                  ? Intl.DateTimeFormat().resolvedOptions().timeZone || ""
                  : "";
              notifyBossLoginIfNeeded({ data: { userAgent: ua, timezone: tz } }).catch(
                () => {/* silent — telemetry must not break auth */},
              );
            }
          } catch { /* sessionStorage may be unavailable */ }
          // Fire-and-forget: refresh the JokesHUB catalogue from the live
          // web on each sign-in. Server fn is throttled per-portal (30 min
          // cooldown) so concurrent sign-ins don't hammer the API. Tab
          // dedupe keeps a single browser tab from re-firing on token
          // refresh storms.
          try {
            const jkey = "jokes:catalogue-refreshed";
            if (typeof sessionStorage !== "undefined" && !sessionStorage.getItem(jkey)) {
              sessionStorage.setItem(jkey, "1");
              import("@/lib/portals.functions").then(({ refreshJokesCatalogue }) => {
                refreshJokesCatalogue({ data: {} }).catch(() => {/* silent — best-effort */});
              }).catch(() => {/* silent */});
            }
          } catch { /* sessionStorage may be unavailable */ }
        } else if (_event === "PASSWORD_RECOVERY") {
          logSecurityEvent({ data: { event: "password_recovery" } }).catch(() => {});
        } else if (_event === "USER_UPDATED") {
          logSecurityEvent({ data: { event: "user_updated" } }).catch(() => {});
        }
        // defer fetch to avoid recursive auth state callbacks
        setTimeout(() => loadExtras(s.user.id), 0);
      } else {
        clearTabSession();
        setProfile(null);
        setIsAdmin(false);
        try {
          sessionStorage.removeItem("boss:tg-login-notified");
          sessionStorage.removeItem("sec:signin-logged");
          sessionStorage.removeItem("jokes:catalogue-refreshed");
        } catch { /* noop */ }
      }
    });

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      // Enforce "Remember me" = off: if no tab marker exists for this
      // browser tab, the previous session was tab-only — sign out now.
      if (s?.user && !getRemember() && !hasTabSession()) {
        supabase.auth.signOut().finally(() => {
          setHasStoredSession(false);
          setLoading(false);
        });
        return;
      }
      if (s?.user) markTabSession();
      setSession(s);
      setUser(s?.user ?? null);
      setHasStoredSession(!!s?.user);
      if (s?.user) loadExtras(s.user.id).finally(() => setLoading(false));
      else setLoading(false);
    });

    // When "Remember me" is off, clear the persisted Supabase auth token
    // as the tab is being closed so reopening the browser requires sign-in.
    // sessionStorage (the per-tab marker) dies with the tab automatically;
    // we must explicitly purge the localStorage token Supabase persisted.
    const onPageHide = () => {
      if (getRemember()) return;
      try {
        for (let i = localStorage.length - 1; i >= 0; i--) {
          const key = localStorage.key(i);
          if (key && /^sb-.+-auth-token$/.test(key)) localStorage.removeItem(key);
        }
      } catch { /* ignore */ }
    };
    if (typeof window !== "undefined") {
      window.addEventListener("pagehide", onPageHide);
    }

    return () => {
      sub.subscription.unsubscribe();
      if (typeof window !== "undefined") {
        window.removeEventListener("pagehide", onPageHide);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <Ctx.Provider value={{ user, session, profile, isAdmin, loading, hasStoredSession, refresh, signOut }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used inside AuthProvider");
  return v;
}