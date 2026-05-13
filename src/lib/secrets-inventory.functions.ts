import { createServerFn } from "@tanstack/react-start";
import { requireBoss } from "@/integrations/supabase/boss-middleware";

/**
 * Server-only catalogue of platform-managed runtime secret names.
 *
 * Lives in a `.functions.ts` file behind a Boss-gated server function so
 * the inventory strings (e.g. LOVABLE_API_KEY, PERPLEXITY_API_KEY) are
 * never bundled into client JS — they only travel over the wire as a JSON
 * payload after the Boss/Admin check passes.
 *
 * Values are NEVER returned here — only metadata (name, purpose, tags).
 */

export type SecretsInventoryTag = "managed" | "connector" | "boss" | "config";
export type SecretsInventoryEntry = {
  name: string;
  purpose: string;
  tags: SecretsInventoryTag[];
};
export type SecretsInventorySection = {
  id: string;
  label: string;
  iconKey: "webhook" | "key" | "settings";
  tint: string;
  blurb: string;
  entries: SecretsInventoryEntry[];
};

const SECTIONS: SecretsInventorySection[] = [
  {
    id: "webhook-secrets",
    label: "Webhook & Hook Secrets",
    iconKey: "webhook",
    tint: "#a855f7",
    blurb:
      "Shared secrets that verify inbound callbacks and cron pings. Never expose to the browser — server-side only.",
    entries: [
      { name: "PAYMENTS_LIVE_WEBHOOK_SECRET", purpose: "Verifies live Stripe webhook signatures.", tags: ["managed"] },
      { name: "PAYMENTS_SANDBOX_WEBHOOK_SECRET", purpose: "Verifies sandbox Stripe webhook signatures.", tags: ["managed"] },
      { name: "SUNO_WEBHOOK_SECRET", purpose: "Validates ?secret= on Suno callback URL.", tags: [] },
      { name: "REMINDER_HOOK_SECRET", purpose: "Validates x-hook-secret on Telegram reminder cron.", tags: [] },
      { name: "SYNDICATE_TICK_SECRET", purpose: "Validates the Syndicate tick cron endpoint.", tags: [] },
    ],
  },
  {
    id: "api-keys",
    label: "API Keys (Third-Party)",
    iconKey: "key",
    tint: "#ffd166",
    blurb:
      "Outbound credentials for third-party services. Connector-managed keys can only be edited from Connectors.",
    entries: [
      { name: "LOVABLE_API_KEY", purpose: "Lovable AI Gateway (Gemini/GPT/etc).", tags: ["managed"] },
      { name: "GOOGLE_AI_STUDIO_API_KEY", purpose: "Google Gemini direct API.", tags: [] },
      { name: "PERPLEXITY_API_KEY", purpose: "Perplexity research/search.", tags: ["connector"] },
      { name: "FIRECRAWL_API_KEY", purpose: "Firecrawl scraping.", tags: ["connector"] },
      { name: "TELEGRAM_API_KEY", purpose: "Telegram bot send/receive.", tags: ["connector"] },
      { name: "SUNO_API_KEY", purpose: "Suno music generation.", tags: [] },
      { name: "SHAPES_API_KEY", purpose: "Shapes inference API.", tags: [] },
      { name: "APOLLO_API_KEY", purpose: "Apollo lead enrichment.", tags: [] },
      { name: "INSTANTLY_API_KEY", purpose: "Instantly outbound sequencing.", tags: [] },
      { name: "STRIPE_LIVE_API_KEY", purpose: "Live Stripe secret key for payments.", tags: ["managed"] },
      { name: "STRIPE_SANDBOX_API_KEY", purpose: "Sandbox Stripe secret key for test payments.", tags: ["managed"] },
    ],
  },
  {
    id: "config",
    label: "Config & Identity",
    iconKey: "settings",
    tint: "#94a3b8",
    blurb:
      "Non-credential runtime values. Not sensitive on their own but live in the same store.",
    entries: [
      { name: "BOSS_EMAIL", purpose: "Email used to bootstrap the Boss role.", tags: ["boss"] },
      { name: "STREAM_SERVER_URL", purpose: "Default streaming server endpoint.", tags: ["config"] },
      { name: "VAULT_PORTAL_DOMAIN", purpose: "Public domain for VIP / vault portals.", tags: ["config"] },
    ],
  },
];

export const listSecretsInventory = createServerFn({ method: "GET" })
  .middleware([requireBoss])
  .handler(async (): Promise<{ sections: SecretsInventorySection[] }> => {
    return { sections: SECTIONS };
  });
