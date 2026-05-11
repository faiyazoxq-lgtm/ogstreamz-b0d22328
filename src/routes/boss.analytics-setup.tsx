import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { BarChart3, ExternalLink, Save, CheckCircle2, Loader2, Eraser } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { requireBoss } from "@/lib/route-guards";

export const Route = createFileRoute("/boss/analytics-setup")({
  beforeLoad: requireBoss,
  head: () => ({
    meta: [
      { title: "Analytics Setup · Boss · 0G-STREAMZ" },
      { name: "description", content: "Wire up Cloudflare Web Analytics — cookieless, no banner required." },
    ],
  }),
  component: AnalyticsSetup,
});

function AnalyticsSetup() {
  const [token, setToken] = useState("");
  const [initial, setInitial] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase
      .from("analytics_settings")
      .select("cf_analytics_token")
      .eq("id", 1)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) toast.error(error.message);
        const v = ((data as { cf_analytics_token?: string | null } | null)?.cf_analytics_token ?? "").trim();
        setToken(v);
        setInitial(v);
        setLoading(false);
      });
  }, []);

  const dirty = token.trim() !== initial;

  async function save() {
    setSaving(true);
    const v = token.trim() || null;
    const { error } = await supabase
      .from("analytics_settings")
      .update({ cf_analytics_token: v } as never)
      .eq("id", 1);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setInitial(v ?? "");
    toast.success(v ? "Analytics token saved — beacon will load on next page view." : "Analytics token cleared.");
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 text-foreground">
      <header className="mb-8 flex items-start gap-3">
        <div
          className="flex h-12 w-12 items-center justify-center rounded-xl"
          style={{ background: "color-mix(in oklab, #3ad6ff 18%, transparent)", color: "#3ad6ff" }}
        >
          <BarChart3 className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Cloudflare Web Analytics</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Cookieless, no banner required. Once a token is saved here, the beacon loads sitewide
            for every visitor and you'll see navigation paths in your Cloudflare dashboard.
          </p>
        </div>
      </header>

      <section className="rounded-2xl border border-border bg-card/60 p-5 backdrop-blur">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          How to grab your token
        </h2>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm">
          <li>
            Open{" "}
            <a
              href="https://dash.cloudflare.com/?to=/:account/web-analytics"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-primary underline-offset-2 hover:underline"
            >
              Cloudflare → Web Analytics <ExternalLink className="h-3 w-3" />
            </a>{" "}
            and click <em>Add a site</em>.
          </li>
          <li>
            Hostname: <code className="rounded bg-muted px-1.5 py-0.5">ogstreamz.co.uk</code>{" "}
            (add <code className="rounded bg-muted px-1.5 py-0.5">ogstreamz.lovable.app</code> as a second site if you want both).
          </li>
          <li>
            Choose <strong>Manual setup (JS snippet)</strong>. Cloudflare shows a script tag containing
            <code className="ml-1 rounded bg-muted px-1.5 py-0.5">{`data-cf-beacon='{"token":"…"}'`}</code>.
          </li>
          <li>Copy <strong>just the token string</strong> (the long hex value) and paste it below.</li>
        </ol>
      </section>

      <section className="mt-6 rounded-2xl border border-border bg-card/60 p-5 backdrop-blur">
        <label htmlFor="cf-token" className="text-sm font-semibold">
          Cloudflare beacon token
        </label>
        <input
          id="cf-token"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="e.g. 7a3c…b41 (32+ hex chars)"
          spellCheck={false}
          autoComplete="off"
          disabled={loading}
          className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-sm outline-none focus:border-primary"
        />
        <p className="mt-2 text-xs text-muted-foreground">
          Stored in your backend settings. The token is a public client snippet — Cloudflare designed it
          to ship in HTML, so it's safe to send to every visitor's browser. Leave blank to disable analytics.
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button onClick={save} disabled={!dirty || saving || loading} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save token
          </Button>
          {token && (
            <Button
              variant="outline"
              onClick={() => setToken("")}
              disabled={saving || loading}
              className="gap-2"
            >
              <Eraser className="h-4 w-4" />
              Clear
            </Button>
          )}
          {!dirty && initial && (
            <span className="inline-flex items-center gap-1 text-xs text-emerald-400">
              <CheckCircle2 className="h-3.5 w-3.5" /> Beacon active
            </span>
          )}
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-border bg-card/40 p-5 text-sm text-muted-foreground">
        <h3 className="text-sm font-semibold text-foreground">After saving</h3>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Reload the site once — the beacon loads on the next page view.</li>
          <li>It can take ~30 minutes for the first hit to show in the Cloudflare dashboard.</li>
          <li>No cookies, no consent banner needed. Tracks pageviews, referrers, navigation paths, country, device.</li>
        </ul>
      </section>
    </div>
  );
}