import { Link } from "@tanstack/react-router";
import { Send, ExternalLink } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { MyTelegramInbox } from "@/components/telegram/MyTelegramInbox";

/**
 * Top-nav entry point for the user's personal Telegram thread.
 * Opens the full inbox + composer (text + attachments) in a popover so
 * users can DM `@Ogstreamzbot` from any page.
 *
 * The underlying server fns require a linked Telegram chat — if the user
 * has not linked yet, the inbox surfaces an error and the footer CTA
 * deep-links them to /connect-telegram.
 */
export function TelegramNavButton() {
  return (
    <Popover>
      <PopoverTrigger
        aria-label="Open Telegram inbox"
        className="relative inline-flex items-center gap-1.5 rounded-full border border-sky-500/40 bg-sky-500/10 hover:bg-sky-500/20 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-sky-200 hover:text-sky-100 transition-colors outline-none focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        title="Message your Telegram"
      >
        <Send className="h-4 w-4" />
        <span className="hidden md:inline">Telegram</span>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={10}
        className="w-[min(92vw,420px)] p-0 border-sky-500/30 bg-transparent shadow-[0_20px_60px_-20px_rgba(56,189,248,0.5)]"
      >
        <MyTelegramInbox />
        <div className="border-t border-white/10 bg-black/70 px-3 py-2 flex items-center justify-between text-[10px] uppercase tracking-[0.2em] text-white/55">
          <span>Direct line to @Ogstreamzbot</span>
          <Link
            to="/connect-telegram"
            className="inline-flex items-center gap-1 text-sky-300 hover:text-sky-100"
          >
            Manage <ExternalLink className="h-3 w-3" />
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}