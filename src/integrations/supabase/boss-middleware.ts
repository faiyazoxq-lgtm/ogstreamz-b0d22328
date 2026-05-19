import { createMiddleware } from "@tanstack/react-start";
import { requireStrictAuth } from "@/lib/strict-auth";

/**
 * Server-fn middleware that requires the caller to be Boss (rank='boss')
 * OR carry the 'admin' role. Composes on top of `requireStrictAuth`, so
 * any handler using it gets `{ supabase, userId, claims }` in context after
 * the boss check passes.
 *
 * Failure modes:
 *  - 401 if the bearer token is missing/invalid (from requireStrictAuth)
 *  - 403 if the caller is authenticated but not boss/admin
 *
 * Use this on every credential / admin-only server function so direct API
 * calls cannot bypass UI route guards.
 */
export const requireBoss = createMiddleware({ type: "function" })
  .middleware([requireStrictAuth])
  .server(async ({ next, context }) => {
    const { supabase, userId } = context as {
      supabase: any;
      userId: string;
    };

    const [bossRes, roleRes] = await Promise.all([
      supabase.rpc("is_boss", { _uid: userId }),
      supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .eq("role", "admin")
        .maybeSingle(),
    ]);

    const isBoss = !!bossRes?.data;
    const isAdmin = !!roleRes?.data;
    if (!isBoss && !isAdmin) {
      throw new Response("Forbidden: Boss only", { status: 403 });
    }

    return next({ context: { isBoss, isAdmin } });
  });

/**
 * Server-fn middleware that REJECTS Boss callers. Boss accounts have an
 * unlimited Credits Reserve and must never go through paid checkout, top-up,
 * or coin-spend flows — direct API calls from a Boss session must 403 even
 * when the UI hides the buttons.
 *
 * Composes on top of `requireStrictAuth`. Failure modes:
 *  - 401 if the bearer token is missing/invalid
 *  - 403 if the caller is rank=boss
 *
 * Admins who are NOT Boss are allowed through (so support staff can run
 * test purchases). Only `is_boss` truthiness blocks the call.
 */
export const rejectBoss = createMiddleware({ type: "function" })
  .middleware([requireStrictAuth])
  .server(async ({ next, context }) => {
    const { supabase, userId } = context as {
      supabase: any;
      userId: string;
    };
    const { data } = await supabase.rpc("is_boss", { _uid: userId });
    if (data) {
      throw new Response(
        "Forbidden: Boss accounts cannot purchase credits — your Reserve is unlimited.",
        { status: 403 }
      );
    }
    return next();
  });

/**
 * Server-fn middleware that mirrors the `requireBossHub` client route guard:
 * allow callers who are boss (rank='boss'), carry the 'admin' role, OR have
 * `profiles.hub_access = true`. Everyone else gets 403.
 *
 * Use this on hub-only server functions (e.g. `bossChat`) so direct API
 * calls from authenticated non-hub members cannot burn paid AI credits.
 *
 * Composes on top of `requireStrictAuth`. Failure modes:
 *  - 401 if the bearer token is missing/invalid
 *  - 403 if the caller is not boss/admin and lacks `hub_access`
 */
export const requireHubAccess = createMiddleware({ type: "function" })
  .middleware([requireStrictAuth])
  .server(async ({ next, context }) => {
    const { supabase, userId } = context as {
      supabase: any;
      userId: string;
    };

    const [profRes, roleRes] = await Promise.all([
      supabase
        .from("profiles")
        .select("rank, hub_access, banned")
        .eq("id", userId)
        .maybeSingle(),
      supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .eq("role", "admin")
        .maybeSingle(),
    ]);

    const prof = profRes?.data as
      | { rank?: string | null; hub_access?: boolean | null; banned?: boolean | null }
      | null;
    if (prof?.banned) {
      throw new Response("Forbidden: account banned", { status: 403 });
    }
    const isBoss = prof?.rank === "boss";
    const isAdmin = !!roleRes?.data;
    const hasHubGrant = !!prof?.hub_access;
    if (!isBoss && !isAdmin && !hasHubGrant) {
      throw new Response("Forbidden: Hub access required", { status: 403 });
    }
    return next({ context: { isBoss, isAdmin, hasHubGrant } });
  });