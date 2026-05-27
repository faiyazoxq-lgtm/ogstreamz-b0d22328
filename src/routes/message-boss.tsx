import { createFileRoute } from "@tanstack/react-router";
import { MessageBossForm } from "@/components/MessageBossForm";

export const Route = createFileRoute("/message-boss")({
  head: () => ({
    meta: [
      { title: "Message the Boss · 0G-STREAMZ" },
      {
        name: "description",
        content:
          "Signed-in members can send the Boss a direct message — delivered straight to the boss Telegram chat.",
      },
    ],
  }),
  component: MessageBossPage,
});

function MessageBossPage() {
  return (
    <div className="mx-auto w-full max-w-xl space-y-5 p-4 md:p-6">
      <header className="glass-obsidian-cmd rounded-3xl p-5 md:p-6">
        <p
          className="text-[10px] uppercase tracking-[0.4em] terminal-mono"
          style={{ color: "#ffd166" }}
        >
          0G · Direct Line
        </p>
        <h1 className="syndicate-header text-2xl md:text-3xl text-white/95 mt-1">
          Message the Boss
        </h1>
        <p className="mt-2 text-sm text-white/60">
          Anything you'd normally ping over Telegram — orders, requests,
          questions, problems — type it here and it lands in the Boss's chat.
        </p>
      </header>

      <MessageBossForm />
    </div>
  );
}