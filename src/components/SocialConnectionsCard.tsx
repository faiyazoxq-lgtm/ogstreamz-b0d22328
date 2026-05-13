import { useEffect, useMemo, useState } from "react";
import { Send, Tv, Youtube, Instagram, Twitter, Music2, Globe, Pencil, Check, X, Plus, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { normalizeSocial, socialToUrl, socialDisplay, type SocialKey as NormSocialKey } from "@/lib/social-handles";

type SocialKey = "telegram" | "youtube" | "tiktok" | "instagram" | "twitter" | "website";

type Field = {
  key: SocialKey;
  label: string;
  placeholder: string;
  Icon: any;
  /** OKLCH brand tint used for the tile glow + icon. */
  tint: string;
  /** Build a public URL from a stored handle, or null if not linkable. */
  toUrl: (v: string) => string | null;
};

const FIELDS: Field[] = [
  {
    key: "telegram",
    label: "Telegram",
    placeholder: "@username",
    Icon: Send,
    tint: "oklch(0.72 0.16 230)",
    toUrl: (v) => socialToUrl("telegram", v),
  },
  {
    key: "youtube",
    label: "YouTube",
    placeholder: "@channel",
    Icon: Youtube,
    tint: "oklch(0.65 0.22 25)",
    toUrl: (v) => socialToUrl("youtube", v),
  },
  {
    key: "tiktok",
    label: "TikTok",
    placeholder: "@handle",
    Icon: Music2,
    tint: "oklch(0.72 0.20 320)",
    toUrl: (v) => socialToUrl("tiktok", v),
  },
  {
    key: "instagram",
    label: "Instagram",
    placeholder: "@handle",
    Icon: Instagram,
    tint: "oklch(0.70 0.20 0)",
    toUrl: (v) => socialToUrl("instagram", v),
  },
  {
    key: "twitter",
    label: "X / Twitter",
    placeholder: "@handle",
    Icon: Twitter,
    tint: "oklch(0.85 0 0)",
    toUrl: (v) => socialToUrl("twitter", v),
  },
  {
    key: "website",
    label: "Website",
    placeholder: "https://yoursite.com",
    Icon: Globe,
    tint: "oklch(0.78 0.14 145)",
    toUrl: (v) => socialToUrl("website", v),
  },
];

type ContactCardJson = Partial<Record<SocialKey, string>> & Record<string, any>;

function shortHandle(field: Field, raw: string): string {
  return socialDisplay(field.key as NormSocialKey, raw);
}

/**
 * One unified card that lets a member connect/edit their public social
 * handles. Writes to `profiles.contact_card` jsonb (same shape used by
 * /settings, so edits round-trip).
 *
 * Telegram & Stream additionally have dedicated verification cards on
 * the profile page — this card handles the lightweight "what's your
 * handle" linking.
 */
export function SocialConnectionsCard() {
  const { user, profile, refresh } = useAuth();
  const initial = useMemo<ContactCardJson>(
    () => ((profile as any)?.contact_card ?? {}) as ContactCardJson,
    [profile?.id, (profile as any)?.updated_at],
  );
  const [values, setValues] = useState<Partial<Record<SocialKey, string>>>({});
  const [editing, setEditing] = useState<SocialKey | null>(null);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState<SocialKey | null>(null);

  useEffect(() => {
    const next: Partial<Record<SocialKey, string>> = {};
    FIELDS.forEach((f) => {
      const v = (initial as any)[f.key];
      if (typeof v === "string") next[f.key] = v;
    });
    setValues(next);
  }, [initial]);

  const startEdit = (key: SocialKey) => {
    setEditing(key);
    setDraft(values[key] ?? "");
  };
  const cancel = () => {
    setEditing(null);
    setDraft("");
  };

  const persist = async (key: SocialKey, raw: string) => {
    if (!user) return;
    const trimmed = raw.trim().slice(0, 300);
    let storageValue = "";
    if (trimmed) {
      const norm = normalizeSocial(key as NormSocialKey, trimmed);
      if (!norm.ok) {
        toast.error(norm.error);
        return;
      }
      storageValue = norm.storage;
    }
    setSaving(key);
    try {
      const merged: ContactCardJson = { ...initial };
      if (storageValue) merged[key] = storageValue;
      else delete merged[key];
      const { error } = await supabase
        .from("profiles")
        .update({ contact_card: merged })
        .eq("id", user.id);
      if (error) throw new Error(error.message);
      setValues((v) => ({ ...v, [key]: storageValue }));
      await refresh?.();
      toast.success(storageValue ? "Linked" : "Removed");
      setEditing(null);
    } catch (e: any) {
      toast.error(e?.message ?? "Could not save");
    } finally {
      setSaving(null);
    }
  };

  const connectedCount = FIELDS.filter((f) => (values[f.key] ?? "").trim()).length;

  return (
    <div className="rounded-2xl border border-border bg-card p-6 sm:p-8">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] font-semibold" style={{ color: "var(--neon-blue-bright)" }}>
            Profile · Socials
          </p>
          <h2 className="mt-2 font-[Montserrat] font-black text-xl sm:text-2xl text-metallic">
            Connect your accounts
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Show off where the syndicate can find you. {connectedCount}/{FIELDS.length} linked.
          </p>
        </div>
      </div>

      <ul className="grid sm:grid-cols-2 gap-2.5">
        {FIELDS.map((f) => {
          const v = (values[f.key] ?? "").trim();
          const linked = !!v;
          const url = linked ? f.toUrl(v) : null;
          const isEditing = editing === f.key;
          const busy = saving === f.key;

          return (
            <li
              key={f.key}
              className="group relative rounded-xl border bg-background/40 p-3 transition-all"
              style={{
                borderColor: linked
                  ? `color-mix(in oklab, ${f.tint} 55%, transparent)`
                  : "var(--border)",
                boxShadow: linked
                  ? `0 0 24px -10px color-mix(in oklab, ${f.tint} 70%, transparent)`
                  : "none",
              }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0"
                  style={{
                    border: `1px solid color-mix(in oklab, ${f.tint} 45%, transparent)`,
                    background: `color-mix(in oklab, ${f.tint} 12%, transparent)`,
                  }}
                >
                  <f.Icon className="h-4 w-4" style={{ color: f.tint }} aria-hidden="true" />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-[10px] uppercase tracking-[0.25em] font-bold text-muted-foreground">
                    {f.label}
                  </p>
                  {isEditing ? (
                    <input
                      autoFocus
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") persist(f.key, draft);
                        if (e.key === "Escape") cancel();
                      }}
                      placeholder={f.placeholder}
                      className="mt-1 w-full bg-transparent text-sm font-mono text-white placeholder:text-muted-foreground/60 focus:outline-none"
                      maxLength={300}
                      disabled={busy}
                    />
                  ) : linked ? (
                    url ? (
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-0.5 inline-flex items-center gap-1 text-sm font-mono text-white hover:underline truncate max-w-full"
                        title={v}
                      >
                        <span className="truncate">{shortHandle(f, v)}</span>
                        <ExternalLink className="h-3 w-3 opacity-60 shrink-0" />
                      </a>
                    ) : (
                      <p className="mt-0.5 text-sm font-mono text-white truncate">{v}</p>
                    )
                  ) : (
                    <p className="mt-0.5 text-sm text-muted-foreground/70">{f.placeholder}</p>
                  )}
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {isEditing ? (
                    <>
                      <button
                        type="button"
                        onClick={() => persist(f.key, draft)}
                        disabled={busy}
                        aria-label={`Save ${f.label}`}
                        className="h-8 w-8 rounded-md border border-[color:var(--gold)]/40 bg-[color:var(--gold)]/10 text-[var(--gold)] hover:bg-[color:var(--gold)]/20 disabled:opacity-50 inline-flex items-center justify-center"
                      >
                        <Check className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={cancel}
                        disabled={busy}
                        aria-label="Cancel"
                        className="h-8 w-8 rounded-md border border-border text-muted-foreground hover:text-white inline-flex items-center justify-center"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </>
                  ) : linked ? (
                    <>
                      <button
                        type="button"
                        onClick={() => startEdit(f.key)}
                        aria-label={`Edit ${f.label}`}
                        className="h-8 w-8 rounded-md text-muted-foreground hover:text-white hover:bg-white/5 inline-flex items-center justify-center"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => persist(f.key, "")}
                        aria-label={`Remove ${f.label}`}
                        disabled={busy}
                        className="h-8 w-8 rounded-md text-muted-foreground hover:text-rose-300 hover:bg-rose-400/10 inline-flex items-center justify-center disabled:opacity-50"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => startEdit(f.key)}
                      className="inline-flex items-center gap-1 rounded-md border border-[oklch(0.72_0.22_245/0.4)] bg-[oklch(0.72_0.22_245/0.08)] px-2.5 py-1 text-[10px] uppercase tracking-[0.2em] font-bold text-white hover:bg-[oklch(0.72_0.22_245/0.18)]"
                    >
                      <Plus className="h-3 w-3" /> Add
                    </button>
                  )}
                </div>
              </div>

              {linked && (
                <span
                  className="absolute -top-1.5 -right-1.5 h-2.5 w-2.5 rounded-full"
                  style={{ background: f.tint, boxShadow: `0 0 10px ${f.tint}` }}
                  aria-hidden="true"
                />
              )}
            </li>
          );
        })}
      </ul>

      <p className="mt-4 text-[11px] text-muted-foreground">
        Telegram bot link &amp; OGSTREAMZ stream account verification live in the cards below.
      </p>
    </div>
  );
}

export default SocialConnectionsCard;
