import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { getStripe, getStripeEnvironment } from "@/lib/stripe";
import { createRealOgBundleCheckout } from "@/lib/real-og-bundle.functions";

interface Props {
  sku: string;
  customerEmail?: string;
  returnUrl: string;
}

export function RealOgBundleCheckout({ sku, customerEmail, returnUrl }: Props) {
  const fetchClientSecret = async (): Promise<string> => {
    const secret = await createRealOgBundleCheckout({
      data: {
        sku,
        returnUrl,
        environment: getStripeEnvironment(),
        customerEmail,
      },
    });
    if (!secret) throw new Error("Failed to start bundle checkout");
    return secret;
  };

  return (
    <div id={`real-og-bundle-checkout-${sku}`}>
      <EmbeddedCheckoutProvider stripe={getStripe()} options={{ fetchClientSecret }}>
        <EmbeddedCheckout />
      </EmbeddedCheckoutProvider>
    </div>
  );
}