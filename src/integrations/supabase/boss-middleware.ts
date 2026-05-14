import { createMiddleware } from "@tanstack/react-start";
import { requireSupabaseAuth } from "./auth-middleware";

/**
 * Server-fn middleware that requires the caller to be Boss (rank='boss')
 * OR carry the 'admin' role. Composes on top of `requireSupabaseAuth`, so
 * any handler using it gets `{ supabase, userId, claims }` in context after
 * the boss check passes.
 *
 * Failure modes:
 *  - 401 if the bearer token is missing/invalid (from requireSupabaseAuth)
 *  - 403 if the caller is authenticated but not boss/admin
 *
 * Use this on every credential / admin-only server function so direct API
 * calls cannot bypass UI route guards.
 */
export const requireBoss = createMiddleware({ type: "function" })
  .middleware([requireSupabaseAuth])
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
 * Composes on top of `requireSupabaseAuth`. Failure modes:
 *  - 401 if the bearer token is missing/invalid
 *  - 403 if the caller is rank=boss
 *
 * Admins who are NOT Boss are allowed through (so support staff can run
 * test purchases). Only `is_boss` truthiness blocks the call.
 */
export const rejectBoss = createMiddleware({ type: "function" })
  .middleware([requireSupabaseAuth])
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