import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Ticket, Sparkles, Users, Wallet, TrendingUp, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CoinChip } from "@/components/CoinChip";
import { useAuth } from "@/hooks/use-auth";
import {
  getResellerWallet,
  mintResellerCode,
  updateResellerMarkup,
} from "@/lib/reseller.functions";
import { requireReseller } from "@/lib/route-guards";

export const Route = createFileRoute("/reseller")({
  beforeLoad: requireReseller,
  head: () => ({ meta: [{ title: "Reseller Console · 0G-PORTAL" }] }),
  component: ResellerPage,
});

function ResellerPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const fetchWallet = useServerFn(getResellerWallet);
  const qc = useQueryClient();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [user, loading, navigate]);

  const { data, isLoading, error } = useQuery({
    queryKey: ["reseller-wallet", user?.id],
    queryFn: () => fetchWallet(),
    enabled: !!user,
    retry: false,
  });

  if (loading || isLoading) return (
    <main className="px-5 py-20 text-center text-muted-foreground">
      <Loader2 className="h-5 w-5 inline animate-spin mr-2" />Booting reseller console…
    </main>
  );

  if (error || !data?.wallet) {
    return (
      <main className="px-5 py-20">
        <div className="max-w-xl mx-auto rounded-2xl border border-border bg-card p-8 text-center">
          <p className="text-[11px] uppercase tracking-[0.4em] text-primary">Reseller access</p>
          <h1 className="text-3xl font-black mt-3 text-foreground">Not a reseller</h1>
          <p className="mt-3 text-muted-foreground text-sm">
            Only the Boss can promote you to reseller. Once activated, your wallet, codes,
            and downline will appear here.
          </p>
        </div>
      </main>
    );
  }

  const w = data.wallet as any;
  const refLink = typeof window !== "undefined" ? `${window.location.origin}/auth?ref=${user!.id}` : "";

  return (
    <main className="min-h-screen text-foreground">
      <div className="max-w-6xl mx-auto px-5 sm:px-8 py-10">
        <header className="mb-8 rounded-3xl border border-border bg-gradient-to-br from-primary/10 via-card to-card p-6 sm:p-8">
          <p className="text-[11px] uppercase tracking-[0.4em] text-primary">Reseller Console</p>
          <h1 className="mt-2 text-3xl sm:text-5xl font-black tracking-tight text-metallic">
            {w.display_name ?? "Reseller"}
          </h1>
        </header>

        <section className="grid sm:grid-cols-3 gap-4 mb-8">
          <Stat icon={<Wallet className="h-4 w-4" />} label="Wallet credits" value={w.credits} accent="text-primary" />
          <Stat icon={<Users className="h-4 w-4" />} label="Downline" value={data.downline.length} accent="text-emerald-400" />
          <Stat icon={<TrendingUp className="h-4 w-4" />} label="Lifetime earnings" value={`$${(data.earnings_cents/100).toFixed(2)}`} accent="text-yellow-400" />
        </section>

        <ReferralPanel link={refLink} markupCents={w.markup_cents} onSaved={() => qc.invalidateQueries({ queryKey: ["reseller-wallet"] })} />

        <MintPanel onMinted={() => qc.invalidateQueries({ queryKey: ["reseller-wallet"] })} walletCredits={w.credits} markupCents={w.markup_cents} />

        <section className="mt-8 rounded-2xl border border-border bg-card p-5">
          <h2 className="text-[11px] uppercase tracking-[0.4em] text-primary mb-3">Your codes</h2>
          <div className="grid grid-cols-12 gap-2 text-[10px] uppercase tracking-[0.3em] text-muted-foreground border-b border-border pb-2">
            <div className="col-span-3">Code</div>
            <div className="col-span-2">Credits</div>
            <div className="col-span-2">Uses</div>
            <div className="col-span-2">Price</div>
            <div className="col-span-3">Created</div>
          </div>
          {(data.codes as any[]).length === 0 && <p className="py-6 text-center text-muted-foreground text-sm">No codes yet — mint one above.</p>}
          {(data.codes as any[]).map((c) => (
            <div key={c.id} className="grid grid-cols-12 gap-2 py-2 border-b border-border/60 text-sm">
              <div className="col-span-3 font-mono font-bold text-primary">{c.code}</div>
              <div className="col-span-2">{c.credits}</div>
              <div className="col-span-2">{c.uses}/{c.max_uses}</div>
              <div className="col-span-2">${(c.price_cents/100).toFixed(2)}</div>
              <div className="col-span-3 text-muted-foreground text-xs">{new Date(c.created_at).toLocaleDateString()}</div>
            </div>
          ))}
        </section>

        <section className="mt-6 rounded-2xl border border-border bg-card p-5">
          <h2 className="text-[11px] uppercase tracking-[0.4em] text-primary mb-3">Downline</h2>
          {(data.downline as any[]).length === 0 && <p className="py-6 text-center text-muted-foreground text-sm">Share your link to grow your tree.</p>}
          {(data.downline as any[]).map((d) => (
            <div key={d.id} className="flex justify-between py-1.5 border-b border-border/60 text-sm">
              <span className="text-foreground inline-flex items-center gap-2">
                {d.email}
                <CoinChip credits={d.credits} />
              </span>
              <span className="text-muted-foreground text-xs uppercase tracking-widest">{d.rank}</span>
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}

function Stat({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: any; accent: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 transition-colors hover:border-primary/40">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-muted-foreground">{icon}{label}</div>
      <p className={`mt-3 text-3xl font-black leading-none ${accent}`}>{value}</p>
    </div>
  );
}

function ReferralPanel({ link, markupCents, onSaved }: { link: string; markupCents: number; onSaved: () => void }) {
  const updateMarkup = useServerFn(updateResellerMarkup);
  const [m, setM] = useState(String(markupCents));
  const [busy, setBusy] = useState(false);
  return (
    <section className="rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 to-transparent p-5 mb-6">
      <h2 className="text-[11px] uppercase tracking-[0.4em] text-primary mb-3">Referral link &amp; markup</h2>
      <div className="flex flex-col sm:flex-row gap-2">
        <Input readOnly value={link} className="font-mono text-xs flex-1" />
        <Button onClick={() => { navigator.clipboard.writeText(link); toast.success("Link copied"); }} className="font-bold">
          <Copy className="h-4 w-4 mr-1" /> Copy
        </Button>
      </div>
      <div className="mt-3 flex flex-wrap gap-2 items-center">
        <span className="text-[11px] text-muted-foreground uppercase tracking-[0.2em]">Markup (cents)</span>
        <Input value={m} onChange={(e) => setM(e.target.value)} type="number" min="0" className="font-mono w-32" />
        <Button variant="secondary" onClick={async () => {
          setBusy(true);
          try { await updateMarkup({ data: { markupCents: Number(m) } }); toast.success("Markup updated"); onSaved(); }
          catch (e: any) { toast.error(e?.message ?? "Failed"); } finally { setBusy(false); }
        }} disabled={busy} className="font-bold">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
        </Button>
      </div>
    </section>
  );
}

function MintPanel({ onMinted, walletCredits, markupCents }: { onMinted: () => void; walletCredits: number; markupCents: number }) {
  const mint = useServerFn(mintResellerCode);
  const [code, setCode] = useState("");
  const [credits, setCredits] = useState("25");
  const [maxUses, setMaxUses] = useState("1");
  const [price, setPrice] = useState(String(markupCents));
  const [busy, setBusy] = useState(false);
  const cost = Number(credits) * Number(maxUses);
  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <h2 className="text-[11px] uppercase tracking-[0.4em] text-primary mb-3 flex items-center gap-2">
        <Ticket className="h-3.5 w-3.5" /> Mint code from wallet
      </h2>
      <div className="grid sm:grid-cols-5 gap-2">
        <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="MY-OFFER" className="font-mono uppercase" />
        <Input value={credits} onChange={(e) => setCredits(e.target.value)} type="number" min="1" placeholder="credits" className="font-mono" />
        <Input value={maxUses} onChange={(e) => setMaxUses(e.target.value)} type="number" min="1" placeholder="max uses" className="font-mono" />
        <Input value={price} onChange={(e) => setPrice(e.target.value)} type="number" min="0" placeholder="price (¢)" className="font-mono" />
        <Button onClick={async () => {
          setBusy(true);
          try {
            const r = await mint({ data: { code, credits: Number(credits), maxUses: Number(maxUses), priceCents: Number(price) } });
            toast.success(`Minted. Wallet: ${r.remaining_credits}c`);
            setCode(""); onMinted();
          } catch (e: any) {
            let msg = e?.message;
            if (e instanceof Response) { try { msg = await e.text(); } catch { msg = `HTTP ${e.status}`; } }
            toast.error(msg ?? "Mint failed");
          } finally { setBusy(false); }
        }} disabled={busy || !code || cost > walletCredits} className="font-bold">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Sparkles className="h-4 w-4 mr-1" />Mint</>}
        </Button>
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">
        Wallet cost: {cost || 0}c (credits × max_uses) · Buyer pays: ${(Number(price)/100).toFixed(2)} · Wallet: {walletCredits}c
      </p>
    </section>
  );
}
