import { createServerFn } from "@tanstack/react-start";
import { type StripeEnv, createStripeClient } from "@/lib/stripe.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { validateReturnUrl } from "@/lib/return-url";

/** Promo config for the one-time first-order discount. */
export const FIRST_ORDER_DISCOUNT = {
  couponId: "first30",
  percentOff: 30,
  label: "FIRST-ORDER 30% OFF",
} as const;

/**
 * True iff the authenticated user has never completed a paid checkout on this
 * account (no credit packs, no subscriptions, no VIP unlocks). Used to gate
 * the first-order discount banner client-side AND re-validated server-side
 * before any coupon is attached.
 */
async function isFirstTimeBuyer(supabase: any, userId: string): Promise<boolean> {
  const tables = ["credit_purchases", "subscriptions", "portal_unlocks", "track_purchases"];
  for (const t of tables) {
    const { data, error } = await supabase.from(t).select("id").eq("user_id", userId).limit(1).maybeSingle();
    if (error) {
      // If a table is missing or RLS blocks, fail closed — no discount.
      console.warn(`[firstOrder] check ${t} failed`, error.message);
      return false;
    }
    if (data) return false;
  }
  return true;
}

export const getFirstOrderEligibility = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const eligible = await isFirstTimeBuyer(supabase, userId);
    return {
      eligible,
      percentOff: FIRST_ORDER_DISCOUNT.percentOff,
      label: FIRST_ORDER_DISCOUNT.label,
    };
  });

/**
 * Idempotently ensure the Stripe coupon used for the first-order discount
 * exists in the target environment. Stripe's `coupons.retrieve` 404s when
 * the coupon is missing, so we catch and create it on demand.
 */
async function ensureFirstOrderCoupon(stripe: ReturnType<typeof createStripeClient>) {
  try {
    return await stripe.coupons.retrieve(FIRST_ORDER_DISCOUNT.couponId);
  } catch {
    return await stripe.coupons.create({
      id: FIRST_ORDER_DISCOUNT.couponId,
      percent_off: FIRST_ORDER_DISCOUNT.percentOff,
      duration: "once",
      name: "First-Order 30% Off",
    });
  }
}

async function resolveOrCreateCustomer(
  stripe: ReturnType<typeof createStripeClient>,
  options: { email?: string; userId?: string },
): Promise<string> {
  if (options.userId && !/^[a-zA-Z0-9_-]+$/.test(options.userId)) {
    throw new Error("Invalid userId");
  }
  if (options.userId) {
    const found = await stripe.customers.search({
      query: `metadata['userId']:'${options.userId}'`,
      limit: 1,
    });
    if (found.data.length) return found.data[0].id;
  }
  if (options.email) {
    const existing = await stripe.customers.list({ email: options.email, limit: 1 });
    if (existing.data.length) {
      const customer = existing.data[0];
      if (options.userId && customer.metadata?.userId !== options.userId) {
        await stripe.customers.update(customer.id, {
          metadata: { ...customer.metadata, userId: options.userId },
        });
      }
      return customer.id;
    }
  }
  const created = await stripe.customers.create({
    ...(options.email && { email: options.email }),
    ...(options.userId && { metadata: { userId: options.userId } }),
  });
  return created.id;
}

export const createCheckoutSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      priceId: string;
      quantity?: number;
      customerEmail?: string;
      userId?: string;
      returnUrl: string;
      environment: StripeEnv;
      applyFirstOrderDiscount?: boolean;
    }) => {
      if (!/^[a-zA-Z0-9_-]+$/.test(data.priceId)) throw new Error("Invalid priceId");
      return { ...data, returnUrl: validateReturnUrl(data.returnUrl) };
    },
  )
  .handler(async ({ data, context }) => {
    // Force the session to belong to the authenticated user — never trust the
    // client-supplied userId for credit/subscription attribution.
    const userId = context.userId;
    if (data.userId && data.userId !== userId) {
      throw new Response("Forbidden: userId mismatch", { status: 403 });
    }
    const stripe = createStripeClient(data.environment);

    const prices = await stripe.prices.list({ lookup_keys: [data.priceId] });
    if (!prices.data.length) throw new Error("Price not found");
    const stripePrice = prices.data[0];
    const isRecurring = stripePrice.type === "recurring";

    const customerId = await resolveOrCreateCustomer(stripe, {
      email: data.customerEmail,
      userId,
    });

    // Re-verify first-order eligibility on the server. The client flag is
    // a hint only — the truth lives in our purchase tables. The discount
    // is one-time-only per account: as soon as ANY purchase row exists,
    // eligibility flips to false on the next checkout creation.
    let discounts: { coupon: string }[] | undefined;
    let firstOrderApplied = false;
    if (data.applyFirstOrderDiscount && !isRecurring) {
      const eligible = await isFirstTimeBuyer(context.supabase, userId);
      if (eligible) {
        await ensureFirstOrderCoupon(stripe);
        discounts = [{ coupon: FIRST_ORDER_DISCOUNT.couponId }];
        firstOrderApplied = true;
      }
    }

    const session = await stripe.checkout.sessions.create({
      line_items: [{ price: stripePrice.id, quantity: data.quantity || 1 }],
      mode: isRecurring ? "subscription" : "payment",
      ui_mode: "embedded_page",
      return_url: data.returnUrl,
      customer: customerId,
      managed_payments: { enabled: true },
      metadata: {
        userId,
        priceId: data.priceId,
        ...(firstOrderApplied && { firstOrderDiscount: "true" }),
      },
      ...(discounts && { discounts }),
      ...(isRecurring && {
        subscription_data: {
          metadata: { userId, priceId: data.priceId },
        },
      }),
    } as any);

    return session.client_secret;
  });

/**
 * Stripe Billing Portal session — lets the user upgrade, downgrade, cancel,
 * resume, update payment method or download invoices in a hosted UI.
 * Returns a one-time URL the client must open in a new tab.
 */
export const createPortalSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { returnUrl?: string; environment: StripeEnv }) => ({
    ...data,
    returnUrl: data.returnUrl ? validateReturnUrl(data.returnUrl) : undefined,
  }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: sub, error } = await supabase
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", userId)
      .eq("environment", data.environment)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !sub?.stripe_customer_id) {
      throw new Error("No subscription found for this account.");
    }

    const stripe = createStripeClient(data.environment);
    const portal = await stripe.billingPortal.sessions.create({
      customer: sub.stripe_customer_id,
      ...(data.returnUrl && { return_url: data.returnUrl }),
    });
    return portal.url;
  });