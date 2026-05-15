import { createServerFn } from "@tanstack/react-start";
import { requireStrictAuth } from "@/lib/strict-auth";

export const getMyStreamCredentials = createServerFn({ method: "GET" })
  .middleware([requireStrictAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await (supabase as any).rpc("get_my_stream_credentials");
    if (error) {
      // RLS / not-authenticated bubbles up here; return empty rather than 500.
      return { credentials: null, error: error.message };
    }
    const row = Array.isArray(data) && data.length > 0 ? data[0] : null;
    if (!row) return { credentials: null, error: null };
    return {
      credentials: {
        username: row.username as string,
        password: (row.password as string) ?? null,
        status: (row.status as string) ?? null,
        expires_at: (row.expires_at as string) ?? null,
        updated_at: (row.updated_at as string) ?? null,
      },
      error: null,
    };
  });