import { useMemo, useState } from "react";
import { Eye, RotateCcw } from "lucide-react";
import { PassStatusRow } from "@/components/PassStatusRow";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";

type Rank = "member" | "vip" | "boss";
type Size = "sm" | "md" | "lg";

type Props = {
  profile: any | null | undefined;
};

const SOCIAL_KEYS = ["telegram", "youtube", "tiktok", "instagram", "twitter", "website"] as const;
type SocialKey = (typeof SOCIAL_KEYS)[number];

const DEFAULT_HANDLES: Record<SocialKey, string> = {
  telegram: "ogboss",
  youtube: "ogstreamz",
  tiktok: "ogboss",
  instagram: "ogboss",
  twitter: "ogboss",
  website: "ogstreamz.co.uk",
};

/**
 * Live preview surface for the PassStatusRow identity card.
 * Lets the member toggle props (rank, VIP, stream, coins, socials, OG#)
 * and immediately see how their public pass renders. Useful when
 * fields are missing — the card updates in real-time as toggles flip.
 */
export function IdentityCardPreview({ profile }: Props) {
  const realContact = (profile?.contact_card && typeof profile.contact_card === "object")
    ? (profile.contact_card as Record<string, string | null | undefined>)
    : {};
  const realRank: Rank = profile?.rank === "boss" ? "boss" : profile?.status === "vip" ? "vip" : "member";

  const initialSocials = useMemo<Record<SocialKey, boolean>>(() => {
    const base = {} as Record<SocialKey, boolean>;
    for (const k of SOCIAL_KEYS) base[k] = !!(realContact[k] && String(realContact[k]).trim());
    return base;
  }, [profile?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const [rank, setRank] = useState<Rank>(realRank);
  const [size, setSize] = useState<Size>("md");
  const [streamActive, setStreamActive] = useState<boolean>(
    profile?.member_tier === "og_streamz_member" ||
      (!!profile?.stream_status && profile?.stream_status !== "expired" && profile?.stream_status !== "revoked"),
  );
  const [hasOgPass, setHasOgPass] = useState<boolean>(profile?.og_pass_no != null);
  const [ogNo, setOgNo] = useState<number>(profile?.og_pass_no ?? 1);
  const [credits, setCredits] = useState<number>(typeof profile?.credits === "number" ? profile.credits : 0);
  const [showCoins, setShowCoins] = useState(true);
  const [showRank, setShowRank] = useState(true);
  const [showSocials, setShowSocials] = useState(true);
  const [socialsOn, setSocialsOn] = useState<Record<SocialKey, boolean>>(initialSocials);

  const reset = () => {
    setRank(realRank);
    setSize("md");
    setStreamActive(
      profile?.member_tier === "og_streamz_member" ||
        (!!profile?.stream_status && profile?.stream_status !== "expired" && profile?.stream_status !== "revoked"),
    );
    setHasOgPass(profile?.og_pass_no != null);
    setOgNo(profile?.og_pass_no ?? 1);
    setCredits(typeof profile?.credits === "number" ? profile.credits : 0);
    setShowCoins(true); setShowRank(true); setShowSocials(true);
    setSocialsOn(initialSocials);
  };

  const previewProfile = useMemo(() => {
    const contact: Record<string, string> = {};
    for (const k of SOCIAL_KEYS) {
      if (socialsOn[k]) contact[k] = (realContact[k] && String(realContact[k]).trim()) || DEFAULT_HANDLES[k];
    }
    return {
      og_pass_no: hasOgPass ? ogNo : null,
      rank,
      status: rank === "boss" ? "free" : rank === "vip" ? "vip" : "free",
      stream_status: streamActive ? "active" : "expired",
      stream_expires_at: streamActive ? new Date(Date.now() + 1000 * 60 * 60 * 24 * 90).toISOString() : null,
      member_tier: streamActive ? "og_streamz_member" : null,
      credits,
      contact_card: contact,
    };
  }, [rank, streamActive, hasOgPass, ogNo, credits, socialsOn, realContact]);

  return (
    <section className="rounded-2xl border border-border/70 bg-card/60 backdrop-blur-sm p-5 sm:p-6">
      <header className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <Eye className="h-4 w-4" style={{ color: "var(--neon-blue-bright)" }} />
          <h3 className="font-[Montserrat] font-black text-sm uppercase tracking-[0.28em] text-metallic">
            Identity Card Preview
          </h3>
        </div>
        <button
          type="button"
          onClick={reset}
          className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.22em] text-muted-foreground hover:text-foreground transition-colors"
        >
          <RotateCcw className="h-3 w-3" /> Reset
        </button>
      </header>

      <p className="text-xs text-muted-foreground mb-4">
        Toggle anything below — the card updates live so you can see how your public pass looks
        before saving. None of these toggles change your account.
      </p>

      {/* Live preview surface */}
      <div className="rounded-xl border border-dashed border-amber-300/30 bg-background/40 p-5 mb-5 min-h-[88px] flex items-center justify-center">
        {hasOgPass ? (
          <PassStatusRow
            profile={previewProfile as any}
            size={size}
            showCoins={showCoins}
            showRank={showRank}
            showSocials={showSocials}
          />
        ) : (
          <p className="text-xs italic text-muted-foreground">
            No OG Pass number — card hidden. Toggle “OG Pass” on to preview.
          </p>
        )}
      </div>

      {/* Controls */}
      <div className="grid sm:grid-cols-2 gap-x-6 gap-y-4 text-sm">
        {/* Rank */}
        <div>
          <Label className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Rank</Label>
          <div className="mt-2 inline-flex rounded-md border border-border bg-background/40 p-0.5">
            {(["member", "vip", "boss"] as Rank[]).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRank(r)}
                className={[
                  "px-3 py-1 text-[10px] uppercase tracking-[0.2em] rounded transition-colors",
                  rank === r ? "bg-amber-400/20 text-amber-100" : "text-muted-foreground hover:text-foreground",
                ].join(" ")}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        {/* Size */}
        <div>
          <Label className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Chip size</Label>
          <div className="mt-2 inline-flex rounded-md border border-border bg-background/40 p-0.5">
            {(["sm", "md", "lg"] as Size[]).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSize(s)}
                className={[
                  "px-3 py-1 text-[10px] uppercase tracking-[0.2em] rounded transition-colors",
                  size === s ? "bg-amber-400/20 text-amber-100" : "text-muted-foreground hover:text-foreground",
                ].join(" ")}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <ToggleRow label="OG Pass" checked={hasOgPass} onChange={setHasOgPass} />
        <ToggleRow label="OG-Streamz active" checked={streamActive} onChange={setStreamActive} />
        <ToggleRow label="Show rank chip" checked={showRank} onChange={setShowRank} />
        <ToggleRow label="Show coin balance" checked={showCoins} onChange={setShowCoins} />
        <ToggleRow label="Show social links" checked={showSocials} onChange={setShowSocials} />

        {/* OG # */}
        <div className={hasOgPass ? "" : "opacity-50 pointer-events-none"}>
          <Label className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">OG Pass #</Label>
          <Input
            type="number"
            min={1}
            max={99999}
            value={ogNo}
            onChange={(e) => setOgNo(Math.max(1, Math.min(99999, Number(e.target.value) || 1)))}
            className="mt-2 h-8 max-w-[140px]"
          />
        </div>

        {/* Credits slider */}
        <div className={showCoins ? "" : "opacity-50 pointer-events-none"}>
          <Label className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground flex items-center justify-between">
            <span>Coin balance</span>
            <span className="tabular-nums text-foreground font-semibold">{credits.toLocaleString()} 🪙</span>
          </Label>
          <Slider
            value={[credits]}
            min={0}
            max={5000}
            step={10}
            onValueChange={(v) => setCredits(v[0] ?? 0)}
            className="mt-3"
          />
        </div>
      </div>

      {/* Socials */}
      <div className={["mt-5", showSocials ? "" : "opacity-50 pointer-events-none"].join(" ")}>
        <Label className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Linked socials</Label>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {SOCIAL_KEYS.map((k) => {
            const on = socialsOn[k];
            return (
              <button
                key={k}
                type="button"
                onClick={() => setSocialsOn((cur) => ({ ...cur, [k]: !cur[k] }))}
                className={[
                  "px-2.5 py-1 rounded-full border text-[10px] uppercase tracking-[0.2em] transition-colors",
                  on
                    ? "border-amber-300/60 bg-amber-400/15 text-amber-100"
                    : "border-border/60 bg-background/40 text-muted-foreground hover:text-foreground",
                ].join(" ")}
              >
                {k}
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-[10px] text-muted-foreground italic">
          Missing handles use a placeholder so you can preview the icon.
        </p>
      </div>
    </section>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-md border border-border/60 bg-background/30 px-3 py-2 cursor-pointer">
      <span className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </label>
  );
}