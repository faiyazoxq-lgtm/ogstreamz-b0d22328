import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { type StripeEnv, createStripeClient } from "@/lib/stripe.server";
import { REAL_OG_BUNDLES } from "@/lib/real-og-bundles";
import { validateReturnUrl } from "@/lib/return-url";

/**
 * Bundle checkout: Real OG Pass + coin pack at a discounted single price.
 * Inline price_data so we don't depend on Stripe-side product setup.
 * Webhook reads metadata.kind="real_og_bundle" + bundleSku + credits to
 * issue the OG pass AND grant coins atomically.
 */
export const createRealOgBundleCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { sku: string; returnUrl: string; environment: StripeEnv; customerEmail?: string }) => ({
    sku: String(d.sku || ""),
    returnUrl: validateReturnUrl(d.returnUrl),
    environment: d.environment,
    customerEmail: d.customerEmail,
  }))
  .handler(async ({ data, context }) => {
    const { userId } = context as { userId: string };
    const bundle = REAL_OG_BUNDLES.find((b) => b.sku === data.sku);
    if (!bundle) throw new Error("Unknown bundle sku");

    const stripe = createStripeClient(data.environment);

    let customerId: string | undefined;
    if (userId) {
      const found = await stripe.customers.search({
        query: `metadata['userId']:'${userId}'`,
        limit: 1,
      });
      if (found.data.length) customerId = found.data[0].id;
      else {
        const created = await stripe.customers.create({
          ...(data.customerEmail && { email: data.customerEmail }),
          metadata: { userId },
        });
        customerId = created.id;
      }
    }

    const session = await stripe.checkout.sessions.create({
      line_items: [{
        price_data: {
          currency: "gbp",
          unit_amount: bundle.amountCents,
          product_data: {
            name: `${bundle.name} — Bundle`,
            description: `Lifetime Real OG Pass + ${bundle.credits} Coins. ${bundle.tagline}`,
            tax_code: "txcd_10000000",
          },
        },
        quantity: 1,
      }],
      mode: "payment",
      ui_mode: "embedded_page",
      return_url: data.returnUrl,
      ...(customerId && { customer: customerId }),
      managed_payments: { enabled: true },
      metadata: {
        userId,
        kind: "real_og_bundle",
        bundleSku: bundle.sku,
        credits: String(bundle.credits),
      },
    } as any);

    return session.client_secret;
  });