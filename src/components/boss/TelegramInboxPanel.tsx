import { useMemo, useState, type FormEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, RefreshCw, Send, Users, User, Megaphone, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import {
  listTelegramChats,
  listTelegramMessages,
  sendTelegramReply,
  type TgChatSummary,
  type TgMessage,
} from "@/lib/telegram-inbox.functions";

function ChatTypeIcon({ type, className }: { type: string | null; className?: string }) {
  if (type === "group" || type === "supergroup") return <Users className={className} />;
  if (type === "channel") return <Megaphone className={className} />;
  return <User className={className} />;
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.round(diff / 60000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d}d`;
  return new Date(iso).toLocaleDateString();
}

export function TelegramInboxPanel() {
  const qc = useQueryClient();
  const fetchChats = useServerFn(listTelegramChats);
  const fetchMessages = useServerFn(listTelegramMessages);
  const sendReply = useServerFn(sendTelegramReply);

  const [activeChatId, setActiveChatId] = useState<number | null>(null);
  const [draft, setDraft] = useState("");

  const chatsQuery = useQuery({
    queryKey: ["tg-inbox", "chats"],
    queryFn: () => fetchChats({}),
    refetchInterval: 30_000,
  });

  const chats: TgChatSummary[] = chatsQuery.data?.chats ?? [];

  // Auto-select the most recent chat once data loads.
  if (activeChatId === null && chats.length > 0) {
    setActiveChatId(chats[0].chat_id);
  }

  const messagesQuery = useQuery({
    queryKey: ["tg-inbox", "messages", activeChatId],
    queryFn: () =>
      fetchMessages({ data: { chatId: activeChatId as number, limit: 200 } }),
    enabled: activeChatId !== null,
    refetchInterval: 15_000,
  });

  const messages: TgMessage[] = messagesQuery.data?.messages ?? [];
  const activeChat = useMemo(
    () => chats.find((c) => c.chat_id === activeChatId) ?? null,
    [chats, activeChatId],
  );

  const sendMutation = useMutation({
    mutationFn: (text: string) =>
      sendReply({ data: { chatId: activeChatId as number, text } }),
    onSuccess: () => {
      setDraft("");
      toast.success("Reply sent");
      qc.invalidateQueries({ queryKey: ["tg-inbox", "messages", activeChatId] });
      qc.invalidateQueries({ queryKey: ["tg-inbox", "chats"] });
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Failed to send"),
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text || activeChatId === null || sendMutation.isPending) return;
    sendMutation.mutate(text);
  };

  const refreshAll = () => {
    qc.invalidateQueries({ queryKey: ["tg-inbox"] });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-3 min-h-[420px]">
      {/* Chats list */}
      <div className="rounded-2xl border border-white/10 bg-black/30 overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
          <span className="text-[10px] uppercase tracking-[0.25em] terminal-mono text-white/55">
            Chats · {chats.length}
          </span>
          <button
            type="button"
            onClick={refreshAll}
            className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.2em] text-white/55 hover:text-white"
            title="Refresh"
          >
            <RefreshCw
              className={`h-3 w-3 ${
                chatsQuery.isFetching ? "animate-spin" : ""
              }`}
            />
            Sync
          </button>
        </div>
        <div className="flex-1 overflow-y-auto max-h-[420px]">
          {chatsQuery.isLoading ? (
            <div className="p-4 text-center text-xs text-white/45">
              <Loader2 className="mx-auto mb-2 h-4 w-4 animate-spin" />
              Loading chats…
            </div>
          ) : chatsQuery.error ? (
            <div className="p-4 text-xs text-destructive">
              {(chatsQuery.error as Error).message}
            </div>
          ) : chats.length === 0 ? (
            <div className="p-4 text-xs text-white/55 leading-relaxed">
              No messages yet. Send <code>/start</code> to your bot in
              Telegram, or add the bot to a group, then click Sync.
            </div>
          ) : (
            <ul className="divide-y divide-white/5">
              {chats.map((c) => {
                const active = c.chat_id === activeChatId;
                return (
                  <li key={c.chat_id}>
                    <button
                      type="button"
                      onClick={() => setActiveChatId(c.chat_id)}
                      className={`w-full text-left px-3 py-2.5 transition flex gap-2 items-start ${
                        active
                          ? "bg-white/10"
                          : "hover:bg-white/5"
                      }`}
                    >
                      <ChatTypeIcon
                        type={c.chat_type}
                        className="mt-0.5 h-4 w-4 text-white/60 shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-sm font-semibold text-white/95">
                            {c.chat_title || `Chat ${c.chat_id}`}
                          </span>
                          <span className="text-[10px] text-white/45 shrink-0">
                            {relativeTime(c.last_date)}
                          </span>
                        </div>
                        <div className="truncate text-xs text-white/55">
                          {c.last_from ? (
                            <span className="text-white/70">{c.last_from}: </span>
                          ) : null}
                          {c.last_text || (
                            <em className="text-white/35">no text</em>
                          )}
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {/* Conversation */}
      <div className="rounded-2xl border border-white/10 bg-black/30 overflow-hidden flex flex-col min-h-[420px]">
        <div className="px-3 py-2 border-b border-white/10 flex items-center justify-between gap-2">
          <div className="min-w-0 flex items-center gap-2">
            <ChatTypeIcon
              type={activeChat?.chat_type ?? null}
              className="h-4 w-4 text-white/60 shrink-0"
            />
            <span className="truncate text-sm font-semibold text-white/95">
              {activeChat?.chat_title || (activeChat ? `Chat ${activeChat.chat_id}` : "Select a chat")}
            </span>
            {activeChat?.chat_type && (
              <span className="text-[10px] uppercase tracking-[0.25em] text-white/45">
                {activeChat.chat_type}
              </span>
            )}
          </div>
          {activeChatId !== null && (
            <span className="text-[10px] terminal-mono text-white/45 shrink-0">
              ID {activeChatId}
            </span>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2 max-h-[420px]">
          {activeChatId === null ? (
            <div className="h-full flex items-center justify-center text-xs text-white/45">
              <MessageSquare className="mr-2 h-4 w-4" />
              Pick a conversation on the left
            </div>
          ) : messagesQuery.isLoading ? (
            <div className="flex items-center justify-center text-xs text-white/45 py-6">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading messages…
            </div>
          ) : messages.length === 0 ? (
            <div className="text-xs text-white/45 text-center py-6">
              No messages stored for this chat yet.
            </div>
          ) : (
            messages.map((m) => (
              <div
                key={m.update_id}
                className="rounded-lg border border-white/5 bg-white/[0.03] px-3 py-2"
              >
                <div className="flex items-center justify-between gap-2 text-[10px] uppercase tracking-[0.2em] text-white/45">
                  <span className="truncate">
                    {m.from_name || m.from_username || "unknown"}
                  </span>
                  <span className="shrink-0">
                    {new Date(m.message_date).toLocaleString()}
                  </span>
                </div>
                <div className="mt-1 text-sm text-white/90 whitespace-pre-wrap break-words">
                  {m.text || <em className="text-white/45">no text</em>}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Composer */}
        <form
          onSubmit={onSubmit}
          className="border-t border-white/10 p-2 flex items-end gap-2"
        >
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={
              activeChatId === null
                ? "Select a chat to reply…"
                : "Type a reply (HTML allowed). Bot must be a member of this chat."
            }
            disabled={activeChatId === null || sendMutation.isPending}
            rows={2}
            className="flex-1 resize-none rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-white/35 focus:outline-none focus:border-white/30"
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                onSubmit(e as unknown as FormEvent);
              }
            }}
          />
          <button
            type="submit"
            disabled={
              activeChatId === null || !draft.trim() || sendMutation.isPending
            }
            className="inline-flex items-center gap-1.5 rounded-md bg-white/15 hover:bg-white/25 disabled:opacity-40 disabled:cursor-not-allowed px-3 py-2 text-xs font-bold uppercase tracking-[0.2em] text-white"
            title="Send (⌘/Ctrl + Enter)"
          >
            {sendMutation.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
            Send
          </button>
        </form>
      </div>
    </div>
  );
}