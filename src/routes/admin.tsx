import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Shield, Loader2, Save, Telescope, Link2, Wand2, Copy, ExternalLink, Music, Upload, Disc3, Wrench, Send, Sparkles, Rocket, Eye, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { scoutUrl } from "@/lib/firecrawl.functions";
import { spawnPortal } from "@/lib/portals.functions";
import { spawnMusicPortal } from "@/lib/music-portals.functions";
import { createTrack } from "@/lib/tracks.functions";
import { spawnTool } from "@/lib/tools.functions";
import { generateBrandBible, updateTelegramLinks, deployToTelegram } from "@/lib/telegram.functions";

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
      <LeadTrackingPanel />
      <SpawnerPanel />
      <MusicSpawnerPanel />
      <TrackUploadPanel />
      <ToolSpawnerPanel />
      <TelegramSocialsPanel />
    </main>
  );
}

function ToolSpawnerPanel() {
  const spawn = useServerFn(spawnTool);
  const [name, setName] = useState("");
  const [audience, setAudience] = useState<"kids" | "students" | "pro">("students");
  const [logic, setLogic] = useState("");
  const [vibe, setVibe] = useState("");
  const [vip, setVip] = useState(false);
  const [loading, setLoading] = useState(false);
  const [last, setLast] = useState<{ slug: string } | null>(null);

  const onSpawn = async () => {
    if (!name || !logic) return toast.error("Name and logic required");
    setLoading(true);
    try {
      const r = await spawn({ data: { name, audience, logic, vibe, vip } });
      toast.success(`Spawned "${r.tool.name}"`);
      setLast({ slug: r.slug });
      setName(""); setLogic(""); setVibe("");
    } catch (e: any) {
      toast.error(e?.message ?? "Spawn failed");
    } finally { setLoading(false); }
  };

  return (
    <section className="mt-10 rounded-2xl border border-border bg-card p-6">
      <div className="flex items-center gap-2 mb-2">
        <Wrench className="h-5 w-5" style={{ color: "var(--neon-blue-bright)" }} />
        <h2 className="font-[Montserrat] font-black text-xl text-white">ToolHUB Spawner</h2>
      </div>
      <p className="text-sm text-muted-foreground mb-4">AI agent designs the inputs, formula, and explanations from your description.</p>
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className="text-xs uppercase tracking-widest text-muted-foreground">Tool Name</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Kid Algebra Solver" />
        </div>
        <div>
          <label className="text-xs uppercase tracking-widest text-muted-foreground">Audience</label>
          <select
            value={audience}
            onChange={(e) => setAudience(e.target.value as any)}
            className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="kids">Kids</option>
            <option value="students">Students</option>
            <option value="pro">Professionals / Scientists</option>
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="text-xs uppercase tracking-widest text-muted-foreground">Tool Logic Description</label>
          <Input value={logic} onChange={(e) => setLogic(e.target.value)} placeholder="Step-by-step algebra solver for two-variable equations" />
        </div>
        <div className="sm:col-span-2">
          <label className="text-xs uppercase tracking-widest text-muted-foreground">Visual Vibe</label>
          <Input value={vibe} onChange={(e) => setVibe(e.target.value)} placeholder="Playful & Colorful, neon blue cartoon" />
        </div>
        <label className="flex items-center gap-2 text-sm text-white sm:col-span-2">
          <input type="checkbox" checked={vip} onChange={(e) => setVip(e.target.checked)} />
          VIP-only tool (Syndicate members)
        </label>
      </div>
      <Button onClick={onSpawn} disabled={loading} className="mt-4 w-full">
        {loading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Agent designing...</> : <><Wand2 className="h-4 w-4 mr-2" />Spawn Tool</>}
      </Button>
      {last && (
        <p className="mt-3 text-sm text-muted-foreground">
          Live at{" "}
          <a href={`/t/${last.slug}`} target="_blank" rel="noreferrer" className="underline text-white inline-flex items-center gap-1">
            /t/{last.slug} <ExternalLink className="h-3 w-3" />
          </a>
        </p>
      )}
    </section>
  );
}

function SpawnerPanel() {
  const spawn = useServerFn(spawnPortal);
  const genBrand = useServerFn(generateBrandBible);
  const [name, setName] = useState("");
  const [niche, setNiche] = useState("");
  const [language, setLanguage] = useState("English");
  const [vibe, setVibe] = useState("");
  const [vip, setVip] = useState(false);
  const [useScout, setUseScout] = useState(true);
  const [initTelegram, setInitTelegram] = useState(false);
  const [loading, setLoading] = useState(false);
  const [created, setCreated] = useState<{ slug: string; name: string; theme: string; vip?: boolean } | null>(null);

  const run = async () => {
    if (!name.trim() || !niche.trim()) {
      toast.error("Name and niche required");
      return;
    }
    setLoading(true);
    setCreated(null);
    try {
      const r = await spawn({ data: { name: name.trim(), niche: niche.trim(), language: language.trim() || "English", vibe: vibe.trim(), vip, useScout } });
      setCreated(r.portal);
      toast.success(`Spawned "${r.portal.name}" with ${r.jokeCount} jokes`);
      if (initTelegram) {
        try {
          toast.message("Generating Telegram Brand Bible…");
          await genBrand({ data: { slug: r.portal.slug } });
          toast.success("Brand Bible generated · scroll to Telegram Socials");
        } catch (e: any) {
          toast.error(`Brand Bible failed: ${e?.message ?? "unknown"}`);
        }
      }
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
        <div className="sm:col-span-2 flex flex-wrap gap-4 pt-1">
          <label className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.25em] text-muted-foreground cursor-pointer">
            <input type="checkbox" checked={useScout} onChange={(e) => setUseScout(e.target.checked)} className="h-4 w-4" />
            Firecrawl Scout (latest news)
          </label>
          <label className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.25em] text-muted-foreground cursor-pointer">
            <input type="checkbox" checked={vip} onChange={(e) => setVip(e.target.checked)} className="h-4 w-4" />
            VIP Portal ($5 unlock)
          </label>
          <label className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.25em] cursor-pointer" style={{ color: "var(--neon-blue-bright)" }}>
            <input type="checkbox" checked={initTelegram} onChange={(e) => setInitTelegram(e.target.checked)} className="h-4 w-4" />
            <Send className="h-3.5 w-3.5" /> Initialize Telegram Socials
          </label>
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

type TGPortal = {
  id: string;
  slug: string;
  name: string;
  niche: string;
  telegram_config: {
    enabled?: boolean;
    deployed?: boolean;
    botUsername?: string | null;
    groupLink?: string | null;
    vipLink?: string | null;
    brand?: {
      brandName?: string;
      voice?: string;
      bio?: string;
      shortBio?: string;
      logoEmoji?: string;
      marketingPlan?: string;
      starterMessages?: string[];
    };
  } | null;
};

function TelegramSocialsPanel() {
  const genBrand = useServerFn(generateBrandBible);
  const updateLinks = useServerFn(updateTelegramLinks);
  const deploy = useServerFn(deployToTelegram);
  const [portals, setPortals] = useState<TGPortal[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    supabase
      .from("portals")
      .select("id, slug, name, niche, telegram_config")
      .order("created_at", { ascending: false })
      .limit(50)
      .then(({ data }) => setPortals((data as any[]) ?? []));
  }, [reloadKey]);

  const reload = () => setReloadKey((k) => k + 1);

  return (
    <section className="mt-10 rounded-2xl border bg-card p-6 sm:p-8" style={{ borderColor: "oklch(0.72 0.22 245 / 0.5)", boxShadow: "0 0 60px oklch(0.72 0.22 245 / 0.15)" }}>
      <header className="flex items-center gap-3 mb-5">
        <Send className="h-5 w-5" style={{ color: "var(--neon-blue-bright)" }} />
        <h2 className="font-[Montserrat] font-black text-xl text-white">Telegram Socials</h2>
        <span className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Brand Bible · Deploy · Links</span>
      </header>

      {portals.length === 0 && (
        <p className="text-sm text-muted-foreground">No portals yet. Spawn one above.</p>
      )}

      <div className="space-y-4">
        {portals.map((p) => {
          const cfg = p.telegram_config ?? {};
          const brand = cfg.brand;
          const id = p.id;
          return (
            <div key={id} className="rounded-xl border border-border bg-background/60 p-4">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-lg">{brand?.logoEmoji ?? "🛰"}</span>
                <h3 className="font-bold text-white">{brand?.brandName || p.name}</h3>
                <code className="text-[10px] text-muted-foreground">/p/{p.slug}</code>
                {cfg.deployed && (
                  <span className="text-[9px] uppercase tracking-[0.3em] px-2 py-0.5 rounded-full" style={{ color: "var(--neon-blue-bright)", border: "1px solid currentColor" }}>
                    Deployed
                  </span>
                )}
              </div>

              {brand ? (
                <div className="mt-3 grid sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Voice</p>
                    <p className="text-foreground/90 mt-1">{brand.voice}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Bio</p>
                    <p className="text-foreground/90 mt-1">{brand.bio}</p>
                  </div>
                  {brand.marketingPlan && (
                    <div className="sm:col-span-2">
                      <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Marketing Plan</p>
                      <pre className="text-foreground/80 whitespace-pre-wrap mt-1 text-[11px]">{brand.marketingPlan}</pre>
                    </div>
                  )}
                  {brand.starterMessages && brand.starterMessages.length > 0 && (
                    <div className="sm:col-span-2">
                      <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground mb-1">Starter Messages</p>
                      <ul className="space-y-1">
                        {brand.starterMessages.slice(0, 5).map((m, i) => (
                          <li key={i} className="rounded bg-black/40 border border-border px-2 py-1.5 flex items-start justify-between gap-2">
                            <span className="flex-1">{m}</span>
                            <button onClick={() => { navigator.clipboard?.writeText(m); toast.success("Copied"); }} className="opacity-60 hover:opacity-100">
                              <Copy className="h-3 w-3" />
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ) : (
                <p className="mt-2 text-xs text-muted-foreground">No brand bible yet.</p>
              )}

              <LinksEditor
                slug={p.slug}
                initial={{ groupLink: cfg.groupLink ?? "", vipLink: cfg.vipLink ?? "", botUsername: cfg.botUsername ?? "" }}
                onSave={async (vals) => {
                  setBusy(id);
                  try { await updateLinks({ data: { slug: p.slug, ...vals } }); toast.success("Links saved"); reload(); }
                  catch (e: any) { toast.error(e?.message ?? "Save failed"); }
                  finally { setBusy(null); }
                }}
                disabled={busy === id}
              />

              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy === id}
                  onClick={async () => {
                    setBusy(id);
                    try { await genBrand({ data: { slug: p.slug } }); toast.success("Brand bible generated"); reload(); }
                    catch (e: any) { toast.error(e?.message ?? "Failed"); }
                    finally { setBusy(null); }
                  }}
                >
                  <Sparkles className="h-3.5 w-3.5 mr-1" />
                  {brand ? "Regenerate Bible" : "Generate Brand Bible"}
                </Button>
                <Button
                  size="sm"
                  className="btn-glass-blue text-white"
                  disabled={busy === id || !brand}
                  onClick={async () => {
                    setBusy(id);
                    try {
                      const r = await deploy({ data: { slug: p.slug } });
                      toast.success(`Deployed to @${r.botUsername ?? "bot"}`);
                      reload();
                    } catch (e: any) { toast.error(e?.message ?? "Deploy failed"); }
                    finally { setBusy(null); }
                  }}
                >
                  <Rocket className="h-3.5 w-3.5 mr-1" />
                  Deploy to Telegram
                </Button>
                {cfg.botUsername && (
                  <a href={`https://t.me/${cfg.botUsername}`} target="_blank" rel="noreferrer" className="text-xs underline inline-flex items-center">
                    <ExternalLink className="h-3 w-3 mr-1" />@{cfg.botUsername}
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function LinksEditor({ slug: _slug, initial, onSave, disabled }: { slug: string; initial: { groupLink: string; vipLink: string; botUsername: string }; onSave: (v: { groupLink: string; vipLink: string; botUsername: string }) => Promise<void>; disabled?: boolean }) {
  const [g, setG] = useState(initial.groupLink);
  const [v, setV] = useState(initial.vipLink);
  const [b, setB] = useState(initial.botUsername);
  return (
    <div className="mt-3 grid sm:grid-cols-3 gap-2">
      <Input value={g} onChange={(e) => setG(e.target.value)} placeholder="https://t.me/joinchat/…" className="h-9 bg-background text-xs" />
      <Input value={v} onChange={(e) => setV(e.target.value)} placeholder="https://t.me/+vip…" className="h-9 bg-background text-xs" />
      <div className="flex gap-2">
        <Input value={b} onChange={(e) => setB(e.target.value)} placeholder="bot username" className="h-9 bg-background text-xs flex-1" />
        <Button size="sm" variant="ghost" disabled={disabled} onClick={() => onSave({ groupLink: g, vipLink: v, botUsername: b })}>
          <Save className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

function TrackUploadPanel() {
  const create = useServerFn(createTrack);
  const [portals, setPortals] = useState<{ slug: string; name: string }[]>([]);
  const [slug, setSlug] = useState("");
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("200");
  const [previewFile, setPreviewFile] = useState<File | null>(null);
  const [fullFile, setFullFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<{ id: string; title: string; suno_prompt: string } | null>(null);

  useEffect(() => {
    supabase.from("portals").select("slug, name").eq("kind", "music").order("created_at", { ascending: false })
      .then(({ data }) => setPortals((data as any[]) ?? []));
  }, []);

  const upload = async () => {
    if (!slug || !title.trim() || !previewFile || !fullFile) {
      toast.error("Pick a portal, title, and both audio files");
      return;
    }
    setBusy(true);
    setCreated(null);
    try {
      const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const previewPath = `${slug}/${stamp}/preview.mp3`;
      const fullPath = `${slug}/${stamp}/full.mp3`;
      const u1 = await supabase.storage.from("tracks").upload(previewPath, previewFile, { contentType: previewFile.type || "audio/mpeg", upsert: false });
      if (u1.error) throw new Error(`Preview upload: ${u1.error.message}`);
      const u2 = await supabase.storage.from("tracks").upload(fullPath, fullFile, { contentType: fullFile.type || "audio/mpeg", upsert: false });
      if (u2.error) throw new Error(`Full upload: ${u2.error.message}`);

      const r = await create({ data: {
        portal_slug: slug, title: title.trim(),
        preview_path: previewPath, full_path: fullPath,
        price_cents: Math.max(50, parseInt(price, 10) || 200),
      } });
      setCreated(r.track);
      toast.success("Track published");
      setTitle(""); setPreviewFile(null); setFullFile(null);
    } catch (e: any) {
      toast.error(e?.message ?? "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mt-10 rounded-2xl border border-[oklch(0.72_0.22_245/0.4)] bg-card p-6 sm:p-8">
      <header className="flex items-center gap-3 mb-5">
        <Disc3 className="h-5 w-5" style={{ color: "var(--neon-blue-bright)" }} />
        <h2 className="font-[Montserrat] font-black text-xl text-white">Track Vault</h2>
        <span className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Preview &amp; sell</span>
      </header>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Music Portal</label>
          <select value={slug} onChange={(e) => setSlug(e.target.value)} className="mt-1 h-11 w-full bg-background border border-border rounded-md px-2 text-sm">
            <option value="">— select —</option>
            {portals.map((p) => <option key={p.slug} value={p.slug}>{p.name} (/m/{p.slug})</option>)}
          </select>
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Track Title</label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Midnight Nasheed" className="mt-1 h-11 bg-background" />
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Price (cents)</label>
          <Input type="number" value={price} onChange={(e) => setPrice(e.target.value)} className="mt-1 h-11 bg-background" />
        </div>
        <div />
        <div>
          <label className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Preview MP3 (≈30s)</label>
          <Input type="file" accept="audio/*" onChange={(e) => setPreviewFile(e.target.files?.[0] ?? null)} className="mt-1 h-11 bg-background text-xs" />
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Full HQ MP3</label>
          <Input type="file" accept="audio/*" onChange={(e) => setFullFile(e.target.files?.[0] ?? null)} className="mt-1 h-11 bg-background text-xs" />
        </div>
      </div>
      <Button onClick={upload} disabled={busy} className="btn-glass-blue text-white text-xs uppercase tracking-[0.25em] font-bold h-12 px-8 mt-5">
        {busy ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Uploading...</> : <><Upload className="h-4 w-4 mr-2" />Publish Track</>}
      </Button>

      {created && (
        <div className="mt-6 p-4 rounded-xl border border-border bg-background/60">
          <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Suno V5 Style Prompt</p>
          <pre className="text-xs whitespace-pre-wrap bg-black/40 border border-border rounded-md p-3 mt-2 max-h-64 overflow-auto">{created.suno_prompt}</pre>
          <Button size="sm" variant="ghost" className="mt-2" onClick={() => { navigator.clipboard?.writeText(created.suno_prompt); toast.success("Prompt copied"); }}>
            <Copy className="h-3.5 w-3.5 mr-1" />Copy for Suno
          </Button>
        </div>
      )}
    </section>
  );
}

function MusicSpawnerPanel() {
  const spawn = useServerFn(spawnMusicPortal);
  const [slug, setSlug] = useState("");
  const [language, setLanguage] = useState("English");
  const [style, setStyle] = useState("");
  const [vibe, setVibe] = useState("");
  const [loading, setLoading] = useState(false);
  const [created, setCreated] = useState<{ slug: string; name: string; theme: string } | null>(null);

  const run = async () => {
    if (!slug.trim() || !style.trim()) {
      toast.error("Slug and style required");
      return;
    }
    setLoading(true);
    setCreated(null);
    try {
      const r = await spawn({ data: { slug: slug.trim(), language: language.trim() || "English", style: style.trim(), vibe: vibe.trim() } });
      setCreated(r.portal);
      toast.success(`Music portal "${r.portal.name}" spawned`);
      setSlug(""); setStyle(""); setVibe("");
    } catch (e: any) {
      toast.error(e?.message ?? "Spawn failed");
    } finally {
      setLoading(false);
    }
  };

  const url = created ? `${typeof window !== "undefined" ? window.location.origin : ""}/m/${created.slug}` : "";

  return (
    <section className="mt-10 rounded-2xl border border-[oklch(0.72_0.22_245/0.4)] bg-card p-6 sm:p-8">
      <header className="flex items-center gap-3 mb-5">
        <Music className="h-5 w-5" style={{ color: "var(--neon-blue-bright)" }} />
        <h2 className="font-[Montserrat] font-black text-xl text-white">Music Portal Spawner</h2>
        <span className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">0G-Studio factory</span>
      </header>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Portal Slug</label>
          <Input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="urdu-nasheeds" className="mt-1 h-11 bg-background" />
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Language</label>
          <Input value={language} onChange={(e) => setLanguage(e.target.value)} placeholder="Urdu / English / Spanish" className="mt-1 h-11 bg-background" />
        </div>
        <div className="sm:col-span-2">
          <label className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Style / Genre</label>
          <Input value={style} onChange={(e) => setStyle(e.target.value)} placeholder="Nasheed / Spiritual" className="mt-1 h-11 bg-background" />
        </div>
        <div className="sm:col-span-2">
          <label className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Background Vibe</label>
          <Input value={vibe} onChange={(e) => setVibe(e.target.value)} placeholder="Blue Mosque at night, neon blue accents" className="mt-1 h-11 bg-background" />
        </div>
      </div>
      <Button
        onClick={run}
        disabled={loading}
        className="btn-glass-blue text-white text-xs uppercase tracking-[0.25em] font-bold h-12 px-8 mt-5"
      >
        {loading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Spawning...</> : <><Music className="h-4 w-4 mr-2" />Spawn Music Portal</>}
      </Button>

      {created && (
        <div className="mt-6 p-4 rounded-xl border border-border bg-background/60">
          <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Live Music Portal</p>
          <div className="mt-2 flex items-center gap-2 flex-wrap">
            <code className="text-sm text-white font-mono">/m/{created.slug}</code>
            <span className="text-xs px-2 py-0.5 rounded-full bg-secondary border border-border">{created.theme}</span>
            <Button size="sm" variant="ghost" onClick={() => { navigator.clipboard?.writeText(url); toast.success("URL copied"); }}>
              <Copy className="h-3.5 w-3.5 mr-1" />Copy
            </Button>
            <a href={`/m/${created.slug}`} target="_blank" rel="noreferrer" className="inline-flex items-center text-xs underline">
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

function LeadTrackingPanel() {
  const [rows, setRows] = useState<{ slug: string; name: string; niche: string; view_count: number; vip: boolean; created_at: string }[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = () => {
    setLoading(true);
    supabase
      .from("portals")
      .select("slug, name, niche, view_count, vip, created_at")
      .order("view_count", { ascending: false })
      .limit(50)
      .then(({ data }) => { setRows((data as any[]) ?? []); setLoading(false); });
  };

  useEffect(() => { reload(); }, []);

  const total = rows.reduce((s, r) => s + (r.view_count || 0), 0);

  return (
    <section className="mt-10 rounded-2xl border border-[oklch(0.72_0.22_245/0.4)] bg-card p-6 sm:p-8">
      <header className="flex items-center gap-3 mb-5 flex-wrap">
        <TrendingUp className="h-5 w-5" style={{ color: "var(--neon-blue-bright)" }} />
        <h2 className="font-[Montserrat] font-black text-xl text-white">Lead Tracking</h2>
        <span className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Portal Visits · Hot Leads</span>
        <span className="ml-auto text-[10px] uppercase tracking-[0.3em] text-foreground/80">
          Total Opens: <span className="text-white font-bold">{total}</span>
        </span>
        <Button size="sm" variant="ghost" onClick={reload} className="text-[10px]">Refresh</Button>
      </header>
      {loading ? (
        <div className="text-center py-6"><Loader2 className="h-4 w-4 animate-spin inline" /></div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No portals yet.</p>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <div className="grid grid-cols-12 gap-2 px-4 py-2 text-[10px] uppercase tracking-[0.3em] text-muted-foreground border-b border-border bg-background/40">
            <div className="col-span-5">Portal</div>
            <div className="col-span-4">Niche</div>
            <div className="col-span-2 text-right">Opens</div>
            <div className="col-span-1 text-right">Link</div>
          </div>
          {rows.map((r) => {
            const url = typeof window !== "undefined" ? `${window.location.origin}/p/${r.slug}` : `/p/${r.slug}`;
            const heat = r.view_count >= 50 ? "text-red-400" : r.view_count >= 10 ? "text-yellow-400" : "text-foreground/70";
            return (
              <div key={r.slug} className="grid grid-cols-12 gap-2 px-4 py-2.5 text-xs items-center border-b border-border last:border-0 hover:bg-background/40">
                <div className="col-span-5 truncate">
                  <span className="text-white font-bold">{r.name}</span>
                  {r.vip && <span className="ml-2 text-[9px] uppercase tracking-[0.3em] px-1.5 py-0.5 rounded border" style={{ color: "var(--neon-blue-bright)", borderColor: "currentColor" }}>VIP</span>}
                  <div className="text-[10px] text-muted-foreground font-mono">/p/{r.slug}</div>
                </div>
                <div className="col-span-4 truncate text-muted-foreground">{r.niche}</div>
                <div className={`col-span-2 text-right font-mono font-bold ${heat}`}>
                  <Eye className="inline h-3 w-3 mr-1" />{r.view_count}
                </div>
                <div className="col-span-1 text-right">
                  <button
                    onClick={() => { navigator.clipboard?.writeText(url); toast.success("Client link copied"); }}
                    className="opacity-60 hover:opacity-100"
                    title="Copy client link"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
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