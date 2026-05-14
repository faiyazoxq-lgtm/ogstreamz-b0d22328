import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Save, Trash2, Server, RefreshCw, CheckCircle2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { checkIsBoss } from "@/lib/boss.functions";
import {
  getBossStreamServerUrl,
  setBossStreamServerUrl,
  clearBossStreamServerUrl,
} from "@/lib/stream-link.functions";

/**
 * Boss-only inline editor for the platform-wide stream server URL.
 * Lets Boss add, edit, replace, or remove the URL stored in app_settings.
 * Members never see this card.
 */
export function BossStreamServerUrlCard() {
  const { user } = useAuth();
  const checkBossFn = useServerFn(checkIsBoss);
  const getFn = useServerFn(getBossStreamServerUrl);
  const setFn = useServerFn(setBossStreamServerUrl);
  const clearFn = useServerFn(clearBossStreamServerUrl);

  const bossQ = useQuery({
    queryKey: ["is-boss", user?.id],
    queryFn: () => checkBossFn(),
    enabled: !!user,
    staleTime: 60_000,
  });

  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState<"idle" | "save" | "clear" | "load">("load");
  const [info, setInfo] = useState<{
    dbValue: string | null;
    envValue: string | null;
    effective: string | null;
    dbUpdatedAt: string | null;
    statusOk: boolean;
    statusMsg?: string;
  } | null>(null);

  const isBoss = !!bossQ.data?.isBoss;

  const reload = async () => {
    setBusy("load");
    try {
      const r: any = await getFn();
      if (!r?.ok) throw new Error(r?.error || "Failed to load");
      setInfo({
        dbValue: r.dbValue,
        envValue: r.envValue,
        effective: r.effective,
        dbUpdatedAt: r.dbUpdatedAt,
        statusOk: !!r.status?.ok,
        statusMsg: r.status?.ok ? undefined : r.status?.message,
      });
      setDraft((r.dbValue ?? r.envValue ?? "") as string);
    } catch (e: any) {
      toast.error(e?.message || "Failed to load stream URL");
    } finally {
      setBusy("idle");
    }
  };

  useEffect(() => {
    if (isBoss) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isBoss]);

  if (!user || !isBoss) return null;

  const onSave = async () => {
    if (!draft.trim()) return toast.error("Enter a URL first");
    setBusy("save");
    try {
      const r: any = await setFn({ data: { url: draft.trim() } });
      if (!r?.ok) throw new Error(r?.error || "Save failed");
      toast.success("Stream server URL updated");
      await reload();
    } catch (e: any) {
      toast.error(e?.message || "Save failed");
    } finally {
      setBusy("idle");
    }
  };

  const onClear = async () => {
    if (!confirm("Remove the stored stream server URL? The platform will fall back to the env value (if set).")) return;
    setBusy("clear");
    try {
      const r: any = await clearFn();
      if (!r?.ok) throw new Error(r?.error || "Remove failed");
      toast.success("Stream server URL removed");
      await reload();
    } catch (e: any) {
      toast.error(e?.message || "Remove failed");
    } finally {
      setBusy("idle");
    }
  };

  const dbDirty = (info?.dbValue ?? "") !== draft.trim();
  const isLoading = busy === "load";

  return (
    <div className="mb-5 rounded-xl border border-amber-400/40 bg-amber-400/5 p-4">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.25em] font-bold text-amber-200">
          <Server className="h-3.5 w-3.5" />
          Boss · Stream Server URL
        </div>
        <button
          type="button"
          onClick={reload}
          disabled={isLoading}
          className="text-[10px] uppercase tracking-widest text-muted-foreground hover:text-foreground inline-flex items-center gap-1 disabled:opacity-60"
        >
          {isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
          Refresh
        </button>
      </div>

      <p className="text-[11px] text-muted-foreground mb-3">
        Origin only — e.g. <code className="font-mono">https://example.com</code>. No path, no credentials. Saved here overrides the env secret platform-wide.
      </p>

      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="url"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="https://your-stream-server.com"
          className="flex-1 bg-background/60 border border-border rounded-md px-3 py-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-amber-400"
          spellCheck={false}
          autoComplete="off"
        />
        <button
          type="button"
          onClick={onSave}
          disabled={busy !== "idle" || !draft.trim() || !dbDirty}
          className="inline-flex items-center justify-center gap-1.5 rounded-md bg-amber-400 px-3 py-2 text-xs font-bold uppercase tracking-widest text-background hover:opacity-90 disabled:opacity-50"
        >
          {busy === "save" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          {info?.dbValue ? "Replace" : "Save"}
        </button>
        {info?.dbValue && (
          <button
            type="button"
            onClick={onClear}
            disabled={busy !== "idle"}
            className="inline-flex items-center justify-center gap-1.5 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs font-bold uppercase tracking-widest text-destructive hover:bg-destructive/20 disabled:opacity-50"
          >
            {busy === "clear" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            Remove
          </button>
        )}
      </div>

      {info && (
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
          <div className="rounded-md border border-border/40 bg-background/30 px-3 py-2">
            <div className="text-[9px] uppercase tracking-widest text-muted-foreground">Stored (DB)</div>
            <div className="font-mono break-all">{info.dbValue ?? <span className="text-muted-foreground italic">— none —</span>}</div>
            {info.dbUpdatedAt && (
              <div className="mt-1 text-[10px] text-muted-foreground">Updated {new Date(info.dbUpdatedAt).toLocaleString()}</div>
            )}
          </div>
          <div className="rounded-md border border-border/40 bg-background/30 px-3 py-2">
            <div className="text-[9px] uppercase tracking-widest text-muted-foreground">Env fallback</div>
            <div className="font-mono break-all">{info.envValue ?? <span className="text-muted-foreground italic">— none —</span>}</div>
          </div>
          <div className="sm:col-span-2 inline-flex items-start gap-2 text-[11px]">
            {info.statusOk ? (
              <>
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 mt-0.5 shrink-0" />
                <span className="text-emerald-300">
                  Active configuration · <span className="font-mono">{info.effective}</span>
                </span>
              </>
            ) : (
              <>
                <AlertTriangle className="h-3.5 w-3.5 text-destructive mt-0.5 shrink-0" />
                <span className="text-destructive">{info.statusMsg || "Not configured"}</span>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
