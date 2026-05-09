import { createStart, createMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";
import { supabase } from "./integrations/supabase/client";

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

// Forward the Supabase access token to every server function call so
// `requireSupabaseAuth` middleware can authenticate the user.
const supabaseAuthForwardMiddleware = createMiddleware({ type: "function" }).client(
  async ({ next }) => {
    let token: string | undefined;
    try {
      if (typeof window !== "undefined") {
        const { data } = await supabase.auth.getSession();
        token = data.session?.access_token;
      }
    } catch { /* ignore */ }
    return next(token ? { headers: { Authorization: `Bearer ${token}` } } : {});
  },
);

export const startInstance = createStart(() => ({
  requestMiddleware: [errorMiddleware],
  functionMiddleware: [supabaseAuthForwardMiddleware],
}));
