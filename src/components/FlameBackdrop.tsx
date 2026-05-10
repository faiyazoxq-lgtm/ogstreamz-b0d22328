import flame640 from "@/assets/bg-flame-640.webp";
import flame1024 from "@/assets/bg-flame-1024.webp";
import flame1536 from "@/assets/bg-flame-1536.webp";
import flamePng from "@/assets/bg-flame.png";

/**
 * Responsive flame wallpaper. Serves a tiny WebP on mobile and scales up
 * on larger screens, with the original PNG as a final fallback.
 *
 * Drop into any `relative` parent. Pass `className` to override opacity /
 * blend mode / object-position for a specific surface.
 */
export function FlameBackdrop({
  className = "absolute inset-0 h-full w-full object-cover object-bottom opacity-[0.10] mix-blend-overlay sm:opacity-[0.08] sm:object-center",
  style,
  sizes = "(max-width: 640px) 640px, (max-width: 1024px) 1024px, 1536px",
}: {
  className?: string;
  style?: React.CSSProperties;
  sizes?: string;
}) {
  return (
    <picture>
      <source
        type="image/webp"
        srcSet={`${flame640} 640w, ${flame1024} 1024w, ${flame1536} 1536w`}
        sizes={sizes}
      />
      <img
        src={flamePng}
        alt=""
        aria-hidden
        loading="lazy"
        decoding="async"
        fetchPriority="low"
        className={className}
        style={style}
      />
    </picture>
  );
}
