import { useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useServerFn } from "@tanstack/react-start";
import {
  Loader2, QrCode, Copy, Download, Send, Trash2, IdCard, Sparkles, Share2,
  Ticket, AlertCircle, ExternalLink, X, Globe, Tag, Coins, Crown, CheckCircle2,
  Plus, CreditCard, Smartphone, Link2,
} from "lucide-react";
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

  const totalRemaining = useMemo(() => passes.reduce((s, p) => s + (p.max_uses - p.uses), 0), [passes]);
  const activeCount = useMemo(() => passes.filter((p) => p.uses < p.max_uses).length, [passes]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="glass-obsidian-cmd rounded-2xl p-5 space-y-3">
        <div className="flex items-start gap-3">
          <div className="shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-cyan-300 grid place-items-center text-black shadow-lg ring-4 ring-cyan-500/20">
            <Ticket className="h-5 w-5 stroke-[2.5]" />
          </div>
          <div className="min-w-0">
            <span className="inline-block text-[10px] uppercase tracking-[0.4em] font-black px-2 py-0.5 rounded border bg-cyan-500/15 text-cyan-300 border-cyan-700/40 mb-1">
              Shareable Access
            </span>
            <h2 className="syndicate-header text-lg text-white/95">Mint & Share Passes</h2>
            <p className="text-xs text-white/55 leading-relaxed max-w-xl">
              Create sign-up passes with embedded credits, VIP time, or custom redeem codes.
              Each pass generates a QR code, a shareable link, and a downloadable vCard.
            </p>
          </div>
        </div>

        {/* Stats strip */}
        {passes.length > 0 && (
          <div className="flex flex-wrap gap-3 pt-3 border-t border-white/5">
            <StatPill icon={Ticket} label={`${passes.length} pass${passes.length === 1 ? "" : "es"}`} tint="#67e8f9" />
            <StatPill icon={CheckCircle2} label={`${activeCount} active`} tint="#00e08a" />
            <StatPill icon={Globe} label={`${totalRemaining} use${totalRemaining === 1 ? "" : "s"} left`} tint="#ffd166" />
          </div>
        )}
      </div>

      {/* Mint form */}
      <div className="glass-obsidian-cmd rounded-2xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Plus className="h-3.5 w-3.5 text-cyan-400" />
          <h3 className="text-xs uppercase tracking-[0.3em] font-black text-white/80">New Pass</h3>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Label" hint="A name so you remember what this pass is for." icon={Tag}>
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. NFP launch, March promo"
              className="bg-black/50 border-white/10 text-white placeholder:text-white/30"
            />
          </Field>
          <Field label="Credits" hint="Credits given to anyone who redeems this pass." icon={Coins}>
            <Input
              value={credits}
              onChange={(e) => setCredits(e.target.value)}
              type="number"
              min="0"
              placeholder="25"
              className="bg-black/50 border-white/10 text-white placeholder:text-white/30"
            />
          </Field>
          <Field label="VIP Days" hint="Optional VIP duration. 0 = no VIP." icon={Crown}>
            <Input
              value={vipDays}
              onChange={(e) => setVipDays(e.target.value)}
              type="number"
              min="0"
              placeholder="0"
              className="bg-black/50 border-white/10 text-white placeholder:text-white/30"
            />
          </Field>
          <Field label="Max Uses" hint="How many people can redeem this pass." icon={CreditCard}>
            <Input
              value={maxUses}
              onChange={(e) => setMaxUses(e.target.value)}
              type="number"
              min="1"
              placeholder="1"
              className="bg-black/50 border-white/10 text-white placeholder:text-white/30"
            />
          </Field>
          <Field label="Redeem Code" hint="Optional custom code users type at signup." icon={Smartphone} className="sm:col-span-2 lg:col-span-2">
            <Input
              value={redeemCode}
              onChange={(e) => setRedeemCode(e.target.value.toUpperCase())}
              placeholder="e.g. EARLY2025 (optional)"
              className="bg-black/50 border-white/10 text-white placeholder:text-white/30 uppercase font-mono"
            />
          </Field>
        </div>

        <Button
          onClick={submit}
          disabled={busy || !label.trim()}
          className="w-full bg-cyan-500 hover:bg-cyan-400 text-black font-bold h-11"
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <><Sparkles className="h-4 w-4 mr-1.5" />Mint Pass</>
          )}
        </Button>
      </div>

      {/* Active pass preview */}
      {active && <PassCard pass={active} onClose={() => setActive(null)} />}

      {/* Pass list */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 px-1">
          <Ticket className="h-3.5 w-3.5 text-white/50" />
          <h3 className="text-xs uppercase tracking-[0.3em] font-black text-white/60">
            Pass Library · {passes.length}
          </h3>
        </div>

        {passes.length === 0 && (
          <div className="glass-obsidian-cmd rounded-2xl p-8 text-center space-y-3">
            <div className="mx-auto w-12 h-12 rounded-full bg-white/5 grid place-items-center">
              <Ticket className="h-5 w-5 text-white/30" />
            </div>
            <p className="text-sm text-white/60 font-medium">No passes minted yet</p>
            <p className="text-xs text-white/40 max-w-sm mx-auto leading-relaxed">
              Fill out the form above to create your first shareable pass.
              Each pass gets a QR code, link, and vCard for easy sharing.
            </p>
          </div>
        )}

        {passes.map((p) => {
          const remaining = p.max_uses - p.uses;
          const isExhausted = remaining <= 0;
          return (
            <div
              key={p.id}
              className={`glass-obsidian-cmd rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center gap-3 transition-opacity ${isExhausted ? "opacity-60" : ""}`}
            >
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-sm text-cyan-200 truncate">{p.token}</span>
                  {p.label && (
                    <span className="text-xs text-white/70 truncate">{p.label}</span>
                  )}
                  {isExhausted ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 text-[10px] font-bold text-rose-300 uppercase tracking-wider">
                      <AlertCircle className="h-2.5 w-2.5" /> Exhausted
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-300 uppercase tracking-wider">
                      <CheckCircle2 className="h-2.5 w-2.5" /> Active
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-white/50">
                  {p.credits > 0 && <span className="inline-flex items-center gap-1"><Coins className="h-3 w-3" />{p.credits} credits</span>}
                  {p.vip_days ? <span className="inline-flex items-center gap-1"><Crown className="h-3 w-3" />{p.vip_days}d VIP</span> : null}
                  {p.redeem_code ? <span className="inline-flex items-center gap-1 font-mono"><Tag className="h-3 w-3" />{p.redeem_code}</span> : null}
                  <span className="inline-flex items-center gap-1"><CreditCard className="h-3 w-3" />{p.uses}/{p.max_uses} used</span>
                  <span className="inline-flex items-center gap-1"><Globe className="h-3 w-3" />{remaining} left</span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  size="sm"
                  onClick={() => setActive(p)}
                  disabled={isExhausted}
                  className="h-8 bg-cyan-600 hover:bg-cyan-500 text-white text-xs"
                >
                  <QrCode className="h-3 w-3 mr-1" />Open
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => remove(p.id)}
                  className="h-8 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 text-xs"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
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
  const remaining = pass.max_uses - pass.uses;

  return (
    <div className="glass-obsidian-cmd rounded-2xl p-5 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <QrCode className="h-4 w-4 text-cyan-400" />
          <h3 className="text-xs uppercase tracking-[0.3em] font-black text-white/80">Pass Preview</h3>
        </div>
        <button
          onClick={onClose}
          className="text-white/40 hover:text-white/80 transition-colors"
          aria-label="Close preview"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="grid sm:grid-cols-[auto_1fr] gap-5">
        <canvas ref={canvasRef} className="rounded-xl border border-cyan-500/30 bg-[#02060d]" />
        <div className="space-y-4 min-w-0">
          <div>
            <p className="text-[10px] uppercase tracking-[0.4em] text-cyan-400 mb-1">Pass Token</p>
            <p className="text-xl sm:text-2xl font-mono text-cyan-200 break-all">{pass.token}</p>
            {pass.label && <p className="text-xs text-white/70 mt-1">{pass.label}</p>}
            <div className="mt-2 flex flex-wrap gap-2">
              {pass.credits > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-300">
                  <Coins className="h-2.5 w-2.5" /> {pass.credits} credits
                </span>
              )}
              {pass.vip_days ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-purple-500/30 bg-purple-500/10 px-2 py-0.5 text-[10px] font-bold text-purple-300">
                  <Crown className="h-2.5 w-2.5" /> {pass.vip_days}d VIP
                </span>
              ) : null}
              {pass.redeem_code ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-bold text-cyan-300 font-mono">
                  <Tag className="h-2.5 w-2.5" /> {pass.redeem_code}
                </span>
              ) : null}
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                <CreditCard className="h-2.5 w-2.5" /> {pass.uses}/{pass.max_uses} used · {remaining} left
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 rounded-lg bg-black/40 border border-white/10 px-3 py-2 text-xs font-mono text-cyan-200">
            <Link2 className="h-3.5 w-3.5 text-white/30 shrink-0" />
            <span className="truncate flex-1">{link}</span>
            <button onClick={copy} className="text-cyan-400 hover:text-cyan-200 shrink-0" title="Copy link">
              <Copy className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={downloadQr} className="bg-cyan-600 hover:bg-cyan-500 text-white text-xs h-8">
              <Download className="h-3 w-3 mr-1" />QR PNG
            </Button>
            <Button size="sm" onClick={downloadVcf} className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs h-8">
              <IdCard className="h-3 w-3 mr-1" />vCard
            </Button>
            <Button size="sm" onClick={shareTelegram} className="bg-sky-600 hover:bg-sky-500 text-white text-xs h-8">
              <Send className="h-3 w-3 mr-1" />Telegram
            </Button>
            <Button size="sm" onClick={nativeShare} className="bg-purple-600 hover:bg-purple-500 text-white text-xs h-8">
              <Share2 className="h-3 w-3 mr-1" />Share
            </Button>
            <Button size="sm" variant="ghost" onClick={onClose} className="text-white/50 hover:text-white/80 text-xs h-8">
              <ExternalLink className="h-3 w-3 mr-1" />Close
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Inline stat pill for the header strip. */
function StatPill({ icon: Icon, label, tint }: { icon: any; label: string; tint: string }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider"
      style={{ borderColor: `${tint}55`, color: tint, background: `${tint}1a` }}
    >
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
}

/** Labeled form field with optional hint. */
function Field({
  label, hint, icon: Icon, className, children,
}: {
  label: string;
  hint?: string;
  icon?: any;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`flex flex-col gap-1.5 ${className ?? ""}`}>
      <label className="text-[11px] uppercase tracking-[0.2em] text-white/70 font-bold flex items-center gap-1.5">
        {Icon ? <Icon className="h-3.5 w-3.5 text-white/50" /> : null}
        {label}
      </label>
      {children}
      {hint ? <span className="text-[11px] text-white/40 normal-case tracking-normal leading-snug">{hint}</span> : null}
    </div>
  );
}
