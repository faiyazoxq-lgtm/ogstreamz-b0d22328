import { Link } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";

export function QuickJump({
  to, Icon, label, tint, hash,
}: {
  to: string;
  Icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  label: string;
  tint: string;
  hash?: string;
}) {
  return (
    <Link
      to={to}
      hash={hash}
      className="group flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-[11px] font-extrabold uppercase tracking-[0.2em] transition active:scale-[0.97] hover:-translate-y-0.5"
      style={{ borderColor: `${tint}55`, background: `${tint}12`, color: tint }}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
      <ArrowUpRight className="h-3 w-3 opacity-50 group-hover:opacity-100 transition" />
    </Link>
  );
}
