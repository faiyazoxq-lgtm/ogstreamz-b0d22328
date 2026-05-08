import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Shield, Loader2, Save, Telescope, Link2, Wand2, Copy, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { scoutUrl } from "@/lib/firecrawl.functions";
import { spawnPortal } from "@/lib/portals.functions";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Admin Console · 0G-PORTAL" }] }),
  component: AdminPage,
});

type Row = { id: string; email: string; status: "free" | "vip"; credits: number };

function AdminPage() {
  const { user, isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user || !isAdmin) navigate({ to: "/" });
  }, [user, isAdmin, loading, navigate]);

  useEffect(() => {
    if (!isAdmin) return;
    supabase
      .from("profiles")
      .select("id,email,status,credits")
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (error) toast.error(error.message);
        else setRows((data as Row[]) ?? []);
      });
  }, [isAdmin]);

  const update = async (id: string, patch: Partial<Row>) => {
    setBusy(id);
    const { error } = await supabase.from("profiles").update(patch).eq("id", id);
    setBusy(null);
    if (error) return toast.error(error.message);
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    toast.success("Vault updated");
  };

  if (loading || !isAdmin) {
    return <main className="px-5 py-20 text-center text-muted-foreground">Verifying clearance…</main>;
  }

  return (
    <main className="max-w-5xl mx-auto px-5 sm:px-8 py-12">
      <header className="mb-8">
        <p className="text-xs uppercase tracking-[0.4em] font-semibold" style={{ color: "var(--neon-blue-bright)" }}>
          <Shield className="inline h-3.5 w-3.5 mr-2" />Admin Console
        </p>
        <h1 className="mt-3 font-[Montserrat] font-black text-3xl sm:text-5xl text-metallic">Syndicate Roster</h1>
      </header>

      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="grid grid-cols-12 gap-2 px-5 py-3 text-[10px] uppercase tracking-[0.3em] text-muted-foreground border-b border-border">
          <div className="col-span-5">Email</div>
          <div className="col-span-3">Status</div>
          <div className="col-span-2">Credits</div>
          <div className="col-span-2 text-right">Action</div>
        </div>
        {rows.map((r) => (
          <RoleRow key={r.id} row={r} busy={busy === r.id} onSave={(p) => update(r.id, p)} />
        ))}
        {rows.length === 0 && (
          <p className="px-5 py-10 text-center text-sm text-muted-foreground">No members yet.</p>
        )}
      </div>

      <ScoutPanel />
      <SpawnerPanel />
    </main>
  );
}

function SpawnerPanel() {
  const spawn = useServerFn(spawnPortal);
  const [name, setName] = useState("");
  const [niche, setNiche] = useState("");
  const [language, setLanguage] = useState("English");
  const [vibe, setVibe] = useState("");
  const [loading, setLoading] = useState(false);
  const [created, setCreated] = useState<{ slug: string; name: string; theme: string } | null>(null);

  const run = async () => {
    if (!name.trim() || !niche.trim()) {
      toast.error("Name and niche required");
      return;
    }
    setLoading(true);
    setCreated(null);
    try {
      const r = await spawn({ data: { name: name.trim(), niche: niche.trim(), language: language.trim() || "English", vibe: vibe.trim() } });
      setCreated(r.portal);
      toast.success(`Spawned "${r.portal.name}" with ${r.jokeCount} jokes`);
      setName(""); setNiche(""); setVibe("");
    } catch (e: any) {
      toast.error(e?.message ?? "Spawn failed");
    } finally {
      setLoading(false);
    }
  };

  const url = created ? `${typeof window !== "undefined" ? window.location.origin : ""}/p/${created.slug}` : "";

  return (
    <section className="mt-10 rounded-2xl border border-[oklch(0.72_0.22_245/0.4)] bg-card p-6 sm:p-8">
      <header className="flex items-center gap-3 mb-5">
        <Wand2 className="h-5 w-5" style={{ color: "var(--neon-blue-bright)" }} />
        <h2 className="font-[Montserrat] font-black text-xl text-white">Portal Spawner</h2>
        <span className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Niche generator</span>
      </header>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Portal Name</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Chinese Smelly Jokes" className="mt-1 h-11 bg-background" />
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Language</label>
          <Input value={language} onChange={(e) => setLanguage(e.target.value)} placeholder="Chinese / English / Spanish..." className="mt-1 h-11 bg-background" />
        </div>
        <div className="sm:col-span-2">
          <label className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Niche / Theme Description</label>
          <textarea
            value={niche}
            onChange={(e) => setNiche(e.target.value)}
            placeholder="Traditional Chinese style, focus on smelly humor"
            rows={2}
            className="mt-1 w-full bg-background border border-border rounded-md px-3 py-2 text-sm resize-y"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Mascot / Image Vibe</label>
          <Input value={vibe} onChange={(e) => setVibe(e.target.value)} placeholder="Ancient Chinese architecture and characters" className="mt-1 h-11 bg-background" />
        </div>
      </div>
      <Button
        onClick={run}
        disabled={loading}
        className="btn-glass-blue text-white text-xs uppercase tracking-[0.25em] font-bold h-12 px-8 mt-5"
      >
        {loading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Spawning...</> : <><Wand2 className="h-4 w-4 mr-2" />Generate Portal</>}
      </Button>

      {created && (
        <div className="mt-6 p-4 rounded-xl border border-border bg-background/60">
          <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Live Portal</p>
          <div className="mt-2 flex items-center gap-2 flex-wrap">
            <code className="text-sm text-white font-mono">/p/{created.slug}</code>
            <span className="text-xs px-2 py-0.5 rounded-full bg-secondary border border-border">{created.theme}</span>
            <Button size="sm" variant="ghost" onClick={() => { navigator.clipboard?.writeText(url); toast.success("URL copied"); }}>
              <Copy className="h-3.5 w-3.5 mr-1" />Copy
            </Button>
            <a href={`/p/${created.slug}`} target="_blank" rel="noreferrer" className="inline-flex items-center text-xs underline">
              <ExternalLink className="h-3.5 w-3.5 mr-1" />Open
            </a>
          </div>
        </div>
      )}
    </section>
  );
}

function RoleRow({ row, busy, onSave }: { row: Row; busy: boolean; onSave: (p: Partial<Row>) => void }) {
  const [credits, setCredits] = useState(String(row.credits));
  const [status, setStatus] = useState<"free" | "vip">(row.status);
  return (
    <div className="grid grid-cols-12 gap-2 px-5 py-4 items-center border-b border-border last:border-b-0">
      <div className="col-span-5 text-sm truncate">{row.email}</div>
      <div className="col-span-3">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as "free" | "vip")}
          className="bg-background border border-border rounded-md px-2 py-1.5 text-sm w-full"
        >
          <option value="free">Free</option>
          <option value="vip">VIP</option>
        </select>
      </div>
      <div className="col-span-2">
        <Input
          type="number"
          min={0}
          value={credits}
          onChange={(e) => setCredits(e.target.value)}
          className="h-9"
        />
      </div>
      <div className="col-span-2 text-right">
        <Button
          size="sm"
          disabled={busy}
          onClick={() => onSave({ credits: parseInt(credits, 10) || 0, status })}
          className="btn-glass-blue text-white text-xs uppercase tracking-widest"
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><Save className="h-3.5 w-3.5 mr-1" />Save</>}
        </Button>
      </div>
    </div>
  );
}

function ScoutPanel() {
  const scout = useServerFn(scoutUrl);
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Awaited<ReturnType<typeof scoutUrl>> | null>(null);

  const run = async () => {
    if (!url.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const r = await scout({ data: { url: url.trim() } });
      setResult(r);
    } catch (e: any) {
      toast.error(e?.message ?? "Scout failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="mt-10 rounded-2xl border border-[oklch(0.72_0.22_245/0.4)] bg-card p-6 sm:p-8">
      <header className="flex items-center gap-3 mb-5">
        <Telescope className="h-5 w-5" style={{ color: "var(--neon-blue-bright)" }} />
        <h2 className="font-[Montserrat] font-black text-xl text-white">Scout</h2>
        <span className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Firecrawl recon</span>
      </header>
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://news.site/article..."
            className="pl-9 h-11 bg-background"
          />
        </div>
        <Button
          onClick={run}
          disabled={loading || !url.trim()}
          className="btn-glass-blue text-white text-xs uppercase tracking-[0.25em] font-bold h-11 px-6"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Scan Target"}
        </Button>
      </div>
      {result && (
        <div className="mt-6 space-y-4">
          {result.title && (
            <div>
              <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Page Title</p>
              <p className="text-sm text-white mt-1">{result.title}</p>
            </div>
          )}
          {result.summary && (
            <div>
              <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Summary</p>
              <p className="text-sm text-foreground mt-1 leading-relaxed">{result.summary}</p>
            </div>
          )}
          {result.titles.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground mb-2">
                Themes / Headings ({result.titles.length})
              </p>
              <ul className="flex flex-wrap gap-2">
                {result.titles.map((t, i) => (
                  <li
                    key={i}
                    className="text-xs px-2.5 py-1 rounded-full bg-secondary/60 border border-border text-foreground"
                  >
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}