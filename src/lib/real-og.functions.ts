import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { type StripeEnv, createStripeClient } from "@/lib/stripe.server";
import { validateReturnUrl } from "@/lib/return-url";

/**
 * One-off £20 Real OG Pass — auto-issues lifetime VIP on payment.
 * Uses inline price_data so no Stripe price lookup is needed.
 */
export const createRealOgCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { returnUrl: string; environment: StripeEnv; customerEmail?: string }) => ({
    returnUrl: validateReturnUrl(d.returnUrl),
    environment: d.environment,
    customerEmail: d.customerEmail,
  }))
  .handler(async ({ data, context }) => {
    const { userId } = context as { userId: string };
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
          unit_amount: 2000,
          product_data: {
            name: "Real OG Pass — Lifetime",
            description: "Forever Real OG status on 0G-PORTAL. One-off £20.",
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
        kind: "real_og",
      },
    } as any);

    return session.client_secret;
  });