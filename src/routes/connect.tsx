import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { requireMember } from "@/lib/route-guards";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import {
  Loader2, Rocket, Search, Mail, Eye, MousePointerClick, Reply,
  Globe, Trash2, Plus, RefreshCw, ShieldCheck, Sparkles,
} from "lucide-react";
import {
  createConnectCampaign, launchConnectCampaign, getCampaignStats,
  listConnectCampaigns, listCampaignLeads,
  listSendingDomains, upsertSendingDomain, deleteSendingDomain,
} from "@/lib/connect.functions";
import { SpawnPortalCard } from "@/components/SpawnPortalCard";
import { CreditWallet } from "@/components/CreditWallet";

export const Route = createFileRoute("/connect")({
  beforeLoad: requireMember,
  head: () => ({
    meta: [
      { title: "ConnectHUB · Signal-Based Outreach" },
      { name: "description", content: "Scout buying signals, enrich decision-makers, and ship hyper-personalized outreach." },
    ],
  }),
  component: ConnectHubPage,
});

type Campaign = {
  id: string; target_company: string; icp: string; offer: string; status: string;
  instantly_campaign_id: string | null; scout_summary: string | null;
  scout_news: any[]; created_at: string;
};
type Lead = {
  id: string; full_name: string | null; job_title: string | null; email: string | null;
  linkedin_url: string | null; company: string | null;
  email_subject: string | null; email_body: string | null; send_status: string;
};
type Stats = { sent: number; opens: number; replies: number; clicks: number };

function ConnectHubPage() {
  const { user, isAdmin, loading } = useAuth();
  const navigate = useNavigate();

  const fnCreate = useServerFn(createConnectCampaign);
  const fnLaunch = useServerFn(launchConnectCampaign);
  const fnStats = useServerFn(getCampaignStats);
  const fnListCampaigns = useServerFn(listConnectCampaigns);
  const fnListLeads = useServerFn(listCampaignLeads);
  const fnListDomains = useServerFn(listSendingDomains);
  const fnUpsertDomain = useServerFn(upsertSendingDomain);
  const fnDeleteDomain = useServerFn(deleteSendingDomain);

  const [target, setTarget] = useState("");
  const [url, setUrl] = useState("");
  const [icp, setIcp] = useState("");
  const [offer, setOffer] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);

  const [domains, setDomains] = useState<any[]>([]);
  const [newDomain, setNewDomain] = useState("");
  const [newCap, setNewCap] = useState(30);

  useEffect(() => {
    if (loading) return;
    if (!user || !isAdmin) navigate({ to: "/" });
  }, [user, isAdmin, loading, navigate]);

  const refreshCampaigns = async () => {
    const { campaigns } = await fnListCampaigns();
    setCampaigns(campaigns);
  };
  const refreshDomains = async () => {
    const { domains } = await fnListDomains();
    setDomains(domains);
  };
  useEffect(() => {
    if (!isAdmin) return;
    refreshCampaigns();
    refreshDomains();
  }, [isAdmin]);

  const openCampaign = async (id: string) => {
    setActiveId(id);
    setStats(null);
    const { leads } = await fnListLeads({ data: { campaignId: id } });
    setLeads(leads);
    try {
      const s = await fnStats({ data: { campaignId: id } });
      setStats(s as Stats);
    } catch { /* no instantly id yet */ }
  };

  const onScout = async () => {
    if (!target || !icp || !offer) {
      toast.error("Fill target company, ICP and offer.");
      return;
    }
    setBusy("scout");
    try {
      const r = await fnCreate({ data: { targetCompany: target, targetUrl: url, icp, offer } });
      toast.success(`Scouted ${r.leadCount} decision-makers from ${r.news.length} news signals.`);
      setTarget(""); setUrl(""); setIcp(""); setOffer("");
      await refreshCampaigns();
      openCampaign(r.campaignId);
    } catch (e: any) {
      toast.error(e.message ?? "Scout failed");
    } finally { setBusy(null); }
  };

  const onLaunch = async () => {
    if (!activeId) return;
    setBusy("launch");
    try {
      const r = await fnLaunch({ data: { campaignId: activeId } });
      toast.success(`Launched ${r.pushed} leads into Instantly campaign ${r.instantlyCampaignId?.slice(0,8) ?? ""}.`);
      await refreshCampaigns();
      openCampaign(activeId);
    } catch (e: any) {
      toast.error(e.message ?? "Launch failed");
    } finally { setBusy(null); }
  };

  const refreshStats = async () => {
    if (!activeId) return;
    setBusy("stats");
    try {
      const s = await fnStats({ data: { campaignId: activeId } });
      setStats(s as Stats);
    } finally { setBusy(null); }
  };

  const addDomain = async () => {
    if (!newDomain) return;
    setBusy("domain");
    try {
      await fnUpsertDomain({ data: { domain: newDomain, dailyCap: newCap, active: true } });
      setNewDomain(""); setNewCap(30);
      await refreshDomains();
      toast.success("Domain registered.");
    } catch (e: any) { toast.error(e.message); } finally { setBusy(null); }
  };

  const totalCapacity = useMemo(
    () => domains.reduce((s, d) => s + Math.max(0, (d.daily_cap ?? 0) - (d.sent_today ?? 0)), 0),
    [domains]
  );

  if (loading) return <div className="min-h-screen grid place-items-center"><Loader2 className="animate-spin" /></div>;
  if (!user || !isAdmin) return null;

  const active = campaigns.find((c) => c.id === activeId);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/40 bg-card/30 backdrop-blur sticky top-0 z-20">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10 ring-1 ring-primary/30">
              <Rocket className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-bold">ConnectHUB</h1>
              <p className="text-xs text-muted-foreground">Signal-based prospecting · May 2026</p>
            </div>
          </div>
          <Link to="/admin" className="text-xs text-muted-foreground hover:text-foreground">← Admin</Link>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6">

        {/* Spawner */}
        <section className="rounded-xl border border-border/50 bg-card/50 p-5 space-y-4">
          <div className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /><h2 className="font-semibold">Campaign Spawner</h2></div>
          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">Target Business Name</label>
              <Input value={target} onChange={(e) => setTarget(e.target.value)} placeholder="Acme Corp" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Target URL (optional)</label>
              <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://acme.com" />
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Ideal Customer Profile (ICP)</label>
            <Textarea rows={2} value={icp} onChange={(e) => setIcp(e.target.value)} placeholder="Series A fintech, 20-200 employees, US/EU" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">The Offer</label>
            <Textarea rows={2} value={offer} onChange={(e) => setOffer(e.target.value)} placeholder="A free 7-day trial of our AI Trading signals" />
          </div>
          <Button onClick={onScout} disabled={busy === "scout"} className="gap-2">
            {busy === "scout" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            Scout & Draft
          </Button>
          <p className="text-[11px] text-muted-foreground">
            Pipeline: Firecrawl finds buying signals → Apollo enriches decision-makers → Gemini drafts personalized outreach.
          </p>
        </section>

        {/* Sending domains */}
        <section className="rounded-xl border border-border/50 bg-card/50 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2"><Globe className="h-4 w-4 text-primary" /><h2 className="font-semibold">Warm Sending Domains</h2></div>
            <div className="text-xs text-muted-foreground">
              Total daily capacity: <span className="font-mono text-foreground">{totalCapacity}</span>
            </div>
          </div>
          <div className="flex flex-col md:flex-row gap-2">
            <Input value={newDomain} onChange={(e) => setNewDomain(e.target.value)} placeholder="warm-domain-1.com" />
            <Input type="number" className="md:w-32" value={newCap} onChange={(e) => setNewCap(parseInt(e.target.value) || 30)} />
            <Button onClick={addDomain} disabled={busy === "domain"} className="gap-2">
              <Plus className="h-4 w-4" /> Add
            </Button>
          </div>
          <div className="space-y-1">
            {domains.length === 0 && <div className="text-xs text-muted-foreground">No domains registered. Inbox-rotation cap is 0 — add domains before launching.</div>}
            {domains.map((d) => (
              <div key={d.id} className="flex items-center justify-between text-sm rounded border border-border/40 px-3 py-2 bg-background/40">
                <div className="font-mono">{d.domain}</div>
                <div className="flex items-center gap-3 text-xs">
                  <span className="text-muted-foreground">
                    {d.sent_today}/{d.daily_cap} today
                  </span>
                  <Button size="icon" variant="ghost" onClick={async () => { await fnDeleteDomain({ data: { id: d.id } }); refreshDomains(); }}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Campaigns list */}
        <section className="rounded-xl border border-border/50 bg-card/50 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Campaigns</h2>
            <Button size="sm" variant="ghost" onClick={refreshCampaigns} className="gap-1"><RefreshCw className="h-3.5 w-3.5" /> Refresh</Button>
          </div>
          {campaigns.length === 0 ? (
            <div className="text-xs text-muted-foreground">No campaigns yet.</div>
          ) : (
            <div className="grid md:grid-cols-2 gap-2">
              {campaigns.map((c) => (
                <button key={c.id} onClick={() => openCampaign(c.id)}
                  className={`text-left rounded-lg border p-3 transition ${activeId === c.id ? "border-primary bg-primary/5" : "border-border/40 hover:border-border/80"}`}>
                  <div className="flex items-center justify-between">
                    <div className="font-semibold text-sm">{c.target_company}</div>
                    <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-secondary">{c.status}</span>
                  </div>
                  <div className="text-xs text-muted-foreground line-clamp-1 mt-1">{c.offer}</div>
                </button>
              ))}
            </div>
          )}
        </section>

        {/* Active campaign detail */}
        {active && (
          <section className="rounded-xl border border-primary/40 bg-card/60 p-5 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <h2 className="font-bold text-lg">{active.target_company}</h2>
                <p className="text-xs text-muted-foreground">{active.icp}</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={refreshStats} disabled={busy === "stats"} className="gap-1">
                  {busy === "stats" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} Live stats
                </Button>
                <Button onClick={onLaunch} disabled={busy === "launch"} className="gap-2">
                  {busy === "launch" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
                  LAUNCH CONNECT
                </Button>
              </div>
            </div>

            {/* Live stats */}
            {stats && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <Stat icon={<Mail className="h-4 w-4" />} label="Sent" value={stats.sent} />
                <Stat icon={<Eye className="h-4 w-4" />} label="Opens" value={stats.opens} />
                <Stat icon={<Reply className="h-4 w-4" />} label="Replies" value={stats.replies} />
                <Stat icon={<MousePointerClick className="h-4 w-4" />} label="Clicks" value={stats.clicks} />
              </div>
            )}

            {/* Scout signals */}
            {active.scout_news?.length > 0 && (
              <div className="rounded-lg border border-border/40 bg-background/40 p-3 space-y-1">
                <div className="text-xs font-semibold text-primary flex items-center gap-1"><Search className="h-3 w-3" /> Buying signals</div>
                {active.scout_news.slice(0, 5).map((n: any, i: number) => (
                  <a key={i} href={n.url} target="_blank" rel="noopener noreferrer" className="block text-xs text-muted-foreground hover:text-foreground line-clamp-1">
                    • {n.title}
                  </a>
                ))}
              </div>
            )}

            {/* Leads */}
            <div className="space-y-2">
              <div className="text-xs font-semibold uppercase text-muted-foreground">Decision-makers ({leads.length})</div>
              {leads.map((l) => (
                <div key={l.id} className="rounded-lg border border-border/40 bg-background/40 p-3 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="font-semibold text-sm">{l.full_name ?? "—"} <span className="text-muted-foreground text-xs">· {l.job_title ?? "?"}</span></div>
                      <div className="text-xs font-mono text-muted-foreground">{l.email ?? "no email found"}</div>
                    </div>
                    <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-secondary">{l.send_status}</span>
                  </div>
                  {l.email_subject && (
                    <details className="text-xs">
                      <summary className="cursor-pointer text-primary">Subject: {l.email_subject}</summary>
                      <pre className="whitespace-pre-wrap text-muted-foreground mt-1 font-sans">{l.email_body}</pre>
                    </details>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* GDPR badge */}
        <footer className="rounded-lg border border-border/30 bg-muted/30 p-4 text-[11px] text-muted-foreground flex items-start gap-2">
          <ShieldCheck className="h-4 w-4 text-primary shrink-0 mt-0.5" />
          <div>
            <strong className="text-foreground">UK/EU GDPR 2026 — Legitimate Interest:</strong> Every email sent through ConnectHUB carries a legitimate-interest footer
            and a one-click opt-out link. Opt-outs are honored within 24h via the Instantly suppression list.
            ConnectHUB stores only business-context data necessary for the outreach and is not financial, medical, or legal advice.
          </div>
        </footer>
        <CreditWallet className="mt-10" />
        <SpawnPortalCard kind="connect" />
      </main>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border/40 bg-background/40 p-3">
      <div className="flex items-center gap-1 text-xs text-muted-foreground">{icon}{label}</div>
      <div className="text-2xl font-bold font-mono">{value}</div>
    </div>
  );
}
