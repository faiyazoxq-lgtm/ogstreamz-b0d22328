import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { getStripe, getStripeEnvironment } from "@/lib/stripe";
import { createTrackUnlockCheckout } from "@/lib/tracks.functions";

interface Props {
  trackId: string;
  customerEmail?: string;
  returnUrl: string;
}

export function TrackUnlockCheckout({ trackId, customerEmail, returnUrl }: Props) {
  const fetchClientSecret = async (): Promise<string> => {
    const secret = await createTrackUnlockCheckout({
      data: {
        trackId,
        returnUrl,
        environment: getStripeEnvironment(),
        customerEmail,
      },
    });
    if (!secret) throw new Error("Failed to create checkout session");
    return secret;
  };

  return (
    <div id="track-unlock-checkout">
      <EmbeddedCheckoutProvider stripe={getStripe()} options={{ fetchClientSecret }}>
        <EmbeddedCheckout />
      </EmbeddedCheckoutProvider>
    </div>
  );
}