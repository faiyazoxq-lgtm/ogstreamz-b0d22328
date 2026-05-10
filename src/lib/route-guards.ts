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

  // Fast-path: no stored token at all → block immediately.
  if (!hasStoredAuth()) {
    throw redirect({
      to: "/auth",
      search: { redirect: location.href } as never,
    });
  }

  // Verify a real session exists.
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.user) {
    throw redirect({
      to: "/auth",
      search: { redirect: location.href } as never,
    });
  }
}
