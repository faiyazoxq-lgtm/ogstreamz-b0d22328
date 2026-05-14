import { useEffect, useLayoutEffect, useRef, useState, type FormEvent } from "react";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, RefreshCw, Send, MessageSquare, Paperclip, X } from "lucide-react";
import { toast } from "sonner";
import {
  listMyTelegramMessages,
  sendMyTelegramMessage,
  sendMyTelegramAttachment,
  type TgMessage,
} from "@/lib/telegram-inbox.functions";

const BOT_USERNAME = "Ogstreamzbot";
const PAGE_SIZE = 50;
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024; // 10 MB

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // strip "data:<mime>;base64,"
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(reader.error ?? new Error("Read failed"));
    reader.readAsDataURL(file);
  });
}

export function MyTelegramInbox() {
  const qc = useQueryClient();
  const fetchMessages = useServerFn(listMyTelegramMessages);
  const sendMessage = useServerFn(sendMyTelegramMessage);
  const sendAttachment = useServerFn(sendMyTelegramAttachment);
  const [draft, setDraft] = useState("");
  const [attachment, setAttachment] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const topSentinelRef = useRef<HTMLDivElement | null>(null);
  const prevScrollHeightRef = useRef<number | null>(null);
  const initialScrolledRef = useRef(false);

  const q = useInfiniteQuery({
    queryKey: ["my-tg-inbox"],
    queryFn: ({ pageParam }) =>
      fetchMessages({
        data: {
          limit: PAGE_SIZE,
          before: pageParam ?? undefined,
        },
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) =>
      (lastPage as { nextCursor: string | null }).nextCursor ?? undefined,
    refetchInterval: 15_000,
    retry: false,
  });

  const send = useMutation({
    mutationFn: async ({ text, file }: { text: string; file: File | null }) => {
      if (file) {
        const dataBase64 = await fileToBase64(file);
        return sendAttachment({
          data: {
            filename: file.name,
            mime: file.type || "application/octet-stream",
            dataBase64,
            caption: text || undefined,
          },
        });
      }
      return sendMessage({ data: { text } });
    },
    onSuccess: () => {
      setDraft("");
      setAttachment(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      toast.success("Sent to your Telegram");
      qc.invalidateQueries({ queryKey: ["my-tg-inbox"] });
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Failed to send"),
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (send.isPending) return;
    if (!text && !attachment) return;
    send.mutate({ text, file: attachment });
  };

  const onPickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    if (!file) return;
    if (file.size > MAX_ATTACHMENT_BYTES) {
      toast.error("File too large (max 10 MB)");
      e.target.value = "";
      return;
    }
    setAttachment(file);
  };

  // Pages come newest-page-first (page0 = newest 50, page1 = older 50, ...).
  // Each page.messages is oldest->newest within the page.
  // To render oldest -> newest overall, reverse the pages then flatten.
  const messages: TgMessage[] = (q.data?.pages ?? [])
    .slice()
    .reverse()
    .flatMap((p: any) => p.messages as TgMessage[]);
  const errMsg = q.error instanceof Error ? q.error.message : "";

  // Stick to bottom on first load.
  useLayoutEffect(() => {
    if (initialScrolledRef.current) return;
    if (!scrollRef.current || messages.length === 0) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    initialScrolledRef.current = true;
  }, [messages.length]);

  // Preserve scroll position when prepending older messages.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el || prevScrollHeightRef.current == null) return;
    el.scrollTop = el.scrollHeight - prevScrollHeightRef.current;
    prevScrollHeightRef.current = null;
  }, [messages.length]);

  // Scroll-up sentinel: load older when it becomes visible.
  useEffect(() => {
    const sentinel = topSentinelRef.current;
    const root = scrollRef.current;
    if (!sentinel || !root) return;
    const io = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (
          entry?.isIntersecting &&
          q.hasNextPage &&
          !q.isFetchingNextPage &&
          initialScrolledRef.current
        ) {
          prevScrollHeightRef.current = root.scrollHeight;
          q.fetchNextPage();
        }
      },
      { root, rootMargin: "80px 0px 0px 0px", threshold: 0 },
    );
    io.observe(sentinel);
    return () => io.disconnect();
  }, [q.hasNextPage, q.isFetchingNextPage, q.fetchNextPage, messages.length]);

  return (
    <div className="rounded-2xl border-2 border-sky-500/40 bg-gradient-to-b from-sky-950/20 via-black/70 to-black overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-white/10">
        <div className="flex items-center gap-2 min-w-0">
          <MessageSquare className="h-4 w-4 text-sky-300 shrink-0" />
          <h2 className="text-sm font-bold text-white/95">
            Your Telegram thread
          </h2>
          <span className="text-[10px] uppercase tracking-[0.25em] text-white/45 truncate">
            @{BOT_USERNAME}
          </span>
        </div>
        <button
          type="button"
          onClick={() => q.refetch()}
          className="inline-flex items-center gap-1 rounded-md border border-white/10 px-2 py-1 text-[10px] uppercase tracking-[0.2em] text-white/65 hover:text-white hover:bg-white/5"
          title="Refresh"
        >
          <RefreshCw className={`h-3 w-3 ${q.isFetching ? "animate-spin" : ""}`} />
          Sync
        </button>
      </div>

      <div
        ref={scrollRef}
        className="max-h-[420px] min-h-[200px] overflow-y-auto p-3 space-y-2"
      >
        <div ref={topSentinelRef} />
        {q.isFetchingNextPage && (
          <div className="flex items-center justify-center text-[10px] uppercase tracking-[0.2em] text-white/45 py-2">
            <Loader2 className="mr-2 h-3 w-3 animate-spin" /> Loading older…
          </div>
        )}
        {!q.hasNextPage && messages.length > 0 && !q.isLoading && (
          <div className="text-center text-[10px] uppercase tracking-[0.2em] text-white/30 py-1">
            Start of conversation
          </div>
        )}
        {q.isLoading ? (
          <div className="flex items-center justify-center text-xs text-white/45 py-8">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading messages…
          </div>
        ) : q.isError ? (
          <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
            {errMsg || "Could not load messages."}
          </div>
        ) : messages.length === 0 ? (
          <div className="text-xs text-white/55 text-center py-8 leading-relaxed">
            No messages yet. Send anything to{" "}
            <span className="terminal-mono text-white/80">@{BOT_USERNAME}</span>{" "}
            in Telegram and it will appear here.
          </div>
        ) : (
          messages.map((m) => {
            const isBot = !m.from_username && !m.from_name;
            return (
              <div
                key={m.update_id}
                className={`rounded-lg border px-3 py-2 ${
                  isBot
                    ? "border-sky-500/30 bg-sky-950/20"
                    : "border-white/10 bg-white/[0.03]"
                }`}
              >
                <div className="flex items-center justify-between gap-2 text-[10px] uppercase tracking-[0.2em] text-white/45">
                  <span className="truncate">
                    {isBot ? "Bot" : m.from_name || m.from_username || "you"}
                  </span>
                  <span className="shrink-0">
                    {new Date(m.message_date).toLocaleString()}
                  </span>
                </div>
                <div className="mt-1 text-sm text-white/90 whitespace-pre-wrap break-words">
                  {m.text || <em className="text-white/45">no text</em>}
                </div>
              </div>
            );
          })
        )}
      </div>

      <form
        onSubmit={onSubmit}
        className="border-t border-white/10 p-2 space-y-2"
      >
        {attachment && (
          <div className="flex items-center gap-2 rounded-md border border-sky-500/30 bg-sky-950/20 px-2 py-1.5 text-xs text-white/85">
            <Paperclip className="h-3.5 w-3.5 text-sky-300 shrink-0" />
            <span className="truncate flex-1" title={attachment.name}>
              {attachment.name}
            </span>
            <span className="text-white/45 shrink-0">
              {(attachment.size / 1024).toFixed(0)} KB
            </span>
            <button
              type="button"
              onClick={() => {
                setAttachment(null);
                if (fileInputRef.current) fileInputRef.current.value = "";
              }}
              className="rounded p-0.5 text-white/55 hover:text-white hover:bg-white/10"
              title="Remove"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
        <div className="flex items-end gap-2">
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={onPickFile}
            disabled={send.isPending || q.isError}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={send.isPending || q.isError}
            className="inline-flex items-center justify-center rounded-md border border-white/10 bg-black/40 px-2 py-2 text-white/65 hover:text-white hover:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed"
            title="Attach image or file (max 10 MB)"
          >
            <Paperclip className="h-4 w-4" />
          </button>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={
              attachment
                ? "Add a caption (optional)…"
                : "Send a message to your Telegram (HTML allowed)…"
            }
            disabled={send.isPending || q.isError}
            rows={2}
            className="flex-1 resize-none rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-white/35 focus:outline-none focus:border-sky-400/50"
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                onSubmit(e as unknown as FormEvent);
              }
            }}
          />
          <button
            type="submit"
            disabled={(!draft.trim() && !attachment) || send.isPending || q.isError}
            className="inline-flex items-center gap-1.5 rounded-md bg-sky-500 hover:bg-sky-400 text-black disabled:opacity-40 disabled:cursor-not-allowed px-3 py-2 text-xs font-bold uppercase tracking-[0.2em]"
            title="Send (⌘/Ctrl + Enter)"
          >
            {send.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
            Send
          </button>
        </div>
      </form>
    </div>
  );
}
