import { useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, QrCode, Copy, Download, Send, Trash2, IdCard, Sparkles, Share2 } from "lucide-react";
import { bossCreatePass, bossListPasses, bossDeletePass } from "@/lib/passes.functions";

type Pass = {
  id: string; token: string; label: string | null;
  redeem_code: string | null; credits: number; vip_days: number | null;
  max_uses: number; uses: number; expires_at: string | null; created_at: string;
};

const TG_HANDLE = "og_portal";

export function PassShareCardPanel() {
  const create = useServerFn(bossCreatePass);
  const list = useServerFn(bossListPasses);
  const del = useServerFn(bossDeletePass);

  const [passes, setPasses] = useState<Pass[]>([]);
  const [label, setLabel] = useState("");
  const [credits, setCredits] = useState("25");
  const [vipDays, setVipDays] = useState("0");
  const [maxUses, setMaxUses] = useState("1");
  const [redeemCode, setRedeemCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [active, setActive] = useState<Pass | null>(null);

  const refresh = async () => {
    try { const r = await list(); setPasses((r.passes ?? []) as Pass[]); }
    catch (e: any) {
      let msg = e?.message;
      if (e instanceof Response) { try { msg = await e.text(); } catch { msg = `HTTP ${e.status}`; } }
      toast.error(msg ?? "Failed to load passes");
    }
  };
  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, []);

  const submit = async () => {
    setBusy(true);
    try {
      const r = await create({
        data: {
          label, credits: Number(credits), vipDays: Number(vipDays) || null,
          maxUses: Number(maxUses), redeemCode: redeemCode || null,
        },
      });
      toast.success(`Pass minted: ${r.pass.token}`);
      setLabel(""); setRedeemCode("");
      setActive(r.pass as Pass);
      refresh();
    } catch (e: any) {
      let msg = e?.message;
      if (e instanceof Response) { try { msg = await e.text(); } catch { msg = `HTTP ${e.status}`; } }
      toast.error(msg ?? "Mint failed");
    } finally { setBusy(false); }
  };

  const remove = async (id: string) => {
    try { await del({ data: { id } }); toast.success("Removed"); refresh(); if (active?.id === id) setActive(null); }
    catch (e: any) { toast.error(e?.message ?? "Failed"); }
  };

  return (
    <section className="mt-6 rounded-xl border border-cyan-700/30 bg-black/50 p-5 backdrop-blur">
      <h2 className="text-xs uppercase tracking-[0.4em] text-cyan-400 mb-3 flex items-center gap-2">
        <IdCard className="h-3.5 w-3.5" /> SHARE-A-PASS · QR + LINK + vCARD
      </h2>

      <div className="grid sm:grid-cols-6 gap-2">
        <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="label (e.g. NFP launch)" className="bg-black/60 border-emerald-800/40 text-emerald-200 font-mono sm:col-span-2" />
        <Input value={credits} onChange={(e) => setCredits(e.target.value)} type="number" min="0" placeholder="credits" className="bg-black/60 border-emerald-800/40 text-emerald-200 font-mono" />
        <Input value={vipDays} onChange={(e) => setVipDays(e.target.value)} type="number" min="0" placeholder="VIP days" className="bg-black/60 border-emerald-800/40 text-emerald-200 font-mono" />
        <Input value={maxUses} onChange={(e) => setMaxUses(e.target.value)} type="number" min="1" placeholder="max uses" className="bg-black/60 border-emerald-800/40 text-emerald-200 font-mono" />
        <Input value={redeemCode} onChange={(e) => setRedeemCode(e.target.value.toUpperCase())} placeholder="link redeem code (opt.)" className="bg-black/60 border-emerald-800/40 text-emerald-200 font-mono uppercase" />
        <Button onClick={submit} disabled={busy} className="bg-cyan-500 hover:bg-cyan-400 text-black font-bold sm:col-span-6">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Sparkles className="h-4 w-4 mr-1" />MINT PASS</>}
        </Button>
      </div>

      {active && <PassCard pass={active} onClose={() => setActive(null)} />}

      <div className="mt-5 grid gap-2">
        {passes.length === 0 && <p className="text-xs text-emerald-700">// no passes minted yet</p>}
        {passes.map((p) => (
          <div key={p.id} className="flex items-center justify-between py-2 border-b border-cyan-900/20 text-sm">
            <div>
              <p className="text-cyan-200 font-mono">{p.token} <span className="text-emerald-400 ml-2">{p.label ?? ""}</span></p>
              <p className="text-[10px] text-emerald-700">
                {p.credits ? `${p.credits}c · ` : ""}
                {p.vip_days ? `${p.vip_days}d VIP · ` : ""}
                {p.redeem_code ? `code:${p.redeem_code} · ` : ""}
                {p.uses}/{p.max_uses} used
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={() => setActive(p)} className="h-7 bg-cyan-700 hover:bg-cyan-600 text-black"><QrCode className="h-3 w-3 mr-1" />OPEN</Button>
              <Button size="sm" onClick={() => remove(p.id)} className="h-7 bg-rose-700 hover:bg-rose-600 text-white"><Trash2 className="h-3 w-3" /></Button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function PassCard({ pass, onClose }: { pass: Pass; onClose: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const link = useMemo(
    () => `${typeof window !== "undefined" ? window.location.origin : ""}/auth?p=${encodeURIComponent(pass.token)}`,
    [pass.token]
  );

  useEffect(() => {
    if (!canvasRef.current) return;
    QRCode.toCanvas(canvasRef.current, link, { width: 240, margin: 1, color: { dark: "#00ffd1", light: "#02060d" } });
    QRCode.toDataURL(link, { width: 480, margin: 1, color: { dark: "#000000", light: "#ffffff" } }).then(setQrDataUrl);
  }, [link]);

  const copy = async () => { await navigator.clipboard.writeText(link); toast.success("Link copied"); };
  const downloadVcf = () => {
    const vcf = [
      "BEGIN:VCARD", "VERSION:3.0",
      "FN:0G-PORTAL Syndicate",
      "ORG:0G-PORTAL",
      "TITLE:Frequency Pass",
      `URL;TYPE=signup:${link}`,
      `URL;TYPE=telegram:https://t.me/${TG_HANDLE}`,
      `NOTE:${pass.label ?? "Syndicate signup pass"} · token ${pass.token}`,
      "END:VCARD",
    ].join("\n");
    const blob = new Blob([vcf], { type: "text/vcard" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `0G-PORTAL-${pass.token}.vcf`; a.click();
    URL.revokeObjectURL(url);
  };
  const downloadQr = () => {
    if (!qrDataUrl) return;
    const a = document.createElement("a");
    a.href = qrDataUrl; a.download = `0G-PORTAL-${pass.token}.png`; a.click();
  };
  const shareTelegram = () => {
    const text = `0G-PORTAL Syndicate pass${pass.label ? ` · ${pass.label}` : ""}`;
    const url = `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}`;
    window.open(url, "_blank");
  };
  const nativeShare = async () => {
    if (navigator.share) {
      try { await navigator.share({ title: "0G-PORTAL Pass", text: pass.label ?? "Join the Syndicate", url: link }); }
      catch {}
    } else copy();
  };

  return (
    <div className="mt-5 rounded-xl border border-cyan-500/40 bg-gradient-to-br from-black via-cyan-950/30 to-black p-5 grid sm:grid-cols-[auto_1fr] gap-5">
      <canvas ref={canvasRef} className="rounded-lg border border-cyan-700/40 bg-[#02060d]" />
      <div className="space-y-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.4em] text-cyan-400">PASS TOKEN</p>
          <p className="text-2xl font-mono text-cyan-200">{pass.token}</p>
          {pass.label && <p className="text-xs text-emerald-400 mt-1">{pass.label}</p>}
          <p className="text-[11px] text-emerald-700 mt-1">
            {pass.credits ? `${pass.credits} credits` : ""}
            {pass.vip_days ? `${pass.credits ? " · " : ""}${pass.vip_days}-day VIP` : ""}
            {pass.redeem_code ? ` · code ${pass.redeem_code}` : ""}
            {` · ${pass.max_uses - pass.uses} uses left`}
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-md bg-black/60 border border-cyan-800/40 px-2 py-1.5 text-xs font-mono text-cyan-200 truncate">
          <span className="truncate flex-1">{link}</span>
          <button onClick={copy} className="text-cyan-400 hover:text-cyan-200"><Copy className="h-3.5 w-3.5" /></button>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={downloadQr} className="bg-cyan-600 hover:bg-cyan-500 text-black"><Download className="h-3 w-3 mr-1" />QR PNG</Button>
          <Button size="sm" onClick={downloadVcf} className="bg-emerald-600 hover:bg-emerald-500 text-black"><IdCard className="h-3 w-3 mr-1" />vCARD</Button>
          <Button size="sm" onClick={shareTelegram} className="bg-sky-600 hover:bg-sky-500 text-white"><Send className="h-3 w-3 mr-1" />TELEGRAM</Button>
          <Button size="sm" onClick={nativeShare} className="bg-purple-600 hover:bg-purple-500 text-white"><Share2 className="h-3 w-3 mr-1" />SHARE</Button>
          <Button size="sm" variant="ghost" onClick={onClose} className="text-emerald-500 hover:text-emerald-300">close</Button>
        </div>
      </div>
    </div>
  );
}
