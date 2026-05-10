import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { getStripe, getStripeEnvironment } from "@/lib/stripe";
import { createRealOgCheckout } from "@/lib/real-og.functions";

interface Props {
  customerEmail?: string;
  returnUrl: string;
}

export function RealOgCheckout({ customerEmail, returnUrl }: Props) {
  const fetchClientSecret = async (): Promise<string> => {
    const secret = await createRealOgCheckout({
      data: {
        returnUrl,
        environment: getStripeEnvironment(),
        customerEmail,
      },
    });
    if (!secret) throw new Error("Failed to start Real OG checkout");
    return secret;
  };

  return (
    <div id="real-og-checkout">
      <EmbeddedCheckoutProvider stripe={getStripe()} options={{ fetchClientSecret }}>
        <EmbeddedCheckout />
      </EmbeddedCheckoutProvider>
    </div>
  );
}