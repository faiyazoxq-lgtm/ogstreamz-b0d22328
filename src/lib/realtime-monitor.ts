import type { RealtimeChannel } from "@supabase/supabase-js";
import { logRealtimeDenial } from "@/lib/realtime-monitor.functions";

/**
 * Wrap a Supabase Realtime channel and report denied / errored
 * subscriptions to the server-side audit log so Boss can investigate.
 *
 *   const ch = supabase.channel("suno-jobs-" + uid).on(...).subscribe();
 *   monitorChannel(ch, "suno-jobs-" + uid, { userId: uid });
 */
export function monitorChannel(
  channel: RealtimeChannel,
  topic: string,
  opts: { userId?: string | null; metadata?: Record<string, unknown> } = {},
) {
  // Re-bind subscribe so we capture status without disturbing existing usage.
  const orig = channel.subscribe.bind(channel);
  channel.subscribe = ((cb?: Parameters<RealtimeChannel["subscribe"]>[0]) =>
    orig((status, err) => {
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
        // Fire-and-forget — don't block UI on the audit write.
        void logRealtimeDenial({
          data: {
            topic,
            status,
            reason: err?.message ?? null,
            userId: opts.userId ?? null,
            metadata: opts.metadata,
          },
        }).catch(() => {
          /* swallow — monitoring must never break the app */
        });
      }
      cb?.(status, err);
    })) as RealtimeChannel["subscribe"];

  return channel;
}