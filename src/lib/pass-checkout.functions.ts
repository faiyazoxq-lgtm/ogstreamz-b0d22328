import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { type StripeEnv, createStripeClient } from "@/lib/stripe.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { validateReturnUrl } from "@/lib/return-url";

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
  .middleware([requireSupabaseAuth])
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

    return session.client_secret;
  });