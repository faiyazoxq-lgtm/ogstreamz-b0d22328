import { createFileRoute } from "@tanstack/react-router";
import { runSyndicateTickInternal } from "@/lib/syndicate.functions";

export const Route = createFileRoute("/api/public/hooks/syndicate-tick")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const provided = request.headers.get("apikey") || "";
        const expected = process.env.SYNDICATE_TICK_SECRET || "";
        if (!expected || provided.length !== expected.length) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401, headers: { "Content-Type": "application/json" },
          });
        }
        let diff = 0;
        for (let i = 0; i < expected.length; i++) diff |= provided.charCodeAt(i) ^ expected.charCodeAt(i);
        if (diff !== 0) {
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