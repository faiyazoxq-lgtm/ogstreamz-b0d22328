import { AlertTriangle } from "lucide-react";
import { usePaymentMode } from "@/hooks/use-payment-mode";

export function PaymentTestModeBanner() {
  const mode = usePaymentMode();
  if (mode !== "test") return null;

  return (
    <div className="w-full bg-orange-500/15 border-b border-orange-500/40 px-4 py-1.5 text-center text-xs font-bold uppercase tracking-[0.25em] text-orange-200 flex items-center justify-center gap-2">
      <AlertTriangle className="h-3.5 w-3.5" />
      Test Mode — payments are not live
    </div>
  );
}
