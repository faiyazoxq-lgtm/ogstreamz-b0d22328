import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Image as ImageIcon, Upload, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import {
  importTelegramAvatar,
  setProfileAvatar,
  uploadProfileAvatar,
} from "@/lib/account-passes.functions";
import { fileToBase64 } from "@/lib/file-to-base64";

/**
 * Lets a member choose their OG Pass profile picture: either pull their
 * current Telegram profile photo (server-side, via the bot) or upload
 * their own image. Stores in the public `avatars` bucket and writes the
 * URL to profiles.avatar_url. Used on /profile.
 */
export function AvatarManagerCard() {
  const { user, profile, refresh } = useAuth();
  const importTg = useServerFn(importTelegramAvatar);
  const setAvatar = useServerFn(setProfileAvatar);
  const uploadAvatar = useServerFn(uploadProfileAvatar);
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<"tg" | "upload" | "remove" | null>(null);

  const avatarUrl = (profile as any)?.avatar_url as string | null | undefined;
  const initials = (profile?.display_name || profile?.email || "?")
    .trim()
    .slice(0, 2)
    .toUpperCase();

  const onTelegram = async () => {
    setBusy("tg");
    try {
      await importTg();
      await refresh();
      toast.success("Profile picture updated from Telegram");
    } catch (e: any) {
      toast.error(e?.message ?? "Could not import Telegram photo");
    } finally {
      setBusy(null);
    }
  };

  const onUpload = async (file: File) => {
    if (!user) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be 5 MB or smaller");
      return;
    }
    setBusy("upload");
    try {
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const base64 = await fileToBase64(file);
      await uploadAvatar({ data: { base64, mime: file.type, ext } });
      await refresh();
      toast.success("Profile picture updated");
    } catch (e: any) {
      toast.error(e?.message ?? "Upload failed");
    } finally {
      setBusy(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const onRemove = async () => {
    setBusy("remove");
    try {
      await setAvatar({ data: { avatar_url: null } });
      await refresh();
      toast.success("Profile picture removed");
    } catch (e: any) {
      toast.error(e?.message ?? "Could not remove avatar");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-bold text-metallic">
          <ImageIcon className="inline h-4 w-4 mr-2 text-sky-400" />
          Profile picture
        </p>
      </div>

      <div className="flex items-center gap-4 mb-4">
        <div
          className="shrink-0 inline-flex h-16 w-16 items-center justify-center rounded-2xl overflow-hidden text-base font-black tracking-wider"
          style={{
            background:
              "linear-gradient(180deg, oklch(0.32 0.06 240) 0%, oklch(0.16 0.04 240) 100%)",
            border: "1px solid oklch(0.6 0.12 240 / 0.6)",
            color: "oklch(0.92 0.05 235)",
            boxShadow:
              "inset 0 1px 0 oklch(0.85 0.1 235 / 0.35), 0 0 12px -4px oklch(0.72 0.22 245 / 0.55)",
          }}
          aria-hidden="true"
        >
          {avatarUrl ? (
            <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <span>{initials}</span>
          )}
        </div>
        <div className="min-w-0 text-xs text-muted-foreground leading-snug">
          Shown on your OG Pass and member profile. Use your linked
          Telegram photo, or upload your own (max 5 MB).
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          onClick={onTelegram}
          disabled={!!busy}
          className="font-bold bg-sky-500 hover:bg-sky-400 text-black"
        >
          {busy === "tg" ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Send className="h-4 w-4 mr-2" />
          )}
          Use Telegram photo
        </Button>

        <Button
          variant="outline"
          onClick={() => fileRef.current?.click()}
          disabled={!!busy}
        >
          {busy === "upload" ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Upload className="h-4 w-4 mr-2" />
          )}
          Upload your own
        </Button>

        {avatarUrl && (
          <Button
            variant="ghost"
            onClick={onRemove}
            disabled={!!busy}
            className="text-muted-foreground hover:text-destructive"
          >
            {busy === "remove" ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4 mr-2" />
            )}
            Remove
          </Button>
        )}

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onUpload(f);
          }}
        />
      </div>
    </div>
  );
}

export default AvatarManagerCard;