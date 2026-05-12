import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Phone, Plus, Trash2, Loader2, Copy, Pencil, Check, X, Search, UserPlus, UserMinus, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { parsePhone, toDisplay } from "@/lib/phone";

/**
 * Phone input that live-validates as the user types and surfaces the
 * predicted E.164 form (or an inline error) below the field.
 */
function PhoneField({
  value,
  onChange,
  placeholder = "Phone number",
  id,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  id?: string;
}) {
  const trimmed = value.trim();
  const parsed = trimmed ? parsePhone(trimmed) : null;
  const helperId = id ? `${id}-helper` : undefined;
  const isError = parsed?.ok === false;
  const isValid = parsed?.ok === true;

  return (
    <div className="space-y-1">
      <Input
        id={id}
        placeholder={placeholder}
        inputMode="tel"
        autoComplete="tel"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={isError || undefined}
        aria-describedby={helperId}
        className={
          isError
            ? "border-destructive focus-visible:ring-destructive"
            : isValid
              ? "border-emerald-600/60 focus-visible:ring-emerald-500"
              : undefined
        }
      />
      <p
        id={helperId}
        className={`text-[11px] leading-tight ${
          isError
            ? "text-destructive"
            : isValid
              ? "text-emerald-500"
              : "text-muted-foreground"
        }`}
      >
        {isError
          ? parsed!.error
          : isValid
            ? `Saved as ${parsed!.e164} (${parsed!.display})`
            : "Format: E.164 e.g. +447347265145. UK 07… is auto-converted."}
      </p>
    </div>
  );
}

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
  linked_user_id: string | null;
};

type ProfileLite = {
  id: string;
  email: string | null;
  display_name: string | null;
  rank: string | null;
};

function BossContactsPage() {
  const [items, setItems] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState({ label: "", phone: "", notes: "" });
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState({ label: "", phone: "", notes: "", linked_user_id: null as string | null });
  const [query, setQuery] = useState("");
  const [matchIndex, setMatchIndex] = useState(0);
  const [escapeAnnouncement, setEscapeAnnouncement] = useState("");
  const [highlightAnnouncement, setHighlightAnnouncement] = useState("");
  const [noMatchAnnouncement, setNoMatchAnnouncement] = useState("");
  const [draftLinked, setDraftLinked] = useState<ProfileLite | null>(null);
  const [editLinked, setEditLinked] = useState<ProfileLite | null>(null);
  const [profiles, setProfiles] = useState<Record<string, ProfileLite>>({});

  async function load() {
    const { data, error } = await supabase
      .from("boss_contacts")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    const rows = (data ?? []) as Contact[];
    setItems(rows);
    const linkIds = Array.from(new Set(rows.map((r) => r.linked_user_id).filter(Boolean) as string[]));
    if (linkIds.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id,email,display_name,rank")
        .in("id", linkIds);
      const map: Record<string, ProfileLite> = {};
      (profs ?? []).forEach((p) => { map[p.id as string] = p as ProfileLite; });
      setProfiles(map);
    }
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
    const dupes = items.filter((c) => c.phone === parsed.e164);
    if (dupes.length > 0) {
      const names = dupes.map((d) => d.label).join(", ");
      if (!confirm(`This number is already saved as: ${names}.\nAdd another contact with the same phone?`)) {
        return;
      }
    }
    setSaving(true);
    const { error } = await supabase.from("boss_contacts").insert({
      label, phone: parsed.e164, notes: draft.notes.trim(),
      linked_user_id: draftLinked?.id ?? null,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    setDraft({ label: "", phone: "", notes: "" });
    setDraftLinked(null);
    toast.success("Contact added");
  }

  async function remove(id: string) {
    if (!confirm("Delete this contact?")) return;
    const { error } = await supabase.from("boss_contacts").delete().eq("id", id);
    if (error) toast.error(error.message);
  }

  function beginEdit(c: Contact) {
    setEditing(c.id);
    setEditDraft({ label: c.label, phone: c.phone, notes: c.notes, linked_user_id: c.linked_user_id });
    setEditLinked(c.linked_user_id ? profiles[c.linked_user_id] ?? null : null);
  }

  async function saveEdit(id: string) {
    const parsed = parsePhone(editDraft.phone);
    if (!parsed.ok) { toast.error(parsed.error); return; }
    const dupes = items.filter((c) => c.id !== id && c.phone === parsed.e164);
    if (dupes.length > 0) {
      const names = dupes.map((d) => d.label).join(", ");
      if (!confirm(`This number is already saved as: ${names}.\nKeep both contacts with the same phone?`)) {
        return;
      }
    }
    const { error } = await supabase.from("boss_contacts").update({
      label: editDraft.label.trim(),
      phone: parsed.e164,
      notes: editDraft.notes.trim(),
      linked_user_id: editLinked?.id ?? null,
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
    if (!q) return items;
    return items.filter((c) => {
      const phoneDigits = c.phone.replace(/\D/g, "");
      const labelMatch = c.label.toLowerCase().includes(q);
      const notesMatch = (c.notes ?? "").toLowerCase().includes(q);
      const phoneMatch =
        c.phone.toLowerCase().includes(q) ||
        (qDigits.length >= 3 && phoneDigits.includes(qDigits));
      return labelMatch || notesMatch || phoneMatch;
    });
  }, [items, query]);

  useEffect(() => { setMatchIndex(0); }, [query]);
  const activeMatchId =
    query.trim() && filtered.length > 0
      ? filtered[Math.min(matchIndex, filtered.length - 1)].id
      : null;
  const activeMatchRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const clearAndFocusSearch = () => {
    setQuery("");
    setMatchIndex(0);
    searchInputRef.current?.focus();
  };
  const announceEscape = (msg: string) => {
    // Reset first so the same message re-announces if pressed twice.
    setEscapeAnnouncement("");
    setTimeout(() => setEscapeAnnouncement(msg), 30);
  };
  useEffect(() => {
    if (!activeMatchId) return;
    const el = activeMatchRef.current;
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.focus({ preventScroll: true });
  }, [activeMatchId]);

  // Announce the currently highlighted match for screen readers as the user
  // navigates through matches with the keyboard.
  useEffect(() => {
    if (!query.trim() || filtered.length === 0) {
      setHighlightAnnouncement("");
      return;
    }
    const idx = Math.min(matchIndex, filtered.length - 1);
    const c = filtered[idx];
    const msg = `Highlighted match ${idx + 1} of ${filtered.length}: ${c.label}${c.phone ? `, ${c.phone}` : ""}.`;
    // Reset first so consecutive moves to the same index still re-announce.
    setHighlightAnnouncement("");
    const t = setTimeout(() => setHighlightAnnouncement(msg), 30);
    return () => clearTimeout(t);
  }, [matchIndex, activeMatchId, filtered, query]);

  // Announce when a search returns zero matches.
  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setNoMatchAnnouncement("");
      return;
    }
    if (filtered.length === 0 && items.length > 0) {
      const msg = `No contacts match “${q}” out of ${items.length}.`;
      setNoMatchAnnouncement("");
      const t = setTimeout(() => setNoMatchAnnouncement(msg), 30);
      return () => clearTimeout(t);
    }
    setNoMatchAnnouncement("");
  }, [query, filtered.length, items.length]);

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
          <PhoneField
            id="contact-phone"
            value={draft.phone}
            onChange={(v) => setDraft({ ...draft, phone: v })}
          />
        </div>
        <Textarea
          placeholder="Notes (optional)"
          rows={2}
          value={draft.notes}
          onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
        />
        <UserLinkPicker selected={draftLinked} onSelect={setDraftLinked} />
        <Button onClick={add} disabled={saving} size="sm">
          {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}
          Add
        </Button>
      </section>

      <section className="space-y-2">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            ref={searchInputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.preventDefault();
                if (query) {
                  clearAndFocusSearch();
                  announceEscape("Search cleared. Highlighted match reset to first match.");
                } else {
                  setMatchIndex(0);
                  searchInputRef.current?.focus();
                  announceEscape("Highlighted match reset to first match.");
                }
                return;
              }
              if (filtered.length === 0) return;
              const len = filtered.length;
              const step = (delta: number) => {
                e.preventDefault();
                setMatchIndex((i) => (Math.min(i, len - 1) + delta + len) % len);
              };
              if (e.key === "Enter") step(e.shiftKey ? -1 : 1);
              else if (e.key === "ArrowDown") step(1);
              else if (e.key === "ArrowUp") step(-1);
              else if (e.key === "Home") { e.preventDefault(); setMatchIndex(0); }
              else if (e.key === "End") { e.preventDefault(); setMatchIndex(len - 1); }
            }}
            placeholder="Search by label, phone, or notes…"
            className="pl-9"
            aria-label="Search contacts"
            aria-controls="boss-contacts-list"
            aria-describedby="boss-contacts-search-status"
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
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              clearAndFocusSearch();
              announceEscape("Search cleared. Highlighted match reset to first match.");
            }}
            disabled={!query}
          >
            <X className="h-4 w-4 mr-1" /> Clear
          </Button>
        </div>
        <div className="sr-only" role="status" aria-live="assertive" aria-atomic="true">
          {escapeAnnouncement}
        </div>
        <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
          {highlightAnnouncement}
        </div>
        <div className="sr-only" role="alert" aria-live="assertive" aria-atomic="true">
          {noMatchAnnouncement}
        </div>
        <div
          id="boss-contacts-search-status"
          role="status"
          aria-live="polite"
          aria-atomic="true"
          className={`text-xs text-muted-foreground text-right ${query ? "" : "sr-only"}`}
        >
          {query
            ? filtered.length > 0
              ? `Match ${Math.min(matchIndex, filtered.length - 1) + 1} of ${filtered.length}: ${filtered[Math.min(matchIndex, filtered.length - 1)].label}. Press Enter for next, Shift+Enter for previous.`
              : `No contacts match your search out of ${items.length}.`
            : ""}
        </div>
      </section>

      <section
        id="boss-contacts-list"
        role="list"
        aria-label="Contacts"
        className="space-y-2"
      >
        {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {!loading && items.length === 0 && (
          <p className="text-sm text-muted-foreground">No contacts yet.</p>
        )}
        {!loading && items.length > 0 && filtered.length === 0 && (
          <p className="text-sm text-muted-foreground">No contacts match your search.</p>
        )}
        {filtered.map((c) => {
          const isActiveMatch = c.id === activeMatchId;
          return (
          <div
            key={c.id}
            ref={isActiveMatch ? activeMatchRef : undefined}
            role="listitem"
            tabIndex={isActiveMatch ? 0 : -1}
            aria-current={isActiveMatch ? "true" : undefined}
            aria-label={`${c.label}, ${toDisplay(c.phone)}${isActiveMatch ? ", current match" : ""}`}
            onKeyDown={
              isActiveMatch
                ? (e) => {
                    if (e.key === "Escape") {
                      e.preventDefault();
                      if (query) {
                        clearAndFocusSearch();
                        announceEscape("Search cleared. Highlighted match reset to first match.");
                      } else {
                        setMatchIndex(0);
                        searchInputRef.current?.focus();
                        announceEscape("Highlighted match reset to first match.");
                      }
                    }
                  }
                : undefined
            }
            className={`rounded-xl border bg-card/60 p-3 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-gold ${
              isActiveMatch
                ? "border-gold/70 ring-2 ring-gold/40 bg-gold/5"
                : "border-border"
            }`}
          >
            {editing === c.id ? (
              <div className="space-y-2">
                <div className="grid sm:grid-cols-2 gap-2">
                  <Input value={editDraft.label} onChange={(e) => setEditDraft({ ...editDraft, label: e.target.value })} />
                  <PhoneField
                    value={editDraft.phone}
                    onChange={(v) => setEditDraft({ ...editDraft, phone: v })}
                  />
                </div>
                <Textarea rows={2} value={editDraft.notes} onChange={(e) => setEditDraft({ ...editDraft, notes: e.target.value })} />
                <UserLinkPicker selected={editLinked} onSelect={setEditLinked} />
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
                  {c.linked_user_id && profiles[c.linked_user_id] && (
                    <Link
                      to="/boss/users"
                      className="mt-1 inline-flex items-center gap-1 text-xs text-cyan-400 hover:underline"
                      title={profiles[c.linked_user_id].email ?? ""}
                    >
                      <ExternalLink className="h-3 w-3" />
                      {profiles[c.linked_user_id].display_name || profiles[c.linked_user_id].email || "Linked profile"}
                      {profiles[c.linked_user_id].rank && (
                        <span className="ml-1 rounded bg-cyan-400/10 px-1 py-0.5 uppercase tracking-wider">
                          {profiles[c.linked_user_id].rank}
                        </span>
                      )}
                    </Link>
                  )}
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
          );
        })}
      </section>
    </div>
  );
}

function UserLinkPicker({
  selected,
  onSelect,
}: {
  selected: ProfileLite | null;
  onSelect: (p: ProfileLite | null) => void;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<ProfileLite[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (selected) return;
    const term = q.trim();
    if (term.length < 2) { setResults([]); return; }
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id,email,display_name,rank")
        .or(`email.ilike.%${term}%,display_name.ilike.%${term}%`)
        .limit(8);
      if (!cancelled) {
        setResults((data ?? []) as ProfileLite[]);
        setLoading(false);
      }
    }, 200);
    return () => { cancelled = true; clearTimeout(t); };
  }, [q, selected]);

  if (selected) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-cyan-400/30 bg-cyan-400/5 px-2 py-1.5 text-xs">
        <UserPlus className="h-3.5 w-3.5 text-cyan-400" />
        <span className="font-medium">{selected.display_name || selected.email}</span>
        {selected.email && selected.display_name && (
          <span className="text-muted-foreground">{selected.email}</span>
        )}
        <button
          type="button"
          onClick={() => { onSelect(null); setQ(""); }}
          className="ml-auto inline-flex items-center gap-1 text-muted-foreground hover:text-destructive"
          aria-label="Unlink user"
        >
          <UserMinus className="h-3.5 w-3.5" /> Unlink
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <Input
        value={q}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder="Link to a user (search by email or name)…"
        className="text-sm"
      />
      {open && q.trim().length >= 2 && (
        <div className="absolute z-20 mt-1 w-full rounded-lg border border-border bg-popover p-1 shadow-lg max-h-60 overflow-auto">
          {loading && <div className="px-2 py-1 text-xs text-muted-foreground">Searching…</div>}
          {!loading && results.length === 0 && (
            <div className="px-2 py-1 text-xs text-muted-foreground">No matches</div>
          )}
          {results.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => { onSelect(p); setOpen(false); setQ(""); }}
              className="flex w-full items-center justify-between rounded px-2 py-1 text-left text-xs hover:bg-accent"
            >
              <span className="truncate">
                <span className="font-medium">{p.display_name || p.email}</span>
                {p.display_name && p.email && (
                  <span className="ml-2 text-muted-foreground">{p.email}</span>
                )}
              </span>
              {p.rank && <span className="ml-2 rounded bg-muted px-1 uppercase tracking-wider">{p.rank}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}