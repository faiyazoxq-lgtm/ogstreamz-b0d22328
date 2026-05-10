import { redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { hasStoredAuth } from "@/lib/has-stored-auth";

/**
 * Route guard: only signed-in members can open this route.
 *
 * Use as: `beforeLoad: requireMember`.
 *
 * SSR-safe: on the server we can't see the user's localStorage session,
 * so we skip the check there and let the client revalidate on hydration.
 * On the client we wait for Supabase to restore the session before deciding.
 * Unauthenticated users are redirected to /auth with a `redirect` search
 * param so they bounce back here after sign-in.
 */
export async function requireMember({ location }: { location: { href: string; pathname: string } }) {
  if (typeof window === "undefined") return;

  const stash = () => {
    try {
      const target = location.href || location.pathname;
      if (target && target.startsWith("/") && !target.startsWith("/auth")) {
        sessionStorage.setItem("post_auth_redirect", target);
      }
    } catch { /* ignore */ }
  };

  // Fast-path: no stored token at all → block immediately.
  if (!hasStoredAuth()) {
    stash();
    throw redirect({ to: "/auth" });
  }

  // Verify a real session exists.
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.user) {
    stash();
    throw redirect({ to: "/auth" });
  }
}

/**
 * Route guard: only OGSTREAMZ-approved users (stream_user / vip / boss / admin)
 * can open this route. Plain members are bounced to /profile to link their
 * stream account.
 *
 * SSR-safe: skips on the server; client revalidates on hydration.
 */
export async function requireUsageAccess({ location }: { location: { href: string; pathname: string } }) {
  if (typeof window === "undefined") return;

  const stash = () => {
    try {
      const target = location.href || location.pathname;
      if (target && target.startsWith("/") && !target.startsWith("/auth")) {
        sessionStorage.setItem("post_auth_redirect", target);
      }
    } catch { /* ignore */ }
  };

  if (!hasStoredAuth()) { stash(); throw redirect({ to: "/auth" }); }

  const { data: sess } = await supabase.auth.getSession();
  const uid = sess.session?.user?.id;
  if (!uid) { stash(); throw redirect({ to: "/auth" }); }

  const [{ data: prof }, { data: roleRow }, { data: pass }] = await Promise.all([
    supabase.from("profiles").select("rank,status,banned").eq("id", uid).maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", uid).eq("role", "admin").maybeSingle(),
    supabase.from("vip_passes").select("id").eq("user_id", uid)
      .is("revoked_at", null).gt("expires_at", new Date().toISOString()).limit(1).maybeSingle(),
  ]);

  if (prof?.banned) {
    throw redirect({ to: "/", search: { banned: "1" } as never });
  }

  const rank = prof?.rank as string | undefined;
  const ok =
    !!roleRow ||
    rank === "boss" ||
    rank === "vip" ||
    rank === "stream_user" ||
    prof?.status === "vip" ||
    !!pass;

  if (!ok) {
    // Marketing-only members → send to profile so they can link a stream.
    throw redirect({ to: "/profile", search: { upgrade: "stream" } as never });
  }
}
