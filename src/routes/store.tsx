import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Coins, Zap, Flame, Skull, ArrowLeft, Music, Pencil, Plus, Trash2, Save, X, Loader2, Settings2, Crown, Radio, Package, Image as ImageIcon, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/hooks/use-auth";
import { useStripeCheckout } from "@/hooks/useStripeCheckout";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

import { requireMember } from "@/lib/route-guards";
type Search = { reason?: "empty" | "topup" };
type Pack = {
  id: string;
  price_id: string;
  name: string;
  tagline: string;
  amount_cents: number;
  credits: number | null;
  recurring: boolean;
  active: boolean;
  sort_order: number;
};

type CatalogKind = "vip_pass" | "streams_pass" | "digital" | "nft";
type CatalogPreview = {
  id: string;
  kind: CatalogKind;
  title: string;
  image_url: string | null;
  price_cents: number;
  currency: string;
};
const CATALOG_KINDS: CatalogKind[] = ["vip_pass", "streams_pass", "digital", "nft"];
const CATALOG_META: Record<CatalogKind, { label: string; icon: any; blurb: string }> = {
  vip_pass:     { label: "VIP Passes",     icon: Crown,     blurb: "Priority queues, deep tools, all hubs" },
  streams_pass: { label: "Streams Passes", icon: Radio,     blurb: "Live streams + boss frequency" },
  digital:      { label: "Digital Drops",  icon: Package,   blurb: "Packs, presets, lyric kits" },
  nft:          { label: "NFT",            icon: ImageIcon, blurb: "Collectible syndicate mints" },
};

export const Route = createFileRoute("/store")({
  beforeLoad: requireMember,
  validateSearch: (s: Record<string, unknown>): Search => ({
    reason: s.reason === "empty" || s.reason === "topup" ? (s.reason as "empty" | "topup") : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Syndicate Store · 0G-PORTAL" },
      { name: "description", content: "Top up your 0G Credits and unlock the full Syndicate." },
    ],
  }),
  component: StorePage,
});

function StorePage() {
  const { reason } = Route.useSearch();
  const { user, profile, loading } = useAuth();
  const navigate = useNavigate();
  const { openCheckout, closeCheckout, isOpen, checkoutElement } = useStripeCheckout();
  const [packs, setPacks] = useState<Pack[]>([]);
  const [creditsPerSong, setCreditsPerSong] = useState(5);
  const [loadingPacks, setLoadingPacks] = useState(true);
  const [catalog, setCatalog] = useState<CatalogPreview[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(true);

  const isBoss = profile?.rank === "boss";

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [loading, user, navigate]);

  useEffect(() => {
    if (reason === "empty") toast.error("0 credits left — top up to keep firing.", { duration: 5000 });
  }, [reason]);

  const loadAll = async () => {
    setLoadingPacks(true);
    const packsQuery = supabase.from("store_packs").select("*").order("sort_order").order("amount_cents");
    const filteredQuery = isBoss ? packsQuery : packsQuery.eq("active", true);
    const [p, s] = await Promise.all([
      filteredQuery,
      supabase.from("store_settings").select("credits_per_song").eq("id", 1).maybeSingle(),
    ]);
    if (p.error) toast.error(p.error.message);
    else setPacks((p.data ?? []) as any);
    if (s.data?.credits_per_song) setCreditsPerSong(s.data.credits_per_song);
    setLoadingPacks(false);
  };
  useEffect(() => { if (user) loadAll(); /* eslint-disable-next-line */ }, [user, isBoss]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    setLoadingCatalog(true);
    supabase
      .from("store_products")
      .select("id,kind,title,image_url,price_cents,currency,active,sort_order")
      .eq("active", true)
      .order("sort_order", { ascending: true })
      .order("price_cents", { ascending: true })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (!error && data) setCatalog(data as CatalogPreview[]);
        setLoadingCatalog(false);
      });
    return () => { cancelled = true; };
  }, [user]);

  if (loading || !user) {
    return <main className="px-5 py-20 text-center text-muted-foreground">Loading store…</main>;
  }

  const credits = profile?.credits ?? 0;
  const isVip = profile?.status === "vip";
  const songs = creditsPerSong > 0 ? Math.floor(credits / creditsPerSong) : 0;
  const pct = Math.max(2, Math.min(100, (credits / 100) * 100));

  const buy = (priceId: string) => {
    openCheckout({
      priceId,
      customerEmail: user.email ?? undefined,
      userId: user.id,
      returnUrl: `${window.location.origin}/checkout/return?session_id={CHECKOUT_SESSION_ID}`,
    });
  };

  return (
    <main className="relative max-w-5xl mx-auto px-5 sm:px-8 py-12 sm:py-16">
      <Link to="/profile" className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.3em] font-bold text-muted-foreground hover:text-white">
        <ArrowLeft className="h-4 w-4" /> Vault
      </Link>
      <Link
        to="/store/catalog"
        className="ml-3 inline-flex items-center gap-2 rounded-full border border-[oklch(0.72_0.22_245/0.5)] bg-[oklch(0.72_0.22_245/0.1)] px-3 py-1.5 text-[10px] uppercase tracking-[0.3em] font-bold text-white hover:border-[oklch(0.72_0.22_245/0.9)]"
      >
        Vault catalog →
      </Link>

      <header className="text-center mt-6 mb-10">
        <p className="text-xs uppercase tracking-[0.4em] font-semibold" style={{ color: "var(--neon-blue-bright)" }}>
          {isBoss ? "Store · Boss Editor" : "Credits · Your In-House Currency"}
        </p>
        <h1 className="mt-3 font-[Montserrat] font-black text-4xl sm:text-6xl text-metallic">
          {isBoss ? "Curate the Vault" : "Buy Credits — Power Everything"}
        </h1>
        {isBoss ? (
          <p className="mt-3 text-muted-foreground">Add, edit, hide or remove credit packages. Set how many credits a song costs.</p>
        ) : (
          <>
            <p className="mt-3 text-muted-foreground max-w-2xl mx-auto">
              Credits are the syndicate's in-house currency. Spend them on AI tracks, lyrics, jokes,
              trade scans, and pro tools. Or skip the math and go <strong className="text-white">VIP monthly</strong> for
              priority queues and free Hit-Button.
            </p>
            <p className="mt-2 text-xs uppercase tracking-[0.3em] text-muted-foreground">
              <span className="text-[color:var(--neon-blue-bright)] font-bold">{creditsPerSong} credits</span> = 1 full AI song
              <span className="mx-2 opacity-50">·</span>
              <span className="text-[color:var(--neon-blue-bright)] font-bold">1 credit</span> = 1 joke / scan / tool run
            </p>
          </>
        )}
      </header>

      {/* Boss never sees their own balance — they are unlimited */}
      {!isBoss && (
        <section className="rounded-2xl electric-border bg-card p-6 sm:p-8 mb-10 tv-screen">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <Music className="h-5 w-5" style={{ color: "var(--neon-blue-bright)" }} />
              <div>
                <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Songs Available</p>
                <p className="font-[Montserrat] font-black text-3xl sm:text-4xl text-metallic mt-1 tabular-nums">
                  {songs} <span className="text-base font-normal text-muted-foreground">songs</span>
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {credits} credits · {creditsPerSong} per song
                </p>
              </div>
            </div>
            {isVip && (
              <span className="text-[10px] font-black uppercase tracking-[0.3em] px-3 py-1 rounded-full bg-[var(--neon-blue-bright)] text-black">
                VIP ACTIVE
              </span>
            )}
          </div>
          <div className="mt-4 h-2 w-full rounded-full bg-secondary/60 overflow-hidden border border-[oklch(0.72_0.22_245/0.3)]">
            <div className="h-full bg-gradient-to-r from-[oklch(0.55_0.24_255)] via-[var(--neon-blue-bright)] to-[oklch(0.85_0.18_235)] shadow-[0_0_18px_oklch(0.72_0.22_245/0.9)] transition-all" style={{ width: `${pct}%` }} />
          </div>
        </section>
      )}

      {isBoss && <BossSettingsBar creditsPerSong={creditsPerSong} onSaved={(v) => setCreditsPerSong(v)} />}

      {/* Shop the Vault — item previews per catalog kind */}
      {!isBoss && (
        <section className="mb-10">
          <div className="flex items-end justify-between gap-3 mb-4 flex-wrap">
            <div>
              <p className="text-[10px] uppercase tracking-[0.4em] font-bold" style={{ color: "var(--neon-blue-bright)" }}>
                Shop the Vault
              </p>
              <h2 className="mt-1 font-[Montserrat] font-black text-2xl sm:text-3xl text-metallic">Items & Passes</h2>
              <p className="text-xs text-muted-foreground mt-1">Spend cash directly on passes and drops — no credits needed.</p>
            </div>
            <Link
              to="/store/catalog"
              className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.3em] font-bold text-white hover:text-[color:var(--neon-blue-bright)]"
            >
              See full catalog <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          {loadingCatalog ? (
            <p className="text-center py-6 text-muted-foreground text-xs"><Loader2 className="h-4 w-4 inline animate-spin mr-2" />Loading items…</p>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {CATALOG_KINDS.map((kind) => {
                const items = catalog.filter((p) => p.kind === kind);
                const meta = CATALOG_META[kind];
                const Icon = meta.icon;
                const featured = items[0];
                const fromPrice = items.length
                  ? Math.min(...items.map((i) => i.price_cents))
                  : null;
                return (
                  <Link
                    key={kind}
                    to="/store/catalog"
                    search={{ tab: kind }}
                    className="group relative rounded-2xl border border-border bg-card p-4 hover:border-[oklch(0.72_0.22_245/0.7)] hover:shadow-[0_0_30px_oklch(0.72_0.22_245/0.25)] transition flex flex-col min-h-[220px]"
                  >
                    <div className="relative aspect-[4/3] rounded-lg overflow-hidden bg-secondary/50 border border-border mb-3">
                      {featured?.image_url ? (
                        <img
                          src={featured.image_url}
                          alt={featured.title}
                          loading="lazy"
                          className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition"
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Icon className="h-10 w-10 text-muted-foreground/40" />
                        </div>
                      )}
                      <span className="absolute top-2 left-2 inline-flex items-center gap-1 text-[9px] uppercase tracking-[0.25em] font-black px-2 py-0.5 rounded-full bg-background/80 backdrop-blur text-white border border-border">
                        <Icon className="h-2.5 w-2.5" /> {meta.label}
                      </span>
                      <span className="absolute top-2 right-2 text-[9px] font-black px-2 py-0.5 rounded-full bg-[var(--neon-blue-bright)] text-black">
                        {items.length}
                      </span>
                    </div>
                    <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">{meta.blurb}</p>
                    <p className="mt-1 text-sm font-bold text-white line-clamp-2 min-h-[2.5rem]">
                      {featured?.title ?? "Coming soon"}
                    </p>
                    <div className="mt-auto pt-2 flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">
                        {fromPrice !== null ? (
                          <>from <span className="text-white font-bold">£{(fromPrice / 100).toFixed(2)}</span></>
                        ) : (
                          "—"
                        )}
                      </span>
                      <span className="text-[10px] uppercase tracking-[0.3em] font-bold text-[color:var(--neon-blue-bright)] inline-flex items-center gap-1">
                        Browse <ArrowRight className="h-3 w-3" />
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      )}

      {loadingPacks ? (
        <p className="text-center py-10 text-muted-foreground"><Loader2 className="h-5 w-5 inline animate-spin mr-2" />Loading packs…</p>
      ) : (
        <>
        {!isBoss && <PackCompareTable packs={packs} onBuy={(pid) => buy(pid)} />}
        <div className="grid sm:grid-cols-3 gap-5">
          {packs.map((p) => (
            <PackCard
              key={p.id}
              pack={p}
              isBoss={!!isBoss}
              creditsPerSong={creditsPerSong}
              onBuy={() => buy(p.price_id)}
              onChanged={loadAll}
            />
          ))}
          {isBoss && <NewPackCard onCreated={loadAll} />}
        </div>
        </>
      )}

      {isOpen && (
        <div className="fixed inset-0 z-50 bg-background/90 backdrop-blur overflow-y-auto">
          <div className="max-w-2xl mx-auto px-4 py-8">
            <button onClick={closeCheckout} className="text-xs uppercase tracking-[0.3em] font-bold text-muted-foreground hover:text-white mb-4">
              ← Back to Store
            </button>
            {checkoutElement}
          </div>
        </div>
      )}
    </main>
  );
}

function BossSettingsBar({ creditsPerSong, onSaved }: { creditsPerSong: number; onSaved: (v: number) => void }) {
  const [val, setVal] = useState(String(creditsPerSong));
  const [busy, setBusy] = useState(false);
  useEffect(() => setVal(String(creditsPerSong)), [creditsPerSong]);

  const save = async () => {
    const n = parseInt(val, 10);
    if (!Number.isFinite(n) || n < 1) return toast.error("Must be ≥ 1");
    setBusy(true);
    const { error } = await supabase.from("store_settings").update({ credits_per_song: n }).eq("id", 1);
    setBusy(false);
    if (error) return toast.error(error.message);
    onSaved(n);
    toast.success(`1 song = ${n} credits`);
  };

  return (
    <section className="rounded-2xl border border-pink-700/40 bg-card p-5 mb-8 flex items-center gap-3 flex-wrap">
      <Settings2 className="h-5 w-5 text-pink-400" />
      <div className="flex-1 min-w-[200px]">
        <p className="text-[10px] uppercase tracking-[0.3em] text-pink-400 font-bold">Credits per song</p>
        <p className="text-xs text-muted-foreground">How many credits each generated song costs the user.</p>
      </div>
      <Input value={val} onChange={(e) => setVal(e.target.value)} type="number" min="1" className="w-24 font-mono" />
      <Button onClick={save} disabled={busy} className="bg-pink-500 hover:bg-pink-400 text-black font-bold">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="h-4 w-4 mr-1" />Save</>}
      </Button>
    </section>
  );
}

function PackCard({ pack, isBoss, creditsPerSong, onBuy, onChanged }: {
  pack: Pack; isBoss: boolean; creditsPerSong: number; onBuy: () => void; onChanged: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const Icon = pack.price_id === "starter_pack_10" ? Zap : pack.price_id === "enforcer_pack_50" ? Flame : pack.recurring ? Skull : Coins;
  const featured = pack.recurring;
  const songs = pack.credits && creditsPerSong > 0 ? Math.floor(pack.credits / creditsPerSong) : null;

  if (isBoss && editing) {
    return <EditPackCard pack={pack} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); onChanged(); }} />;
  }

  return (
    <div className={`relative rounded-2xl p-6 bg-card tv-screen ${featured ? "electric-border" : "border border-border"} ${!pack.active ? "opacity-50" : ""}`}>
      {featured && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-[9px] font-black uppercase tracking-[0.3em] px-3 py-1 rounded-full bg-[var(--neon-blue-bright)] text-black">
          BOSS
        </span>
      )}
      {!pack.active && (
        <span className="absolute top-3 right-3 text-[9px] font-black uppercase tracking-[0.3em] px-2 py-0.5 rounded bg-rose-700 text-white">
          HIDDEN
        </span>
      )}
      <Icon className="h-6 w-6" style={{ color: "var(--neon-blue-bright)" }} />
      <h3 className="mt-4 font-[Montserrat] font-black text-xl text-white">{pack.name}</h3>
      {isBoss ? (
        <p className="mt-1 text-xs text-muted-foreground">{pack.tagline}</p>
      ) : pack.recurring ? (
        <div className="mt-1 text-xs text-muted-foreground space-y-2">
          <p className="text-white font-semibold">VIP monthly access</p>
          <ul className="space-y-1 leading-snug">
            <li>• Unlimited Hit-Button generations</li>
            <li>• Priority AI queue (skip the line)</li>
            <li>• Live Wire jokes — fresh daily drops</li>
            <li>• Deep tool mode + premium calculators</li>
            <li>• VIP-only portals & signal channels</li>
            <li>• No daily scan limits on TradeHUB</li>
          </ul>
          {pack.credits ? (
            <div className="rounded-md border border-[color:var(--neon-blue-bright)]/40 bg-[color:var(--neon-blue-bright)]/5 px-2.5 py-2 mt-2">
              <p className="text-[color:var(--neon-blue-bright)] font-bold">
                + {pack.credits.toLocaleString()} bonus credits every month
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                That's ~ {creditsPerSong > 0 ? Math.floor(pack.credits / creditsPerSong) : 0} full AI songs,
                or {pack.credits.toLocaleString()} jokes / trade scans / tool runs to spend however you want.
              </p>
            </div>
          ) : null}
        </div>
      ) : pack.credits !== null ? (
        <div className="mt-1 text-xs text-muted-foreground space-y-0.5">
          <p className="text-white font-bold">
            <Coins className="inline h-3.5 w-3.5 mr-1 text-yellow-400" />
            {pack.credits.toLocaleString()} Coins 🪙
          </p>
          <p>£1 per Coin · spend on portals, jokes, scans, tools or VIP pass</p>
          <p className="text-[10px] text-yellow-300/80 font-bold">
            £{(pack.amount_cents / 100).toFixed(0)} = {pack.credits.toLocaleString()} Coins 🪙
          </p>
        </div>
      ) : (
        <p className="mt-1 text-xs text-muted-foreground">{pack.tagline}</p>
      )}
      <p className="mt-4 font-[Montserrat] font-black text-3xl text-metallic">
        £{(pack.amount_cents / 100).toFixed(2)}
        {pack.recurring && <span className="text-sm text-muted-foreground font-normal">/mo</span>}
      </p>

      {isBoss ? (
        <BossPackControls pack={pack} onEdit={() => setEditing(true)} onChanged={onChanged} />
      ) : (
        <Button onClick={onBuy} className="btn-glass-blue mt-5 w-full text-white text-xs uppercase tracking-[0.25em] font-bold py-5">
          {pack.recurring ? "Go VIP Monthly" : "Buy Credits"}
        </Button>
      )}
    </div>
  );
}

function BossPackControls({ pack, onEdit, onChanged }: { pack: Pack; onEdit: () => void; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);

  const toggleActive = async () => {
    setBusy(true);
    const { error } = await supabase.from("store_packs").update({ active: !pack.active }).eq("id", pack.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(`${pack.name} ${!pack.active ? "shown" : "hidden"}`);
    onChanged();
  };
  const remove = async () => {
    if (!confirm(`Remove "${pack.name}" from the store?`)) return;
    setBusy(true);
    const { error } = await supabase.from("store_packs").delete().eq("id", pack.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Pack removed");
    onChanged();
  };

  return (
    <div className="mt-5 space-y-2">
      <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground">{pack.active ? "Visible" : "Hidden"}</span>
        <Switch checked={pack.active} onCheckedChange={toggleActive} disabled={busy} className="data-[state=checked]:bg-emerald-500" />
      </div>
      <div className="flex gap-2">
        <Button onClick={onEdit} variant="outline" size="sm" className="flex-1"><Pencil className="h-3 w-3 mr-1" />Edit</Button>
        <Button onClick={remove} disabled={busy} variant="outline" size="sm" className="text-rose-400 border-rose-800 hover:bg-rose-900/20">
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}

function EditPackCard({ pack, onClose, onSaved }: { pack: Pack; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(pack.name);
  const [tagline, setTagline] = useState(pack.tagline);
  const [amount, setAmount] = useState(String((pack.amount_cents / 100).toFixed(2)));
  const [credits, setCredits] = useState(pack.credits === null ? "" : String(pack.credits));
  const [recurring, setRecurring] = useState(pack.recurring);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    const { error } = await supabase.from("store_packs").update({
      name: name.trim(),
      tagline: tagline.trim(),
      amount_cents: Math.round(parseFloat(amount) * 100),
      credits: credits === "" ? null : parseInt(credits, 10),
      recurring,
    }).eq("id", pack.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Pack updated");
    onSaved();
  };

  return (
    <div className="rounded-2xl border border-pink-700/50 bg-card p-5 space-y-2">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] uppercase tracking-[0.3em] text-pink-400 font-bold">Editing · {pack.price_id}</p>
        <button onClick={onClose}><X className="h-4 w-4 text-muted-foreground" /></button>
      </div>
      <Field label="Name"><Input value={name} onChange={(e) => setName(e.target.value)} /></Field>
      <Field label="Tagline"><Input value={tagline} onChange={(e) => setTagline(e.target.value)} /></Field>
      <Field label="Price (GBP)"><Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
      <Field label="Credits granted (blank = subscription)">
        <Input type="number" value={credits} onChange={(e) => setCredits(e.target.value)} />
      </Field>
      <label className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-xs">
        <span className="uppercase tracking-widest text-muted-foreground">Recurring (subscription)</span>
        <Switch checked={recurring} onCheckedChange={setRecurring} />
      </label>
      <Button onClick={save} disabled={busy} className="w-full bg-pink-500 hover:bg-pink-400 text-black font-bold">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="h-4 w-4 mr-1" />Save</>}
      </Button>
      <p className="text-[10px] text-muted-foreground">
        Note: price_id stays linked to its Stripe price. Editing credits/amount changes display & grant settings only.
      </p>
    </div>
  );
}

function NewPackCard({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [priceId, setPriceId] = useState("");
  const [name, setName] = useState("");
  const [tagline, setTagline] = useState("");
  const [amount, setAmount] = useState("9.99");
  const [credits, setCredits] = useState("25");
  const [recurring, setRecurring] = useState(false);
  const [busy, setBusy] = useState(false);

  const create = async () => {
    if (!priceId.trim() || !name.trim()) return toast.error("price_id and name required");
    setBusy(true);
    const { error } = await supabase.from("store_packs").insert({
      price_id: priceId.trim(),
      name: name.trim(),
      tagline: tagline.trim(),
      amount_cents: Math.round(parseFloat(amount) * 100),
      credits: credits === "" ? null : parseInt(credits, 10),
      recurring,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Pack added");
    setOpen(false);
    setPriceId(""); setName(""); setTagline("");
    onCreated();
  };

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="rounded-2xl border-2 border-dashed border-border bg-card/30 p-6 hover:border-pink-500/60 transition flex flex-col items-center justify-center min-h-[260px] text-muted-foreground hover:text-pink-300">
        <Plus className="h-8 w-8 mb-2" />
        <span className="text-sm uppercase tracking-widest font-bold">Add Pack</span>
      </button>
    );
  }

  return (
    <div className="rounded-2xl border border-pink-700/50 bg-card p-5 space-y-2">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] uppercase tracking-[0.3em] text-pink-400 font-bold">New Pack</p>
        <button onClick={() => setOpen(false)}><X className="h-4 w-4 text-muted-foreground" /></button>
      </div>
      <Field label="Stripe price_id"><Input value={priceId} onChange={(e) => setPriceId(e.target.value)} placeholder="mega_pack_200" /></Field>
      <Field label="Name"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Mega Pack" /></Field>
      <Field label="Tagline"><Input value={tagline} onChange={(e) => setTagline(e.target.value)} placeholder="200 Portal Credits" /></Field>
      <Field label="Price (GBP)"><Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
      <Field label="Credits granted (blank = subscription)">
        <Input type="number" value={credits} onChange={(e) => setCredits(e.target.value)} />
      </Field>
      <label className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-xs">
        <span className="uppercase tracking-widest text-muted-foreground">Recurring</span>
        <Switch checked={recurring} onCheckedChange={setRecurring} />
      </label>
      <Button onClick={create} disabled={busy} className="w-full bg-pink-500 hover:bg-pink-400 text-black font-bold">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Plus className="h-4 w-4 mr-1" />Create</>}
      </Button>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">{label}</label>
      <div className="mt-1">{children}</div>
    </div>
  );
}
