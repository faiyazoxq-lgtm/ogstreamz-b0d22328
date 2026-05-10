import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import {
  type StripeEnv,
  createStripeClient,
  verifyWebhook,
} from "@/lib/stripe.server";
import { CREDIT_PACKS } from "@/lib/credit-packs";

let _supabase: any = null;
function getSupabase(): any {
  if (!_supabase) {
    _supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
  }
  return _supabase;
}

function priceIdFromItem(item: any): string | null {
  return (
    item?.price?.lookup_key ||
    item?.price?.metadata?.lovable_external_id ||
    item?.price?.id ||
    null
  );
}

async function handleCheckoutCompleted(session: any, env: StripeEnv) {
  // Only handle one-time payments here. Subscriptions go through customer.subscription.*
  if (session.mode !== "payment") return;
  if (session.payment_status !== "paid") return;

  const userId: string | undefined = session.metadata?.userId;
  if (!userId) {
    console.error("checkout.session.completed missing metadata.userId", session.id);
    return;
  }

  // Track unlock flow — uses inline price_data, no lookup_key.
  if (session.metadata?.kind === "track_unlock" && session.metadata?.trackId) {
    const trackId = session.metadata.trackId as string;
    const amount = Number(session.amount_total ?? 0);
    const { error } = await getSupabase().from("track_purchases").upsert({
      user_id: userId,
      track_id: trackId,
      stripe_session_id: session.id,
      amount_cents: amount,
      currency: (session.currency || "usd").toLowerCase(),
      environment: env,
    }, { onConflict: "stripe_session_id" });
    if (error) console.error("track_purchases upsert failed", error);
    else console.log("Track unlocked", { userId, trackId, amount });
    return;
  }

  // VIP portal unlock — uses inline price_data, no lookup_key.
  if (session.metadata?.kind === "portal_vip" && session.metadata?.portalId) {
    const portalId = session.metadata.portalId as string;
    const amount = Number(session.amount_total ?? 0);
    const { error } = await getSupabase().from("portal_unlocks").upsert({
      user_id: userId,
      portal_id: portalId,
      stripe_session_id: session.id,
      amount_cents: amount,
      currency: (session.currency || "usd").toLowerCase(),
      environment: env,
    }, { onConflict: "stripe_session_id" });
    if (error) console.error("portal_unlocks upsert failed", error);
    else console.log("Portal VIP unlocked", { userId, portalId, amount });
    return;
  }

  // Real OG lifetime pass — auto-issue.
  if (session.metadata?.kind === "real_og") {
    const amount = Number(session.amount_total ?? 0);
    const { data, error } = await getSupabase().rpc("claim_real_og_pass", {
      _user_id: userId,
      _stripe_session_id: session.id,
      _amount_cents: amount,
      _currency: (session.currency || "gbp").toLowerCase(),
      _environment: env,
    });
    if (error) {
      console.error("claim_real_og_pass failed", error);
      throw error;
    }
    console.log("Real OG pass issued", { userId, result: data });
    return;
  }

  // VIP / Streams passes — record a pending_approval order; boss approves.
  if (session.metadata?.kind === "vip_pass" || session.metadata?.kind === "streams_pass") {
    const productId = session.metadata?.productId as string | undefined;
    const durationDays = Number(session.metadata?.durationDays ?? 0);
    if (!productId || !durationDays) {
      console.error("Pass order missing productId/durationDays", session.id);
      return;
    }
    const amount = Number(session.amount_total ?? 0);
    const { error } = await getSupabase()
      .from("pass_orders")
      .upsert({
        user_id: userId,
        product_id: productId,
        kind: session.metadata.kind,
        duration_days: durationDays,
        amount_cents: amount,
        currency: (session.currency || "usd").toLowerCase(),
        stripe_session_id: session.id,
        stripe_payment_intent: session.payment_intent ?? null,
        environment: env,
        status: "pending_approval",
      }, { onConflict: "stripe_session_id" });
    if (error) console.error("pass_orders upsert failed", error);
    else console.log("Pass order recorded", { userId, kind: session.metadata.kind, productId });
    return;
  }

  // Re-fetch the session with line items expanded so we can read lookup_key.
  const stripe = createStripeClient(env);
  const full = await stripe.checkout.sessions.retrieve(session.id, {
    expand: ["line_items.data.price"],
  });
  const item = (full as any).line_items?.data?.[0];
  const priceId = priceIdFromItem(item) || (session.metadata?.priceId ?? null);
  if (!priceId) {
    console.error("Could not resolve priceId for session", session.id);
    return;
  }

  const pack = CREDIT_PACKS[priceId];
  if (!pack || pack.credits == null) {
    console.warn("No credit grant configured for priceId", priceId);
    return;
  }

  const { data, error } = await getSupabase().rpc("apply_credit_purchase", {
    _user_id: userId,
    _stripe_session_id: session.id,
    _price_id: priceId,
    _credits: pack.credits,
    _amount_cents: pack.amountCents,
    _currency: (session.currency || "usd").toLowerCase(),
    _environment: env,
  });
  if (error) {
    console.error("apply_credit_purchase failed", error);
    throw error;
  }
  console.log("Granted credits", { userId, priceId, credits: pack.credits, applied: data });
}

async function upsertSubscription(subscription: any, env: StripeEnv) {
  const userId: string | undefined =
    subscription.metadata?.userId ?? undefined;
  if (!userId) {
    console.error("subscription event missing metadata.userId", subscription.id);
    return;
  }
  const item = subscription.items?.data?.[0];
  const priceId = priceIdFromItem(item) || subscription.metadata?.priceId || "unknown";
  const productId = item?.price?.product ?? null;
  const periodStart =
    item?.current_period_start ?? subscription.current_period_start ?? null;
  const periodEnd =
    item?.current_period_end ?? subscription.current_period_end ?? null;

  await getSupabase()
    .from("subscriptions")
    .upsert(
      {
        user_id: userId,
        stripe_subscription_id: subscription.id,
        stripe_customer_id: subscription.customer,
        product_id: productId,
        price_id: priceId,
        status: subscription.status,
        current_period_start: periodStart
          ? new Date(periodStart * 1000).toISOString()
          : null,
        current_period_end: periodEnd
          ? new Date(periodEnd * 1000).toISOString()
          : null,
        cancel_at_period_end: subscription.cancel_at_period_end || false,
        environment: env,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "stripe_subscription_id" },
    );

  // Reflect VIP status on the profile.
  const isActive = ["active", "trialing"].includes(subscription.status);
  await getSupabase()
    .from("profiles")
    .update({ status: isActive ? "vip" : "free", updated_at: new Date().toISOString() })
    .eq("id", userId);
}

async function handleSubscriptionDeleted(subscription: any, env: StripeEnv) {
  await getSupabase()
    .from("subscriptions")
    .update({
      status: "canceled",
      cancel_at_period_end: true,
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_subscription_id", subscription.id)
    .eq("environment", env);

  const userId: string | undefined = subscription.metadata?.userId;
  if (userId) {
    await getSupabase()
      .from("profiles")
      .update({ status: "free", updated_at: new Date().toISOString() })
      .eq("id", userId);
  }
}

async function handleWebhook(req: Request, env: StripeEnv) {
  const event = await verifyWebhook(req, env);
  switch (event.type) {
    case "checkout.session.completed":
      await handleCheckoutCompleted(event.data.object, env);
      break;
    case "customer.subscription.created":
    case "customer.subscription.updated":
      await upsertSubscription(event.data.object, env);
      break;
    case "customer.subscription.deleted":
      await handleSubscriptionDeleted(event.data.object, env);
      break;
    default:
      console.log("Unhandled event type:", event.type);
  }
}

export const Route = createFileRoute("/api/public/payments/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rawEnv = new URL(request.url).searchParams.get("env");
        if (rawEnv !== "sandbox" && rawEnv !== "live") {
          console.error("Webhook missing/invalid env query param:", rawEnv);
          return Response.json({ received: true, ignored: "invalid env" });
        }
        try {
          await handleWebhook(request, rawEnv);
          return Response.json({ received: true });
        } catch (e) {
          console.error("Webhook error:", e);
          return new Response("Webhook error", { status: 400 });
        }
      },
    },
  },
});