import { redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { hasStoredAuth } from "@/lib/has-stored-auth";

type GuardCtx = { location: { href: string; pathname: string } };

function stashRedirect(location: GuardCtx["location"]) {
  try {
    const target = location.href || location.pathname;
    if (target && target.startsWith("/") && !target.startsWith("/auth")) {
      sessionStorage.setItem("post_auth_redirect", target);
    }
  } catch { /* ignore */ }
}

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
export async function requireMember({ location }: GuardCtx) {
  if (typeof window === "undefined") return;
  const stash = () => stashRedirect(location);

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

  const uid = data.session.user.id;
  const { data: prof } = await supabase
    .from("profiles").select("banned").eq("id", uid).maybeSingle();
  if (prof?.banned) {
    throw redirect({ to: "/", search: { banned: "1" } as never });
  }
}

/**
 * Route guard: only OGSTREAMZ-approved users (stream_user / vip / boss / admin)
 * can open this route. Plain members are bounced to /profile to link their
 * stream account.
 *
 * SSR-safe: skips on the server; client revalidates on hydration.
 */
export async function requireUsageAccess({ location }: GuardCtx) {
  if (typeof window === "undefined") return;
  const stash = () => stashRedirect(location);

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

/**
 * Route guard: only paid VIP-tier users (rank=vip, status=vip, an active
 * vip_pass, or boss/admin override) may enter. Signed-in non-VIPs get
 * bounced to /vip with an `upgrade` flag so the upgrade CTA highlights.
 */
export async function requireVip({ location }: GuardCtx) {
  if (typeof window === "undefined") return;
  const stash = () => stashRedirect(location);

  if (!hasStoredAuth()) { stash(); throw redirect({ to: "/auth" }); }

  const { data: sess } = await supabase.auth.getSession();
  const uid = sess.session?.user?.id;
  if (!uid) { stash(); throw redirect({ to: "/auth" }); }

  const [{ data: prof }, { data: adminRow }, { data: pass }] = await Promise.all([
    supabase.from("profiles").select("rank,status,banned").eq("id", uid).maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", uid).eq("role", "admin").maybeSingle(),
    supabase.from("vip_passes").select("id").eq("user_id", uid)
      .is("revoked_at", null).gt("expires_at", new Date().toISOString()).limit(1).maybeSingle(),
  ]);

  if (prof?.banned) {
    throw redirect({ to: "/", search: { banned: "1" } as never });
  }

  const rank = prof?.rank as string | undefined;
  const isVip =
    !!adminRow ||
    rank === "boss" ||
    rank === "vip" ||
    prof?.status === "vip" ||
    !!pass;

  if (!isVip) {
    throw redirect({ to: "/vip", search: { upgrade: "vip" } as never });
  }
}

/**
 * Route guard: only Boss-tier users (rank=boss) or admins may enter.
 * Unauthenticated → /auth (with redirect-back). Signed-in but not boss → /.
 */
export async function requireBoss({ location }: GuardCtx) {
  if (typeof window === "undefined") return;
  const stash = () => stashRedirect(location);

  if (!hasStoredAuth()) { stash(); throw redirect({ to: "/auth" }); }

  const { data: sess } = await supabase.auth.getSession();
  const uid = sess.session?.user?.id;
  if (!uid) { stash(); throw redirect({ to: "/auth" }); }

  const [{ data: prof }, { data: adminRow }] = await Promise.all([
    supabase.from("profiles").select("rank,banned").eq("id", uid).maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", uid).eq("role", "admin").maybeSingle(),
  ]);

  if (prof?.banned) {
    throw redirect({ to: "/", search: { banned: "1" } as never });
  }
  const isBoss = prof?.rank === "boss" || !!adminRow;
  if (!isBoss) {
    throw redirect({ to: "/", search: { forbidden: "boss" } as never });
  }
}

/**
 * Route guard: admin role only. Unauthenticated → /auth, signed-in non-admin → /.
 */
export async function requireAdmin({ location }: GuardCtx) {
  // (unchanged below)
  if (typeof window === "undefined") return;
  const stash = () => stashRedirect(location);

  if (!hasStoredAuth()) { stash(); throw redirect({ to: "/auth" }); }

  const { data: sess } = await supabase.auth.getSession();
  const uid = sess.session?.user?.id;
  if (!uid) { stash(); throw redirect({ to: "/auth" }); }

  const [{ data: prof }, { data: adminRow }] = await Promise.all([
    supabase.from("profiles").select("rank,banned").eq("id", uid).maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", uid).eq("role", "admin").maybeSingle(),
  ]);

  if (prof?.banned) {
    throw redirect({ to: "/", search: { banned: "1" } as never });
  }
  const isAdmin = !!adminRow || prof?.rank === "boss";
  if (!isAdmin) {
    throw redirect({ to: "/", search: { forbidden: "admin" } as never });
  }
}

/**
 * Hub route guard: identical to `requireBoss`, except signed-in non-boss users
 * (VIPs / members) are redirected to `/portals` instead of `/`. Hubs are the
 * Boss-only authoring surfaces (MusicHUB, JokesHUB, ToolHUB, etc.) — non-boss
 * traffic should land on the curated portal grid they're allowed to use.
 */
export async function requireBossHub({ location }: GuardCtx) {
  if (typeof window === "undefined") return;
  const stash = () => stashRedirect(location);

  if (!hasStoredAuth()) { stash(); throw redirect({ to: "/auth" }); }

  const { data: sess } = await supabase.auth.getSession();
  const uid = sess.session?.user?.id;
  if (!uid) { stash(); throw redirect({ to: "/auth" }); }

  const [{ data: prof }, { data: adminRow }] = await Promise.all([
    supabase.from("profiles").select("rank,banned").eq("id", uid).maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", uid).eq("role", "admin").maybeSingle(),
  ]);

  if (prof?.banned) {
    throw redirect({ to: "/", search: { banned: "1" } as never });
  }
  const isBoss = prof?.rank === "boss" || !!adminRow;
  if (!isBoss) {
    throw redirect({ to: "/portals", search: { forbidden: "hub" } as never });
  }
}

/**
 * Route guard: reseller role (or boss/admin override).
 */
export async function requireReseller({ location }: GuardCtx) {
  if (typeof window === "undefined") return;
  const stash = () => stashRedirect(location);

  if (!hasStoredAuth()) { stash(); throw redirect({ to: "/auth" }); }

  const { data: sess } = await supabase.auth.getSession();
  const uid = sess.session?.user?.id;
  if (!uid) { stash(); throw redirect({ to: "/auth" }); }

  const [{ data: prof }, { data: roles }, { data: ra }] = await Promise.all([
    supabase.from("profiles").select("rank,banned").eq("id", uid).maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", uid),
    supabase.from("reseller_accounts").select("active").eq("user_id", uid).maybeSingle(),
  ]);

  if (prof?.banned) {
    throw redirect({ to: "/", search: { banned: "1" } as never });
  }
  const roleSet = new Set((roles ?? []).map((r) => r.role as string));
  const ok =
    prof?.rank === "boss" ||
    roleSet.has("admin") ||
    (roleSet.has("reseller") && ra?.active !== false);
  if (!ok) {
    throw redirect({ to: "/", search: { forbidden: "reseller" } as never });
  }
}

/**
 * Route guard: only members with a confirmed Telegram link (chat_id bound)
 * can open this route. Used to gate group features — no chat_id, no group
 * invite delivery channel, so we must redirect to the connect-telegram gate.
 *
 * Composes on top of requireMember semantics: also bounces unauthenticated
 * users to /auth.
 */
export async function requireTelegramLink({ location }: GuardCtx) {
  if (typeof window === "undefined") return;
  const stash = () => stashRedirect(location);

  if (!hasStoredAuth()) { stash(); throw redirect({ to: "/auth" }); }

  const { data: sess } = await supabase.auth.getSession();
  const uid = sess.session?.user?.id;
  if (!uid) { stash(); throw redirect({ to: "/auth" }); }

  const { data: prof } = await supabase
    .from("profiles").select("banned").eq("id", uid).maybeSingle();
  if (prof?.banned) {
    throw redirect({ to: "/", search: { banned: "1" } as never });
  }

  const { data: link } = await supabase
    .from("telegram_user_links")
    .select("chat_id")
    .eq("user_id", uid)
    .maybeSingle();

  if (!link?.chat_id) {
    try { sessionStorage.setItem("post_telegram_redirect", location.href || "/"); } catch { /* ignore */ }
    throw redirect({ to: "/connect-telegram" });
  }
}
