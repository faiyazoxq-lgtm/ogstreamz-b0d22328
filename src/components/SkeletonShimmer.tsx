import { cn } from "@/lib/utils";

export function SkeletonShimmer({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("skeleton-shimmer h-4 w-full", className)} {...props} />;
}

export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  return (
    <div className="glass-obsidian rounded-2xl p-5 space-y-3">
      <SkeletonShimmer className="h-5 w-1/2" />
      {Array.from({ length: lines }).map((_, i) => (
        <SkeletonShimmer key={i} className="h-3" />
      ))}
    </div>
  );
}