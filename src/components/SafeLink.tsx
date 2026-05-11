import { forwardRef, type AnchorHTMLAttributes, type IframeHTMLAttributes, type ImgHTMLAttributes } from "react";
import { useDomainDenylist } from "@/lib/use-domain-denylist";
import { sanitizeUrl } from "@/lib/safe-url";

/** External anchor that strips href if blocked or unsafe. */
export const SafeLink = forwardRef<HTMLAnchorElement, AnchorHTMLAttributes<HTMLAnchorElement>>(
  function SafeLink({ href, children, rel, target, ...rest }, ref) {
    const denylist = useDomainDenylist();
    const safe = sanitizeUrl(href ?? "", denylist);
    if (!safe) {
      return (
        <span ref={ref as unknown as React.Ref<HTMLSpanElement>} {...(rest as object)} aria-disabled="true" data-blocked="true">
          {children}
        </span>
      );
    }
    const isExternal = /^https?:\/\//i.test(safe);
    return (
      <a
        ref={ref}
        href={safe}
        target={target ?? (isExternal ? "_blank" : undefined)}
        rel={rel ?? (isExternal ? "noopener noreferrer" : undefined)}
        {...rest}
      >
        {children}
      </a>
    );
  },
);

/** Iframe that refuses to render if src is blocked. */
export function SafeEmbed({ src, ...rest }: IframeHTMLAttributes<HTMLIFrameElement>) {
  const denylist = useDomainDenylist();
  const safe = sanitizeUrl(src ?? "", denylist);
  if (!safe) return null;
  return <iframe src={safe} {...rest} />;
}

/** Image that refuses to render if src is blocked. */
export function SafeImage({ src, alt = "", ...rest }: ImgHTMLAttributes<HTMLImageElement>) {
  const denylist = useDomainDenylist();
  const safe = sanitizeUrl(src ?? "", denylist);
  if (!safe) return null;
  return <img src={safe} alt={alt} {...rest} />;
}