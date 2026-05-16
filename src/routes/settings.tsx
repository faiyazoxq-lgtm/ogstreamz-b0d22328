import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Loader2, Upload, Save, User2, Globe, Send, Twitter, Instagram, Youtube, MessageCircle, Music2, Github, Linkedin, Trash2, Radio, Lock, Plus, X, Copy, Check, Wand2, ArrowRightLeft, AlertTriangle, Eye, Flame, Skull } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/use-auth";
import { OgPassBadge } from "@/components/OgPassBadge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { effectiveSwearing } from "@/lib/swearing";
import { useServerFn } from "@tanstack/react-start";
import { uploadProfileAvatar } from "@/lib/account-passes.functions";
import { fileToBase64 } from "@/lib/file-to-base64";
import {
  STREAM_PLATFORMS,
  entryKey,
  entryHref,
  newEntry,
  normalizeEntry,
  platformMeta,
  readEntries,
  validateEntry,
  detectPlatformFromValue,
  inspectPlatformValue,
  inspectionError,
  type StreamEntry,
  type StreamPlatform,
} from "@/lib/stream-links";

import { requireMember } from "@/lib/route-guards";
export const Route = createFileRoute("/settings")({
  beforeLoad: requireMember,
  head: () => ({
    meta: [
      { title: "OG-Pass · 0G-PORTAL" },
      { name: "description", content: "Edit your profile picture, bio and contact card." },
    ],
  }),
  component: SettingsPage,
});

type ContactCard = {
  telegram?: string;
  website?: string;
  twitter?: string;
  instagram?: string;
  youtube?: string;
  tiktok?: string;
  discord?: string;
  github?: string;
  linkedin?: string;
  whatsapp?: string;
  email_public?: string;
  _display?: CardDisplayPrefs;
};

type CardDisplayPrefs = {
  show_avatar?: boolean;
  show_name?: boolean;
  show_bio?: boolean;
  show_credits?: boolean;
  show_socials?: boolean;
  show_rank?: boolean;
};

const DEFAULT_DISPLAY: Required<CardDisplayPrefs> = {
  show_avatar: true,
  show_name: true,
  show_bio: true,
  show_credits: false,
  show_socials: true,
  show_rank: true,
};

const DISPLAY_FIELDS: Array<{ key: keyof CardDisplayPrefs; label: string; hint: string }> = [
  { key: "show_avatar", label: "Profile picture", hint: "Show your avatar on the card" },
  { key: "show_name", label: "Chosen display name", hint: "Show your display name (otherwise just initials)" },
  { key: "show_bio", label: "Bio / tag-line", hint: "Show the short bio you wrote above" },
  { key: "show_rank", label: "Rank badge", hint: "Show your syndicate rank (Prospect, VIP, etc.)" },
  { key: "show_credits", label: "Coin balance", hint: "Show your current 🪙 balance publicly" },
  { key: "show_socials", label: "Social / contact links", hint: "Show the contact links filled in below" },
];

type SocialKey = Exclude<keyof ContactCard, "_display">;
const SOCIAL_FIELDS: Array<{ key: SocialKey; label: string; placeholder: string; Icon: any }> = [
  { key: "telegram", label: "Telegram", placeholder: "@username or t.me/username", Icon: Send },
  { key: "whatsapp", label: "WhatsApp", placeholder: "+44 7..." , Icon: MessageCircle },
  { key: "website", label: "Website", placeholder: "https://yoursite.com", Icon: Globe },
  { key: "twitter", label: "X / Twitter", placeholder: "@handle", Icon: Twitter },
  { key: "instagram", label: "Instagram", placeholder: "@handle", Icon: Instagram },
  { key: "youtube", label: "YouTube", placeholder: "youtube.com/@channel", Icon: Youtube },
  { key: "tiktok", label: "TikTok", placeholder: "@handle", Icon: Music2 },
  { key: "discord", label: "Discord", placeholder: "username#0000", Icon: MessageCircle },
  { key: "github", label: "GitHub", placeholder: "@handle", Icon: Github },
  { key: "linkedin", label: "LinkedIn", placeholder: "linkedin.com/in/handle", Icon: Linkedin },
  { key: "email_public", label: "Public Email", placeholder: "you@domain.com", Icon: Globe },
];

function SettingsPage() {
  const { user, profile, loading, refresh } = useAuth();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const uploadAvatar = useServerFn(uploadProfileAvatar);

  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [contact, setContact] = useState<ContactCard>({});
  const [display, setDisplay] = useState<Required<CardDisplayPrefs>>(DEFAULT_DISPLAY);
  const [streamEntries, setStreamEntries] = useState<StreamEntry[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [loading, user, navigate]);

  useEffect(() => {
    if (!profile) return;
    setDisplayName(profile.display_name ?? "");
    setBio((profile as any).bio ?? "");
    setAvatarUrl((profile as any).avatar_url ?? null);
    const card = ((profile as any).contact_card ?? {}) as ContactCard;
    setContact(card);
    setDisplay({ ...DEFAULT_DISPLAY, ...(card._display ?? {}) });
    setStreamEntries(readEntries((profile as any).stream_links));
  }, [profile]);

  if (loading || !user) {
    return <main className="px-5 py-20 text-center text-muted-foreground">Loading…</main>;
  }

  const swearingOn = profile ? effectiveSwearing(profile as any) : false;

  const onPickFile = () => fileRef.current?.click();

  const onUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be under 5MB");
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const base64 = await fileToBase64(file);
      const res = await uploadAvatar({ data: { base64, mime: file.type, ext } });
      setAvatarUrl(res.avatar_url);
      await refresh?.();
      toast.success("Profile picture updated");
    } catch (err: any) {
      toast.error(err?.message ?? "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const removeAvatar = async () => {
    if (!user) return;
    setUploading(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ avatar_url: null })
        .eq("id", user.id);
      if (error) throw error;
      setAvatarUrl(null);
      await refresh?.();
      toast.success("Profile picture removed");
    } catch (err: any) {
      toast.error(err?.message ?? "Failed");
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    if (!user) return;
    setSaving(true);
    try {
      // Strip empty values
      const cleanCard: ContactCard = {};
      (Object.keys(contact) as (keyof ContactCard)[]).forEach((k) => {
        if (k === "_display") return;
        const v = (contact[k] ?? "").toString().trim();
        if (v) (cleanCard as any)[k] = v.slice(0, 300);
      });
      cleanCard._display = { ...DEFAULT_DISPLAY, ...display };
      const cleanedEntries: StreamEntry[] = [];
      const seenKeys = new Set<string>();
      for (const e of streamEntries) {
        const value = e.value.trim();
        if (!value) continue;
        const err = validateEntry({ ...e, value });
        if (err) throw new Error(`${platformMeta(e.platform).label}: ${err}`);
        const normalized = normalizeEntry({ ...e, value });
        const key = entryKey(normalized);
        if (key && seenKeys.has(key)) {
          throw new Error(
            `${platformMeta(e.platform).label}: duplicate of another entry (${normalized.value}). Remove one.`,
          );
        }
        if (key) seenKeys.add(key);
        cleanedEntries.push({
          id: e.id,
          platform: e.platform,
          value: normalized.value.slice(0, 300),
        });
      }
      const { error } = await supabase
        .from("profiles")
        .update({
          display_name: displayName.trim().slice(0, 80) || null,
          bio: bio.trim().slice(0, 500) || null,
          contact_card: cleanCard,
          stream_links: { entries: cleanedEntries },
        })
        .eq("id", user.id);
      if (error) throw error;
      await refresh?.();
      toast.success("OG-Pass saved");
    } catch (err: any) {
      toast.error(err?.message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const initials = (displayName || profile?.email || user.email || "U")
    .split(/[\s@.]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("");

  return (
    <main className="relative min-h-[calc(100vh-4rem)]">
      <div className="max-w-3xl mx-auto px-5 sm:px-8 py-12 sm:py-16">
        <header className="mb-10">
          <p className="text-xs uppercase tracking-[0.4em] font-semibold" style={{ color: "var(--neon-blue-bright)" }}>
            OG-Pass
          </p>
          <h1 className="mt-3 font-[Montserrat] font-black text-3xl sm:text-4xl text-metallic">
            Your Profile & Contact Card
          </h1>
          {(profile as any)?.og_pass_no != null && (
            <div className="mt-3">
              <OgPassBadge number={(profile as any).og_pass_no} size="md" />
            </div>
          )}
          <p className="mt-2 text-sm text-muted-foreground">
            Update your picture, bio, and the ways people can reach out to you across the syndicate.
          </p>
          <Link
            to="/profile"
            className="inline-block mt-3 text-xs uppercase tracking-[0.3em] text-muted-foreground hover:text-white"
          >
            ← Back to Vault
          </Link>
        </header>

        {/* Avatar */}
        <section className="rounded-2xl border border-border bg-card p-6 sm:p-8 mb-6">
          <h2 className="text-xs uppercase tracking-[0.3em] font-bold text-muted-foreground mb-4">
            Profile Picture
          </h2>
          <div className="flex items-center gap-5">
            <div className="h-24 w-24 rounded-full overflow-hidden border-2 border-[oklch(0.72_0.22_245/0.5)] bg-secondary/40 flex items-center justify-center text-xl font-black text-metallic">
              {avatarUrl ? (
                <img src={avatarUrl} alt="avatar" className="h-full w-full object-cover" />
              ) : (
                <span>{initials || <User2 className="h-8 w-8" />}</span>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={onUpload}
              />
              <Button onClick={onPickFile} disabled={uploading} className="btn-glass-blue text-white text-xs uppercase tracking-[0.25em] font-bold">
                {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                {avatarUrl ? "Change" : "Upload"} Picture
              </Button>
              {avatarUrl && (
                <Button onClick={removeAvatar} disabled={uploading} variant="outline" size="sm" className="text-xs uppercase tracking-[0.25em]">
                  <Trash2 className="h-3 w-3 mr-2" /> Remove
                </Button>
              )}
              <p className="text-[10px] text-muted-foreground">PNG/JPG · max 5MB</p>
            </div>
          </div>
        </section>

        {/* Identity */}
        <section className="rounded-2xl border border-border bg-card p-6 sm:p-8 mb-6 space-y-4">
          <h2 className="text-xs uppercase tracking-[0.3em] font-bold text-muted-foreground">
            Identity
          </h2>
          <div className="space-y-2">
            <Label htmlFor="display_name">Display name</Label>
            <Input
              id="display_name"
              value={displayName}
              maxLength={80}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="How others see you"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bio">Bio</Label>
            <Textarea
              id="bio"
              value={bio}
              maxLength={500}
              rows={4}
              onChange={(e) => setBio(e.target.value)}
              placeholder="A short tag-line for your contact card."
            />
            <p className="text-[10px] text-muted-foreground text-right">{bio.length}/500</p>
          </div>
        </section>

        {/* Contact card */}
        <section className="rounded-2xl border border-border bg-card p-6 sm:p-8 mb-6">
          <h2 className="text-xs uppercase tracking-[0.3em] font-bold text-muted-foreground mb-1">
            Contact Card
          </h2>
          <p className="text-xs text-muted-foreground mb-5">
            Anything you fill in here can be shown to other members so they can reach you. Leave blank to hide.
          </p>
          <div className="grid sm:grid-cols-2 gap-4">
            {SOCIAL_FIELDS.map(({ key, label, placeholder, Icon }) => (
              <div key={key} className="space-y-2">
                <Label htmlFor={key} className="flex items-center gap-2 text-xs">
                  <Icon className="h-3.5 w-3.5" style={{ color: "var(--neon-blue-bright)" }} />
                  {label}
                </Label>
                <Input
                  id={key}
                  value={contact[key] ?? ""}
                  maxLength={300}
                  placeholder={placeholder}
                  onChange={(e) => setContact((c) => ({ ...c, [key]: e.target.value }))}
                />
              </div>
            ))}
          </div>
        </section>

        {/* Card display preferences */}
        <section className="rounded-2xl border border-border bg-card p-6 sm:p-8 mb-6">
          <h2 className="text-xs uppercase tracking-[0.3em] font-bold text-muted-foreground mb-1 flex items-center gap-2">
            <Eye className="h-3.5 w-3.5" style={{ color: "var(--neon-blue-bright)" }} />
            Card Display
          </h2>
          <p className="text-xs text-muted-foreground mb-5">
            Choose what other members see on your profile card. Toggle anything off to hide it.
          </p>
          <div className="grid sm:grid-cols-2 gap-3">
            {DISPLAY_FIELDS.map(({ key, label, hint }) => (
              <label
                key={key}
                htmlFor={`display-${key}`}
                className="flex items-start justify-between gap-3 rounded-xl border border-border/60 bg-background/40 px-4 py-3 cursor-pointer hover:border-border"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">{label}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{hint}</p>
                </div>
                <Switch
                  id={`display-${key}`}
                  checked={!!display[key]}
                  onCheckedChange={(v) => setDisplay((d) => ({ ...d, [key]: !!v }))}
                />
              </label>
            ))}
          </div>
        </section>

        {/* OG-MODE (NSFW) */}
        <section className="rounded-2xl border border-border bg-card p-6 sm:p-8 mb-6">
          <h2 className="text-xs uppercase tracking-[0.3em] font-bold text-muted-foreground mb-1 flex items-center gap-2">
            <Skull className="h-3.5 w-3.5" style={{ color: "var(--neon-blue-bright)" }} />
            OG-MODE (NSFW)
          </h2>
          <p className="text-xs text-muted-foreground mb-5">
            Flipped from the header (the 🖕 / ❤️ button). When ON, OG Bot goes
            full chaos — foul-mouthed, ALL-CAPS bursts, named insults, no
            filter. When OFF, you're in family-friendly Safe Mode.
          </p>

          {/* Status row — read-only mirror of the header toggle */}
          <div className="mb-3 flex items-start justify-between gap-3 rounded-xl border border-border/60 bg-background/40 px-4 py-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Flame className="h-3.5 w-3.5 text-rose-400" />
                OG-MODE (NSFW)
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Currently{" "}
                <span className={swearingOn ? "text-rose-300 font-semibold" : "text-emerald-300 font-semibold"}>
                  {swearingOn ? "ON 🖕 (full chaos)" : "OFF 💚 (Family-Friendly)"}
                </span>
                . Use the header toggle to change it.
              </p>
            </div>
            <span
              className={[
                "shrink-0 rounded-full px-2 py-0.5 text-[10px] uppercase tracking-[0.25em] font-bold border",
                swearingOn
                  ? "border-rose-500/60 bg-rose-950/40 text-rose-200"
                  : "border-emerald-500/50 bg-emerald-950/30 text-emerald-300",
              ].join(" ")}
            >
              {swearingOn ? "On" : "Off"}
            </span>
          </div>
        </section>

        {/* Stream profiles */}
        <section className="rounded-2xl border border-border bg-card p-6 sm:p-8 mb-6">
          <h2 className="text-xs uppercase tracking-[0.3em] font-bold text-muted-foreground mb-1 flex items-center gap-2">
            <Radio className="h-3.5 w-3.5" style={{ color: "var(--neon-blue-bright)" }} />
            Stream Profiles
          </h2>
          <p className="text-xs text-muted-foreground mb-4 flex items-center gap-1.5">
            <Lock className="h-3 w-3" />
            Private — only you and the boss can see these. Not shown on your public contact card.
          </p>
          <div className="space-y-3">
            {streamEntries.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No stream profiles yet. Add Twitch, YouTube, Kick, or any custom stream URL.
              </p>
            )}
            {streamEntries.map((entry, idx) => {
              const meta = platformMeta(entry.platform);
              const PlatformIcon = meta.Icon;
              const detected = detectPlatformFromValue(entry.value);
              const mismatch = detected && detected !== entry.platform ? detected : null;
              const otherRowIdx = mismatch
                ? streamEntries.findIndex((x, i) => i !== idx && x.platform === mismatch)
                : -1;
              const inspect = inspectPlatformValue(entry.value);
              const extractErr =
                inspect && inspect.kind !== "ok" && inspect.kind !== "not-url"
                  ? inspectionError(inspect)
                  : null;
              return (
                <div key={entry.id} className="space-y-1.5">
                <div className="grid grid-cols-[140px_1fr_auto_auto] gap-2 items-center">
                  <Select
                    value={entry.platform}
                    onValueChange={(v) =>
                      setStreamEntries((list) =>
                        list.map((x, i) => (i === idx ? { ...x, platform: v as StreamPlatform } : x)),
                      )
                    }
                  >
                    <SelectTrigger className="text-xs">
                      <SelectValue>
                        <span className="flex items-center gap-2">
                          <PlatformIcon className="h-3.5 w-3.5" />
                          {meta.label}
                        </span>
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {STREAM_PLATFORMS.map((p) => {
                        const Icon = p.Icon;
                        return (
                          <SelectItem key={p.value} value={p.value}>
                            <span className="flex items-center gap-2">
                              <Icon className="h-3.5 w-3.5" />
                              {p.label}
                            </span>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                  <Input
                    value={entry.value}
                    maxLength={300}
                    placeholder={meta.placeholder}
                    onChange={(e) =>
                      setStreamEntries((list) =>
                        list.map((x, i) => (i === idx ? { ...x, value: e.target.value } : x)),
                      )
                    }
                    onBlur={() =>
                      setStreamEntries((list) =>
                        list.map((x, i) => {
                          if (i !== idx) return x;
                          if (!x.value.trim()) return x;
                          if (validateEntry(x)) return x; // don't normalize invalid input — let the error surface on save
                          return normalizeEntry(x);
                        }),
                      )
                    }
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    aria-label="Copy URL"
                    title="Copy URL"
                    disabled={!entry.value.trim() || !!validateEntry(entry)}
                    onClick={async () => {
                      const normalized = normalizeEntry(entry);
                      const url = entryHref(normalized);
                      if (!url) return;
                      try {
                        await navigator.clipboard.writeText(url);
                        setCopiedId(entry.id);
                        toast.success("Copied to clipboard");
                        setTimeout(() => setCopiedId((c) => (c === entry.id ? null : c)), 1500);
                      } catch {
                        toast.error("Could not copy");
                      }
                    }}
                  >
                    {copiedId === entry.id ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    aria-label="Remove stream"
                    onClick={() =>
                      setStreamEntries((list) => list.filter((_, i) => i !== idx))
                    }
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                {mismatch && (
                  <div className="ml-[148px] flex flex-wrap items-center gap-2 text-[11px] text-amber-300">
                    <Wand2 className="h-3 w-3" />
                    <span>
                      Looks like a <span className="font-semibold uppercase">{mismatch}</span> URL in the {meta.label} row.
                    </span>
                    {otherRowIdx >= 0 ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-6 px-2 text-[10px] uppercase tracking-[0.15em] border-amber-300/50 text-amber-200 hover:bg-amber-300/10"
                        onClick={() => {
                          setStreamEntries((list) => {
                            const next = [...list];
                            const target = next[otherRowIdx];
                            const movedValue = entry.value;
                            const candidate: StreamEntry = { ...target, value: movedValue };
                            next[otherRowIdx] = validateEntry(candidate) ? candidate : normalizeEntry(candidate);
                            next[idx] = { ...entry, value: "" };
                            return next;
                          });
                          toast.success(`Moved to ${mismatch} row`);
                        }}
                      >
                        <ArrowRightLeft className="h-3 w-3 mr-1" /> Move to {mismatch} row
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-6 px-2 text-[10px] uppercase tracking-[0.15em] border-amber-300/50 text-amber-200 hover:bg-amber-300/10"
                        onClick={() => {
                          setStreamEntries((list) =>
                            list.map((x, i) => {
                              if (i !== idx) return x;
                              const switched: StreamEntry = { ...x, platform: mismatch };
                              return validateEntry(switched) ? switched : normalizeEntry(switched);
                            }),
                          );
                          toast.success(`Switched row to ${mismatch}`);
                        }}
                      >
                        <Wand2 className="h-3 w-3 mr-1" /> Auto-fix → {mismatch}
                      </Button>
                    )}
                  </div>
                )}
                {!mismatch && extractErr && (
                  <div className="ml-[148px] flex items-start gap-2 text-[11px] text-rose-300">
                    <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                    <span>{extractErr}</span>
                  </div>
                )}
                </div>
              );
            })}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-xs uppercase tracking-[0.25em]"
              onClick={() => setStreamEntries((list) => [...list, newEntry("twitch")])}
            >
              <Plus className="h-3.5 w-3.5 mr-2" /> Add stream
            </Button>
          </div>
        </section>

        <div className="flex justify-end">
          <Button onClick={save} disabled={saving} className="btn-glass-blue text-white uppercase tracking-[0.25em] font-bold py-6 px-8">
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Save Changes
          </Button>
        </div>
      </div>
    </main>
  );
}