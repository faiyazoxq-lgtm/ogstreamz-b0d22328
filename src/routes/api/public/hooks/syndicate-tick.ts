import { createFileRoute } from "@tanstack/react-router";
import { runSyndicateTickInternal } from "@/lib/syndicate.functions";

export const Route = createFileRoute("/api/public/hooks/syndicate-tick")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apikey = request.headers.get("apikey") || "";
        const expected = process.env.SUPABASE_PUBLISHABLE_KEY || "";
        if (!expected || apikey !== expected) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401, headers: { "Content-Type": "application/json" },
          });
        }
        try {
          const r = await runSyndicateTickInternal();
          return Response.json({ ok: true, ...r });
        } catch (e: any) {
          return Response.json({ ok: false, error: e?.message || "tick failed" }, { status: 500 });
        }
      },
    },
  },
});