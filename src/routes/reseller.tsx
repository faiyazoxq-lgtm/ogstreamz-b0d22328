import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Ticket, Sparkles, Users, Wallet, TrendingUp, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

  if (loading || isLoading) return <main className="px-5 py-20 text-center font-mono text-cyan-400">// Booting reseller console…</main>;

  if (error || !data?.wallet) {
    return (
      <main className="min-h-screen bg-[#040814] text-emerald-200 font-mono px-5 py-20">
        <div className="max-w-xl mx-auto rounded-xl border border-cyan-700/40 bg-black/60 p-8 text-center">
          <p className="text-xs uppercase tracking-[0.4em] text-cyan-400">RESELLER ACCESS</p>
          <h1 className="text-3xl font-black mt-3 text-white">Not a Reseller</h1>
          <p className="mt-3 text-emerald-400/80 text-sm">
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
    <main className="min-h-screen bg-[#040814] text-emerald-200 font-mono">
      <div className="max-w-6xl mx-auto px-5 sm:px-8 py-10">
        <header className="mb-8">
          <p className="text-xs uppercase tracking-[0.5em] text-cyan-400">RESELLER CONSOLE</p>
          <h1 className="mt-2 text-4xl sm:text-5xl font-black tracking-tight text-white drop-shadow-[0_0_18px_rgba(58,214,255,0.4)]">
            {w.display_name ?? "Reseller"}
          </h1>
        </header>

        <section className="grid sm:grid-cols-3 gap-3 mb-8">
          <Stat icon={<Wallet className="h-4 w-4" />} label="Wallet credits" value={w.credits} accent="text-cyan-300" />
          <Stat icon={<Users className="h-4 w-4" />} label="Downline" value={data.downline.length} accent="text-emerald-300" />
          <Stat icon={<TrendingUp className="h-4 w-4" />} label="Lifetime earnings" value={`$${(data.earnings_cents/100).toFixed(2)}`} accent="text-yellow-300" />
        </section>

        <ReferralPanel link={refLink} markupCents={w.markup_cents} onSaved={() => qc.invalidateQueries({ queryKey: ["reseller-wallet"] })} />

        <MintPanel onMinted={() => qc.invalidateQueries({ queryKey: ["reseller-wallet"] })} walletCredits={w.credits} markupCents={w.markup_cents} />

        <section className="mt-8 rounded-xl border border-emerald-800/40 bg-black/50 p-5">
          <h2 className="text-xs uppercase tracking-[0.4em] text-cyan-400 mb-3">YOUR CODES</h2>
          <div className="grid grid-cols-12 gap-2 text-[10px] uppercase tracking-[0.3em] text-emerald-700 border-b border-emerald-900/40 pb-2">
            <div className="col-span-3">CODE</div>
            <div className="col-span-2">CREDITS</div>
            <div className="col-span-2">USES</div>
            <div className="col-span-2">PRICE</div>
            <div className="col-span-3">CREATED</div>
          </div>
          {(data.codes as any[]).length === 0 && <p className="py-6 text-center text-emerald-700">// no codes yet</p>}
          {(data.codes as any[]).map((c) => (
            <div key={c.id} className="grid grid-cols-12 gap-2 py-2 border-b border-emerald-900/20 text-sm">
              <div className="col-span-3 font-bold text-cyan-300">{c.code}</div>
              <div className="col-span-2">{c.credits}</div>
              <div className="col-span-2">{c.uses}/{c.max_uses}</div>
              <div className="col-span-2">${(c.price_cents/100).toFixed(2)}</div>
              <div className="col-span-3 text-emerald-700 text-xs">{new Date(c.created_at).toLocaleDateString()}</div>
            </div>
          ))}
        </section>

        <section className="mt-6 rounded-xl border border-emerald-800/40 bg-black/50 p-5">
          <h2 className="text-xs uppercase tracking-[0.4em] text-cyan-400 mb-3">DOWNLINE</h2>
          {(data.downline as any[]).length === 0 && <p className="py-6 text-center text-emerald-700">// share your link to grow your tree</p>}
          {(data.downline as any[]).map((d) => (
            <div key={d.id} className="flex justify-between py-1.5 border-b border-emerald-900/20 text-sm">
              <span className="text-emerald-200">{d.email}</span>
              <span className="text-emerald-700 text-xs uppercase tracking-widest">{d.rank} · {d.credits}c</span>
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}

function Stat({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: any; accent: string }) {
  return (
    <div className="rounded-xl border border-emerald-800/40 bg-black/50 p-4">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-emerald-700">{icon}{label}</div>
      <p className={`mt-2 text-2xl font-black ${accent}`}>{value}</p>
    </div>
  );
}

function ReferralPanel({ link, markupCents, onSaved }: { link: string; markupCents: number; onSaved: () => void }) {
  const updateMarkup = useServerFn(updateResellerMarkup);
  const [m, setM] = useState(String(markupCents));
  const [busy, setBusy] = useState(false);
  return (
    <section className="rounded-xl border border-cyan-700/40 bg-black/60 p-5 mb-6">
      <h2 className="text-xs uppercase tracking-[0.4em] text-cyan-400 mb-3">REFERRAL LINK & MARKUP</h2>
      <div className="flex flex-col sm:flex-row gap-2">
        <Input readOnly value={link} className="bg-black/60 border-emerald-800/40 text-emerald-200 font-mono text-xs flex-1" />
        <Button onClick={() => { navigator.clipboard.writeText(link); toast.success("Link copied"); }} className="bg-cyan-500 hover:bg-cyan-400 text-black">
          <Copy className="h-4 w-4 mr-1" /> COPY
        </Button>
      </div>
      <div className="mt-3 flex gap-2 items-center">
        <span className="text-xs text-emerald-700 uppercase tracking-widest">Markup (cents):</span>
        <Input value={m} onChange={(e) => setM(e.target.value)} type="number" min="0" className="bg-black/60 border-emerald-800/40 text-emerald-200 font-mono w-32" />
        <Button onClick={async () => {
          setBusy(true);
          try { await updateMarkup({ data: { markupCents: Number(m) } }); toast.success("Markup updated"); onSaved(); }
          catch (e: any) { toast.error(e?.message ?? "Failed"); } finally { setBusy(false); }
        }} disabled={busy} className="bg-emerald-700 hover:bg-emerald-600 text-black">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "SAVE"}
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
    <section className="rounded-xl border border-emerald-700/40 bg-black/60 p-5">
      <h2 className="text-xs uppercase tracking-[0.4em] text-cyan-400 mb-3 flex items-center gap-2">
        <Ticket className="h-3.5 w-3.5" /> MINT CODE FROM WALLET
      </h2>
      <div className="grid sm:grid-cols-5 gap-2">
        <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="MY-OFFER" className="bg-black/60 border-emerald-800/40 text-emerald-200 font-mono uppercase" />
        <Input value={credits} onChange={(e) => setCredits(e.target.value)} type="number" min="1" placeholder="credits" className="bg-black/60 border-emerald-800/40 text-emerald-200 font-mono" />
        <Input value={maxUses} onChange={(e) => setMaxUses(e.target.value)} type="number" min="1" placeholder="max uses" className="bg-black/60 border-emerald-800/40 text-emerald-200 font-mono" />
        <Input value={price} onChange={(e) => setPrice(e.target.value)} type="number" min="0" placeholder="price (¢)" className="bg-black/60 border-emerald-800/40 text-emerald-200 font-mono" />
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
        }} disabled={busy || !code || cost > walletCredits} className="bg-cyan-500 hover:bg-cyan-400 text-black font-bold">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Sparkles className="h-4 w-4 mr-1" />MINT</>}
        </Button>
      </div>
      <p className="mt-2 text-[11px] text-emerald-700">
        Wallet cost: {cost || 0}c (credits × max_uses) · Buyer pays: ${(Number(price)/100).toFixed(2)} · Wallet: {walletCredits}c
      </p>
    </section>
  );
}
