import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { promoteBossIfNeeded } from "@/lib/boss.functions";
import { getRemember, hasTabSession, markTabSession, clearTabSession } from "@/lib/remember-session";
import { hasStoredAuth } from "@/lib/has-stored-auth";

export type SyndicateRank = "prospect" | "enforcer" | "vip" | "boss";
export type FeatureFlags = { jokes: boolean; music: boolean; tools: boolean; swearing: boolean };

type Profile = {
  id: string;
  email: string;
  status: "free" | "vip";
  credits: number;
  rank: SyndicateRank;
  feature_flags: FeatureFlags;
  free_clicks_used: number;
  display_name: string | null;
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
      supabase.from("profiles").select("id,email,status,credits,rank,feature_flags,free_clicks_used,display_name").eq("id", uid).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", uid),
    ]);
    setProfile(prof as Profile | null);
    setIsAdmin(!!roles?.some((r) => r.role === "admin"));
  };

  const refresh = async () => {
    if (user) await loadExtras(user.id);
  };

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        if (_event === "SIGNED_IN") markTabSession();
        // defer fetch to avoid recursive auth state callbacks
        setTimeout(() => loadExtras(s.user.id), 0);
      } else {
        clearTabSession();
        setProfile(null);
        setIsAdmin(false);
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

    return () => sub.subscription.unsubscribe();
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