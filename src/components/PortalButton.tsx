import * as React from "react";
import { Link, type LinkProps } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

/**
 * Portal button sizing helpers.
 *
 * One source of truth for the `.portal-button-motion--{sm,md,lg}` family
 * (defined in src/styles.css). Use either:
 *
 *   1. The class helper, when you need to drop the classes onto an
 *      arbitrary element (anchor, custom Link, third-party component):
 *
 *        <a className={portalButtonClass({ size: "lg" })}>Open</a>
 *
 *   2. The <PortalButton> component, when you want a plain <button>:
 *
 *        <PortalButton size="sm" onClick={…}>Save</PortalButton>
 *
 *   3. The <PortalLink> component, when you want a TanStack <Link>:
 *
 *        <PortalLink size="md" to="/portals">Browse</PortalLink>
 *
 * Switching size is a single prop / class swap. The shared focus halo
 * (gold ring + glow) auto-rescales via `--portal-focus-scale`.
 */

export type PortalButtonSize = "sm" | "md" | "lg";

const SIZE_CLASS: Record<PortalButtonSize, string> = {
  sm: "portal-button-motion--sm",
  md: "portal-button-motion--md",
  lg: "portal-button-motion--lg",
};

export function portalButtonClass(opts: {
  size?: PortalButtonSize;
  className?: string;
} = {}): string {
  const { size = "md", className } = opts;
  return cn(
    "portal-button-motion",
    SIZE_CLASS[size],
    "inline-flex items-center justify-center gap-1.5 font-bold uppercase tracking-[0.18em] outline-none",
    className,
  );
}

type PortalButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  size?: PortalButtonSize;
};

export const PortalButton = React.forwardRef<HTMLButtonElement, PortalButtonProps>(
  function PortalButton({ size = "md", className, type = "button", ...rest }, ref) {
    return (
      <button
        ref={ref}
        type={type}
        className={portalButtonClass({ size, className })}
        {...rest}
      />
    );
  },
);

type PortalLinkProps = LinkProps & {
  size?: PortalButtonSize;
  className?: string;
};

export function PortalLink({ size = "md", className, ...rest }: PortalLinkProps) {
  return <Link {...rest} className={portalButtonClass({ size, className })} />;
}