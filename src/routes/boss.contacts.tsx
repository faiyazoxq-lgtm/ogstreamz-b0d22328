import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Phone, Plus, Trash2, Loader2, Copy, Pencil, Check, X, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { parsePhone, toDisplay } from "@/lib/phone";

export const Route = createFileRoute("/boss/contacts")({
  head: () => ({ meta: [{ title: "Boss Contacts · 0G-STREAMZ" }] }),
  component: BossContactsPage,
});

type Contact = {
  id: string;
  label: string;
  phone: string;
  notes: string;
  sort_order: number;
  created_at: string;
};

function BossContactsPage() {
  const [items, setItems] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState({ label: "", phone: "", notes: "" });
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState({ label: "", phone: "", notes: "" });
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "spare" | "other">("all");

  async function load() {
    const { data, error } = await supabase
      .from("boss_contacts")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setItems((data ?? []) as Contact[]);
    setLoading(false);
  }

  useEffect(() => {
    load();
    const ch = supabase
      .channel("boss_contacts")
      .on("postgres_changes", { event: "*", schema: "public", table: "boss_contacts" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  async function add() {
    const label = draft.label.trim();
    if (!label) {
      toast.error("Label is required");
      return;
    }
    const parsed = parsePhone(draft.phone);
    if (!parsed.ok) {
      toast.error(parsed.error);
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("boss_contacts").insert({
      label, phone: parsed.e164, notes: draft.notes.trim(),
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    setDraft({ label: "", phone: "", notes: "" });
    toast.success("Contact added");
  }

  async function remove(id: string) {
    if (!confirm("Delete this contact?")) return;
    const { error } = await supabase.from("boss_contacts").delete().eq("id", id);
    if (error) toast.error(error.message);
  }

  function beginEdit(c: Contact) {
    setEditing(c.id);
    setEditDraft({ label: c.label, phone: c.phone, notes: c.notes });
  }

  async function saveEdit(id: string) {
    const parsed = parsePhone(editDraft.phone);
    if (!parsed.ok) { toast.error(parsed.error); return; }
    const { error } = await supabase.from("boss_contacts").update({
      label: editDraft.label.trim(),
      phone: parsed.e164,
      notes: editDraft.notes.trim(),
    }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    setEditing(null);
    toast.success("Saved");
  }

  async function copyPhone(phone: string) {
    try {
      await navigator.clipboard.writeText(phone);
      toast.success("Copied", { description: phone });
    } catch {
      toast.error("Copy failed");
    }
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const qDigits = q.replace(/\D/g, "");
    return items.filter((c) => {
      if (filter === "spare" && !/\bspare\b/i.test(c.label)) return false;
      if (filter === "other" && /\bspare\b/i.test(c.label)) return false;
      if (!q) return true;
      const phoneDigits = c.phone.replace(/\D/g, "");
      const labelMatch = c.label.toLowerCase().includes(q);
      const notesMatch = (c.notes ?? "").toLowerCase().includes(q);
      const phoneMatch =
        c.phone.toLowerCase().includes(q) ||
        (qDigits.length >= 3 && phoneDigits.includes(qDigits));
      return labelMatch || notesMatch || phoneMatch;
    });
  }, [items, query, filter]);

  return (
    <div className="py-6 space-y-6">
      <header className="flex items-center gap-2">
        <Phone className="h-5 w-5 text-gold" />
        <h1 className="syndicate-header text-xl">Boss Contacts</h1>
        <span className="ml-2 text-xs text-muted-foreground">{items.length} saved</span>
      </header>

      <section className="rounded-2xl border border-gold/30 bg-card p-4 space-y-3">
        <h2 className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Add contact</h2>
        <div className="grid sm:grid-cols-2 gap-2">
          <Input
            placeholder="Label (e.g. SPARE A11)"
            value={draft.label}
            onChange={(e) => setDraft({ ...draft, label: e.target.value })}
          />
          <Input
            placeholder="Phone number"
            inputMode="tel"
            value={draft.phone}
            onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
          />
        </div>
        <Textarea
          placeholder="Notes (optional)"
          rows={2}
          value={draft.notes}
          onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
        />
        <Button onClick={add} disabled={saving} size="sm">
          {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}
          Add
        </Button>
      </section>

      <section className="space-y-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by label, phone, or notes…"
            className="pl-9"
            aria-label="Search contacts"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1 text-xs">
          {(["all", "spare", "other"] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setFilter(k)}
              className={`rounded-full px-3 py-1 uppercase tracking-[0.2em] border transition ${
                filter === k
                  ? "border-gold/60 bg-gold/10 text-gold"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {k === "all" ? "All" : k === "spare" ? "Spare" : "Other"}
            </button>
          ))}
          <span className="ml-auto text-muted-foreground">
            {filtered.length} of {items.length}
          </span>
        </div>
      </section>

      <section className="space-y-2">
        {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {!loading && items.length === 0 && (
          <p className="text-sm text-muted-foreground">No contacts yet.</p>
        )}
        {!loading && items.length > 0 && filtered.length === 0 && (
          <p className="text-sm text-muted-foreground">No contacts match your search.</p>
        )}
        {filtered.map((c) => (
          <div key={c.id} className="rounded-xl border border-border bg-card/60 p-3">
            {editing === c.id ? (
              <div className="space-y-2">
                <div className="grid sm:grid-cols-2 gap-2">
                  <Input value={editDraft.label} onChange={(e) => setEditDraft({ ...editDraft, label: e.target.value })} />
                  <Input value={editDraft.phone} onChange={(e) => setEditDraft({ ...editDraft, phone: e.target.value })} />
                </div>
                <Textarea rows={2} value={editDraft.notes} onChange={(e) => setEditDraft({ ...editDraft, notes: e.target.value })} />
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => saveEdit(c.id)}><Check className="h-4 w-4 mr-1" /> Save</Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditing(null)}><X className="h-4 w-4 mr-1" /> Cancel</Button>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="text-xs uppercase tracking-[0.25em] text-gold font-bold">{c.label}</div>
                  <a href={`tel:${c.phone}`} className="text-base font-mono text-foreground hover:underline" title={c.phone}>
                    {toDisplay(c.phone)}
                  </a>
                  {c.notes && <p className="mt-1 text-xs text-muted-foreground whitespace-pre-wrap">{c.notes}</p>}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button size="icon" variant="ghost" onClick={() => copyPhone(c.phone)} aria-label="Copy"><Copy className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => beginEdit(c)} aria-label="Edit"><Pencil className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => remove(c.id)} aria-label="Delete"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
              </div>
            )}
          </div>
        ))}
      </section>
    </div>
  );
}