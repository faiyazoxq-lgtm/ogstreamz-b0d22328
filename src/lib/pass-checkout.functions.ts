import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { type StripeEnv, createStripeClient } from "@/lib/stripe.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { rejectBoss } from "@/integrations/supabase/boss-middleware";
import { validateReturnUrl } from "@/lib/return-url";
import { notifyBossOfStreamRequest } from "@/lib/stream-credential-bot.server";

let _admin: any = null;
function admin() {
  if (!_admin) {
    _admin = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
  }
  return _admin;
}

const UUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

export const createPassCheckoutSession = createServerFn({ method: "POST" })
  .middleware([rejectBoss])
  .inputValidator((data: {
    productId: string;
    userId?: string;
    customerEmail?: string;
    returnUrl: string;
    environment: StripeEnv;
  }) => {
    if (!UUID.test(data.productId)) throw new Error("Invalid productId");
    if (data.environment !== "sandbox" && data.environment !== "live") throw new Error("Invalid env");
    return { ...data, returnUrl: validateReturnUrl(data.returnUrl) };
  })
  .handler(async ({ data, context }) => {
    // Always bind the session to the authenticated user; ignore client userId
    // unless it matches (kept as a defensive cross-check).
    const userId = context.userId;
    if (data.userId && data.userId !== userId) {
      throw new Response("Forbidden: userId mismatch", { status: 403 });
    }
    const { data: product, error } = await admin()
      .from("store_products")
      .select("id, sku, kind, title, description, price_cents, currency, duration_days, active")
      .eq("id", data.productId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!product || !product.active) throw new Error("Product not available");
    if (product.kind !== "vip_pass" && product.kind !== "streams_pass") {
      throw new Error("This product is not purchasable here");
    }
    if (!product.duration_days || product.duration_days <= 0) {
      throw new Error("Product missing duration");
    }

    const stripe = createStripeClient(data.environment);

    // Resolve a Customer with userId metadata so later searches work.
    let customerId: string | undefined;
    const found = await stripe.customers.search({
      query: `metadata['userId']:'${userId}'`,
      limit: 1,
    });
    if (found.data.length) {
      customerId = found.data[0].id;
    } else if (data.customerEmail) {
      const list = await stripe.customers.list({ email: data.customerEmail, limit: 1 });
      if (list.data.length) {
        customerId = list.data[0].id;
        if (list.data[0].metadata?.userId !== userId) {
          await stripe.customers.update(customerId, {
            metadata: { ...list.data[0].metadata, userId },
          });
        }
      }
    }
    if (!customerId) {
      const created = await stripe.customers.create({
        ...(data.customerEmail && { email: data.customerEmail }),
        metadata: { userId },
      });
      customerId = created.id;
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "payment",
      ui_mode: "embedded_page",
      return_url: data.returnUrl,
      line_items: [{
        quantity: 1,
        price_data: {
          currency: (product.currency || "usd").toLowerCase(),
          unit_amount: product.price_cents,
          product_data: {
            name: product.title,
            ...(product.description && { description: String(product.description).slice(0, 500) }),
          },
        },
      }],
      managed_payments: { enabled: true },
      metadata: {
        userId,
        kind: product.kind,
        productId: product.id,
        sku: product.sku,
        durationDays: String(product.duration_days),
      },
    } as any);

    // Pre-payment heads-up to the boss the moment a streams-pass checkout
    // is opened. Best-effort — never block the checkout if Telegram is down.
    if (product.kind === "streams_pass") {
      const placeholderId = (session as any)?.id ?? "pending-" + Date.now();
      // We don't have a pass_orders row yet (created on webhook), so send a
      // lightweight notification keyed by the Stripe session id.
      void (async () => {
        try {
          // Insert a provisional pass_orders row so the boss can see it
          // immediately; webhook upsert later flips status to pending_approval.
          const { data: row } = await admin()
            .from("pass_orders")
            .upsert(
              {
                user_id: userId,
                product_id: product.id,
                kind: product.kind,
                duration_days: product.duration_days,
                amount_cents: product.price_cents,
                currency: (product.currency || "usd").toLowerCase(),
                stripe_session_id: placeholderId,
                environment: data.environment,
                status: "checkout_opened",
              },
              { onConflict: "stripe_session_id" },
            )
            .select("id")
            .maybeSingle();
          if (row?.id) await notifyBossOfStreamRequest(row.id as string);
        } catch (e) {
          console.error("notifyBossOfStreamRequest failed", e);
        }
      })();
    }

    return session.client_secret;
  });