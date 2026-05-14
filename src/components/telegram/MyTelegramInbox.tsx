import { useEffect, useLayoutEffect, useRef, useState, type FormEvent } from "react";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, RefreshCw, Send, MessageSquare, Paperclip, X, Check, AlertCircle, Ban, RotateCw } from "lucide-react";
type AttachmentItem = {
  id: string;
  file: File;
  caption: string;
};

type UploadStatus = "pending" | "reading" | "sending" | "sent" | "error" | "cancelled";

type UploadProgress = {
  status: UploadStatus;
  percent?: number; // 0-100, only meaningful for "reading"
  error?: string;
};

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

/**
 * Read a File as base64, reporting progress and supporting cancellation
 * via the supplied FileReader instance (caller can call reader.abort()).
 */
function fileToBase64(
  file: File,
  reader: FileReader,
  onProgress?: (percent: number) => void,
): Promise<string> {
  return new Promise((resolve, reject) => {
    reader.onprogress = (ev) => {
      if (ev.lengthComputable && onProgress) {
        onProgress(Math.min(99, Math.round((ev.loaded / ev.total) * 100)));
      }
    };
    reader.onload = () => {
      onProgress?.(100);
      const result = reader.result as string;
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(reader.error ?? new Error("Read failed"));
    reader.onabort = () => reject(new Error("Cancelled"));
    reader.readAsDataURL(file);
  });
}

class CancelledError extends Error {
  constructor() { super("Cancelled"); }
}

export function MyTelegramInbox() {
  const qc = useQueryClient();
  const fetchMessages = useServerFn(listMyTelegramMessages);
  const sendMessage = useServerFn(sendMyTelegramMessage);
  const sendAttachment = useServerFn(sendMyTelegramAttachment);
  const [draft, setDraft] = useState("");
  const [attachments, setAttachments] = useState<AttachmentItem[]>([]);
  const [progress, setProgress] = useState<Record<string, UploadProgress>>({});
  const [isDragging, setIsDragging] = useState(false);
  const dragDepthRef = useRef(0);
  const cancelledRef = useRef(false);
  const activeReaderRef = useRef<FileReader | null>(null);
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
    mutationFn: async ({ text, items }: { text: string; items: AttachmentItem[] }) => {
      if (items.length === 0) {
        return sendMessage({ data: { text } });
      }
      // Send each file sequentially with its own caption; report per-file status.
      cancelledRef.current = false;
      setProgress(
        Object.fromEntries(items.map((it) => [it.id, { status: "pending" as UploadStatus }])),
      );
      for (const item of items) {
        if (cancelledRef.current) {
          setProgress((prev) => ({ ...prev, [item.id]: { status: "cancelled" } }));
          continue;
        }
        setProgress((prev) => ({ ...prev, [item.id]: { status: "reading", percent: 0 } }));
        try {
          const reader = new FileReader();
          activeReaderRef.current = reader;
          const dataBase64 = await fileToBase64(item.file, reader, (percent) => {
            setProgress((prev) =>
              prev[item.id]?.status === "reading"
                ? { ...prev, [item.id]: { status: "reading", percent } }
                : prev,
            );
          });
          activeReaderRef.current = null;
          if (cancelledRef.current) throw new CancelledError();
          setProgress((prev) => ({ ...prev, [item.id]: { status: "sending" } }));
          await sendAttachment({
            data: {
              filename: item.file.name,
              mime: item.file.type || "application/octet-stream",
              dataBase64,
              caption: item.caption.trim() || undefined,
            },
          });
          if (cancelledRef.current) {
            // The send already left the browser; mark cancelled but keep moving.
            setProgress((prev) => ({ ...prev, [item.id]: { status: "cancelled" } }));
            continue;
          }
          setProgress((prev) => ({ ...prev, [item.id]: { status: "sent" } }));
        } catch (err) {
          activeReaderRef.current = null;
          if (err instanceof CancelledError || cancelledRef.current) {
            setProgress((prev) => ({ ...prev, [item.id]: { status: "cancelled" } }));
            continue;
          }
          const msg = err instanceof Error ? err.message : "Failed";
          setProgress((prev) => ({ ...prev, [item.id]: { status: "error", error: msg } }));
          throw err;
        }
      }
      if (cancelledRef.current) {
        throw new CancelledError();
      }
      // Send trailing text as a separate message (if provided alongside attachments).
      if (text) {
        await sendMessage({ data: { text } });
      }
      return { ok: true };
    },
    onSuccess: () => {
      setDraft("");
      setAttachments([]);
      setProgress({});
      if (fileInputRef.current) fileInputRef.current.value = "";
      toast.success("Sent to your Telegram");
      qc.invalidateQueries({ queryKey: ["my-tg-inbox"] });
    },
    onError: (e: unknown) => {
      if (e instanceof CancelledError) {
        toast.message("Upload cancelled");
      } else {
        toast.error(e instanceof Error ? e.message : "Failed to send");
      }
    },
  });

  const cancelUpload = () => {
    cancelledRef.current = true;
    try { activeReaderRef.current?.abort(); } catch { /* noop */ }
  };

  // Re-upload only the specified attachment ids (used for "Retry").
  const retry = useMutation({
    mutationFn: async (ids: string[]) => {
      const items = attachments.filter((a) => ids.includes(a.id));
      if (items.length === 0) return { ok: true, retriedIds: [] as string[] };
      cancelledRef.current = false;
      setProgress((prev) => ({
        ...prev,
        ...Object.fromEntries(items.map((it) => [it.id, { status: "pending" as UploadStatus }])),
      }));
      const succeeded: string[] = [];
      for (const item of items) {
        if (cancelledRef.current) {
          setProgress((prev) => ({ ...prev, [item.id]: { status: "cancelled" } }));
          continue;
        }
        setProgress((prev) => ({ ...prev, [item.id]: { status: "reading", percent: 0 } }));
        try {
          const reader = new FileReader();
          activeReaderRef.current = reader;
          const dataBase64 = await fileToBase64(item.file, reader, (percent) => {
            setProgress((prev) =>
              prev[item.id]?.status === "reading"
                ? { ...prev, [item.id]: { status: "reading", percent } }
                : prev,
            );
          });
          activeReaderRef.current = null;
          if (cancelledRef.current) throw new CancelledError();
          setProgress((prev) => ({ ...prev, [item.id]: { status: "sending" } }));
          await sendAttachment({
            data: {
              filename: item.file.name,
              mime: item.file.type || "application/octet-stream",
              dataBase64,
              caption: item.caption.trim() || undefined,
            },
          });
          setProgress((prev) => ({ ...prev, [item.id]: { status: "sent" } }));
          succeeded.push(item.id);
        } catch (err) {
          activeReaderRef.current = null;
          if (err instanceof CancelledError || cancelledRef.current) {
            setProgress((prev) => ({ ...prev, [item.id]: { status: "cancelled" } }));
            continue;
          }
          const msg = err instanceof Error ? err.message : "Failed";
          setProgress((prev) => ({ ...prev, [item.id]: { status: "error", error: msg } }));
        }
      }
      return { ok: true, retriedIds: succeeded };
    },
    onSuccess: ({ retriedIds }) => {
      if (retriedIds.length === 0) return;
      // Drop the now-sent items from the composer; keep any remaining failures/queue.
      setAttachments((prev) => prev.filter((a) => !retriedIds.includes(a.id)));
      setProgress((prev) => {
        const next = { ...prev };
        for (const id of retriedIds) delete next[id];
        return next;
      });
      toast.success(
        retriedIds.length === 1 ? "Resent 1 file" : `Resent ${retriedIds.length} files`,
      );
      qc.invalidateQueries({ queryKey: ["my-tg-inbox"] });
    },
    onError: (e: unknown) => {
      toast.error(e instanceof Error ? e.message : "Retry failed");
    },
  });

  const failedIds = attachments
    .filter((a) => progress[a.id]?.status === "error")
    .map((a) => a.id);
  const isBusy = send.isPending || retry.isPending;

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (send.isPending) return;
    if (!text && attachments.length === 0) return;
    send.mutate({ text, items: attachments });
  };

  const addFiles = (incoming: File[]) => {
    if (incoming.length === 0) return;
    const accepted: AttachmentItem[] = [];
    let rejected = 0;
    for (const f of incoming) {
      if (f.size > MAX_ATTACHMENT_BYTES) {
        rejected++;
        continue;
      }
      accepted.push({
        id: `${f.name}-${f.size}-${f.lastModified}-${Math.random().toString(36).slice(2, 8)}`,
        file: f,
        caption: "",
      });
    }
    if (rejected > 0) {
      toast.error(
        `${rejected} file${rejected > 1 ? "s" : ""} skipped (max 10 MB each)`,
      );
    }
    if (accepted.length > 0) {
      setAttachments((prev) => [...prev, ...accepted]);
    }
  };

  const onPickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    addFiles(files);
    e.target.value = "";
  };

  const removeAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
    setProgress((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const updateCaption = (id: string, caption: string) => {
    setAttachments((prev) =>
      prev.map((a) => (a.id === id ? { ...a, caption } : a)),
    );
  };

  const onDragEnter = (e: React.DragEvent) => {
    if (!Array.from(e.dataTransfer.types ?? []).includes("Files")) return;
    e.preventDefault();
    dragDepthRef.current++;
    setIsDragging(true);
  };
  const onDragOver = (e: React.DragEvent) => {
    if (!Array.from(e.dataTransfer.types ?? []).includes("Files")) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  };
  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) setIsDragging(false);
  };
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    dragDepthRef.current = 0;
    setIsDragging(false);
    const files = e.dataTransfer.files ? Array.from(e.dataTransfer.files) : [];
    if (send.isPending || q.isError) return;
    addFiles(files);
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
    <div
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={`relative rounded-2xl border-2 ${
        isDragging ? "border-sky-300 ring-2 ring-sky-400/40" : "border-sky-500/40"
      } bg-gradient-to-b from-sky-950/20 via-black/70 to-black overflow-hidden transition-colors`}
    >
      {isDragging && (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-sky-950/70 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-2 rounded-xl border-2 border-dashed border-sky-300 px-6 py-4 text-sky-100">
            <Paperclip className="h-6 w-6" />
            <span className="text-xs font-bold uppercase tracking-[0.25em]">
              Drop to attach
            </span>
            <span className="text-[10px] text-sky-200/70">Max 10 MB per file</span>
          </div>
        </div>
      )}
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
        {attachments.length > 0 && (
          <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
            {attachments.map((item) => {
              const p = progress[item.id];
              const status: UploadStatus = p?.status ?? "pending";
              const isActive = status === "reading" || status === "sending";
              const percent = status === "reading" ? p?.percent ?? 0 : status === "sending" ? 100 : 0;
              return (
                <div
                  key={item.id}
                  className={`rounded-md border px-2 py-1.5 ${
                    status === "error"
                      ? "border-rose-500/40 bg-rose-950/20"
                      : status === "cancelled"
                      ? "border-amber-500/40 bg-amber-950/15"
                      : status === "sent"
                      ? "border-emerald-500/40 bg-emerald-950/15"
                      : isActive
                      ? "border-sky-400/60 bg-sky-950/30"
                      : "border-sky-500/30 bg-sky-950/20"
                  }`}
                >
                  <div className="flex items-center gap-2 text-xs text-white/85">
                    {isActive ? (
                      <Loader2 className="h-3.5 w-3.5 text-sky-300 shrink-0 animate-spin" />
                    ) : status === "sent" ? (
                      <Check className="h-3.5 w-3.5 text-emerald-300 shrink-0" />
                    ) : status === "error" ? (
                      <AlertCircle className="h-3.5 w-3.5 text-rose-300 shrink-0" />
                    ) : status === "cancelled" ? (
                      <Ban className="h-3.5 w-3.5 text-amber-300 shrink-0" />
                    ) : (
                      <Paperclip className="h-3.5 w-3.5 text-sky-300 shrink-0" />
                    )}
                    <span className="truncate flex-1" title={item.file.name}>
                      {item.file.name}
                    </span>
                    {isActive && (
                      <span className="text-[10px] uppercase tracking-[0.18em] text-sky-200/80 shrink-0">
                        {status === "reading" ? `${percent}%` : "Sending…"}
                      </span>
                    )}
                    <span className="text-white/45 shrink-0">
                      {(item.file.size / 1024).toFixed(0)} KB
                    </span>
                    {isActive ? (
                      <button
                        type="button"
                        onClick={cancelUpload}
                        className="rounded p-0.5 text-rose-200 hover:text-white hover:bg-rose-500/30"
                        title="Cancel upload"
                      >
                        <Ban className="h-3.5 w-3.5" />
                      </button>
                    ) : status === "error" ? (
                      <>
                        <button
                          type="button"
                          onClick={() => retry.mutate([item.id])}
                          disabled={isBusy}
                          className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] uppercase tracking-[0.18em] text-sky-200 hover:text-white hover:bg-sky-500/20 disabled:opacity-40 disabled:cursor-not-allowed"
                          title="Retry this file"
                        >
                          <RotateCw className="h-3 w-3" />
                          Retry
                        </button>
                        <button
                          type="button"
                          onClick={() => removeAttachment(item.id)}
                          disabled={isBusy}
                          className="rounded p-0.5 text-white/55 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed"
                          title="Remove"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => removeAttachment(item.id)}
                        disabled={isBusy}
                        className="rounded p-0.5 text-white/55 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed"
                        title="Remove"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    value={item.caption}
                    onChange={(e) => updateCaption(item.id, e.target.value)}
                    placeholder="Caption for this file (optional)…"
                    disabled={isBusy}
                    maxLength={1024}
                    className="mt-1 w-full rounded border border-white/10 bg-black/40 px-2 py-1 text-[11px] text-white placeholder:text-white/30 focus:outline-none focus:border-sky-400/50 disabled:opacity-60"
                  />
                  {isActive && (
                    <div className="mt-1 h-1 w-full overflow-hidden rounded bg-white/10">
                      {status === "reading" ? (
                        <div
                          className="h-full bg-sky-400 transition-[width] duration-150"
                          style={{ width: `${percent}%` }}
                        />
                      ) : (
                        <div className="h-full w-1/3 animate-[telegram-bar_1.2s_ease-in-out_infinite] bg-sky-400" />
                      )}
                    </div>
                  )}
                  {status === "error" && p?.error && (
                    <div className="mt-1 text-[10px] text-rose-300/90 truncate" title={p.error}>
                      {p.error}
                    </div>
                  )}
                  {status === "cancelled" && (
                    <div className="mt-1 text-[10px] text-amber-300/90">Cancelled</div>
                  )}
                </div>
              );
            })}
            {failedIds.length > 1 && (
              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  onClick={() => retry.mutate(failedIds)}
                  disabled={isBusy}
                  className="inline-flex items-center gap-1.5 rounded-md border border-sky-400/40 bg-sky-500/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-sky-100 hover:bg-sky-500/25 disabled:opacity-40 disabled:cursor-not-allowed"
                  title="Retry all failed uploads"
                >
                  {retry.isPending ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <RotateCw className="h-3 w-3" />
                  )}
                  Retry {failedIds.length} failed
                </button>
              </div>
            )}
          </div>
        )}
        <div className="flex items-end gap-2">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={onPickFile}
            disabled={send.isPending || q.isError}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={send.isPending || q.isError}
            className="inline-flex items-center justify-center rounded-md border border-white/10 bg-black/40 px-2 py-2 text-white/65 hover:text-white hover:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed"
            title="Attach images or files (max 10 MB each)"
          >
            <Paperclip className="h-4 w-4" />
          </button>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={
              attachments.length > 0
                ? "Optional message to send after the files…"
                : "Send a message to your Telegram (HTML allowed) — drop files anywhere…"
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
            disabled={(!draft.trim() && attachments.length === 0) || send.isPending || q.isError}
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
