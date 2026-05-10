import { loadStripe, type Stripe } from "@stripe/stripe-js";

type StripeEnv = "sandbox" | "live";

const clientToken = import.meta.env.VITE_PAYMENTS_CLIENT_TOKEN as string | undefined;
const autoEnv: StripeEnv = clientToken?.startsWith("pk_test_") ? "sandbox" : "live";

// Boss-controlled override loaded from `payments_settings.mode`.
// `null` = no override yet (use auto-detected env).
let modeOverride: StripeEnv | null = null;

export function setPaymentModeOverride(mode: "test" | "live" | null) {
  if (mode === null) modeOverride = null;
  else modeOverride = mode === "test" ? "sandbox" : "live";
}

export function getPaymentModeOverride(): "test" | "live" | null {
  if (modeOverride === null) return null;
  return modeOverride === "sandbox" ? "test" : "live";
}

let stripePromise: Promise<Stripe | null> | null = null;

export function getStripe(): Promise<Stripe | null> {
  if (!stripePromise) {
    if (!clientToken) throw new Error("VITE_PAYMENTS_CLIENT_TOKEN is not set");
    stripePromise = loadStripe(clientToken);
  }
  return stripePromise;
}

export function getStripeEnvironment(): StripeEnv {
  return modeOverride ?? autoEnv;
}