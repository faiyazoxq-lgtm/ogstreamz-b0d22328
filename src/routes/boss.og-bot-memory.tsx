import { createFileRoute } from "@tanstack/react-router";
import { exactPathRedirect } from "@/lib/boss-redirects";
import { useEffect, useState } from "react";
import { Brain, Loader2, Plus, Save, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/boss/og-bot-memory")({
  beforeLoad: exactPathRedirect("/boss/og-bot-memory", () => ({
    to: "/boss/infrastructure",
    hash: "og-bot-memory",
  })),
  component: () => null,
});

type MemoryRow = {
  facts: string[];
  message_count: number;
  updated_at: string | null;
};

export function OGBotMemoryPage() {
  const { user, profile, isAdmin, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const isBoss = profile?.rank === "boss" || isAdmin;

  const [loading, setLoading] = useState(true);
  const [meta, setMeta] = useState<{ messageCount: number; updatedAt: string | null }>({ messageCount: 0, updatedAt: null });
  const [facts, setFacts] = useState<string[]>([]);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [newFact, setNewFact] = useState("");

  useEffect(() => {
    if (authLoading) return;
    if (!user || !isBoss) { navigate({ to: "/" }); return; }
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user, isBoss]);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("og_bot_memory")
      .select("facts, message_count, updated_at")
      .eq("user_id", user!.id)
      .maybeSingle();
    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }
    const row = (data ?? null) as MemoryRow | null;
    const list = Array.isArray(row?.facts) ? (row!.facts as unknown[]).filter((f): f is string => typeof f === "string") : [];
    setFacts(list);
    setMeta({ messageCount: row?.message_count ?? 0, updatedAt: row?.updated_at ?? null });
    setDirty(false);
    setLoading(false);
  }

  function updateFact(i: number, v: string) {
    setFacts((arr) => arr.map((f, idx) => (idx === i ? v : f)));
    setDirty(true);
  }
  function removeFact(i: number) {
    setFacts((arr) => arr.filter((_, idx) => idx !== i));
    setDirty(true);
  }
  function addFact() {
    const v = newFact.trim();
    if (!v) return;
    if (v.length > 160) { toast.error("Facts are capped at 160 characters."); return; }
    setFacts((arr) => [...arr, v].slice(-50));
    setNewFact("");
    setDirty(true);
  }

  async function save() {
    if (!user) return;
    const cleaned = facts.map((f) => f.trim().slice(0, 160)).filter(Boolean).slice(-50);
    setSaving(true);
    const { error } = await supabase
      .from("og_bot_memory")
      .upsert({ user_id: user.id, facts: cleaned }, { onConflict: "user_id" });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Memory saved.");
    setFacts(cleaned);
    setDirty(false);
  }

  async function clearAll() {
    if (!user) return;
    setClearing(true);
    const { error } = await supabase
      .from("og_bot_memory")
      .upsert({ user_id: user.id, facts: [], message_count: 0 }, { onConflict: "user_id" });
    setClearing(false);
    setConfirmClear(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Memory wiped. OG Bot starts fresh.");
    setFacts([]);
    setMeta({ messageCount: 0, updatedAt: new Date().toISOString() });
    setDirty(false);
  }

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin" />
      </div>
    );
  }

  return (
    <div className="text-foreground">
      <div className="max-w-3xl">
        <p className="text-sm text-muted-foreground mb-4">
          Persistent facts OG Bot remembers about you across every surface. Edit anything, add notes, or wipe the lot.
        </p>

        <div className="grid grid-cols-3 gap-3 mb-6">
          <Stat label="Facts stored" value={String(facts.length)} />
          <Stat label="Messages exchanged" value={String(meta.messageCount)} />
          <Stat label="Last updated" value={meta.updatedAt ? new Date(meta.updatedAt).toLocaleString("en-GB") : "—"} />
        </div>

        <section className="rounded-lg border border-border bg-card p-4 mb-4">
          <h2 className="text-sm font-semibold mb-3">Stored facts</h2>
          {facts.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              No facts yet. OG Bot will start remembering as you chat with it.
            </p>
          ) : (
            <ul className="space-y-2">
              {facts.map((f, i) => (
                <li key={i} className="flex items-start gap-2">
                  <textarea
                    value={f}
                    onChange={(e) => updateFact(i, e.target.value)}
                    rows={1}
                    maxLength={160}
                    className="flex-1 resize-none rounded-md border border-border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <button
                    onClick={() => removeFact(i)}
                    className="p-2 text-muted-foreground hover:text-destructive transition-colors"
                    aria-label="Remove fact"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-4 flex gap-2">
            <input
              value={newFact}
              onChange={(e) => setNewFact(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addFact(); } }}
              maxLength={160}
              placeholder="Add a fact (e.g. 'prefers all-caps titles')…"
              className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <button
              onClick={addFact}
              disabled={!newFact.trim()}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              <Plus className="w-4 h-4" /> Add
            </button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">Up to 50 facts, 160 characters each.</p>
        </section>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={save}
            disabled={!dirty || saving}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save changes
          </button>
          {dirty && <span className="text-xs text-amber-400">Unsaved changes</span>}

          <div className="ml-auto">
            {!confirmClear ? (
              <button
                onClick={() => setConfirmClear(true)}
                className="inline-flex items-center gap-1.5 rounded-md border border-destructive/40 px-3 py-2 text-sm text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="w-4 h-4" /> Clear all memory
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-xs text-destructive">Wipe everything?</span>
                <button
                  onClick={clearAll}
                  disabled={clearing}
                  className="inline-flex items-center gap-1.5 rounded-md bg-destructive px-3 py-2 text-sm font-medium text-destructive-foreground disabled:opacity-50"
                >
                  {clearing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  Yes, wipe
                </button>
                <button
                  onClick={() => setConfirmClear(false)}
                  className="rounded-md border border-border px-3 py-2 text-sm hover:bg-muted"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold mt-0.5 truncate">{value}</div>
    </div>
  );
}