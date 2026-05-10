import { CoinCheckout } from "@/components/CoinCheckout";

interface Props {
  customerEmail?: string;
  returnUrl?: string;
  onSuccess?: () => void;
}

export function RealOgCheckout({ onSuccess }: Props) {
  return (
    <CoinCheckout
      kind="real_og"
      cost={20}
      itemTitle="Real OG Pass — Lifetime"
      onSuccess={onSuccess}
    />
  );
}