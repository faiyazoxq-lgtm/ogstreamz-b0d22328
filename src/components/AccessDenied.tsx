import { Link } from "@tanstack/react-router";
import { ChevronLeft, LogIn, ShieldAlert } from "lucide-react";

export interface AccessDeniedProps {
  /** Heading shown to the user. Defaults to "403 — Access denied". */
  title?: string;
  /** Body copy. Defaults to a generic, non-leaky message. */
  message?: string;
  /** Whether to render the "Sign in" CTA. */
  showSignIn?: boolean;
  /** Where the back button should link. */
  backTo?: string;
  /** Hidden context for screen-readers / debugging — never leaked visibly. */
  srHint?: string;
}

/**
 * Consistent, presentation-only "Access denied" surface used whenever a server
 * function or RPC is rejected for the current user. Renders a generic message
 * and stable CTAs — never echoes raw server detail (RPC name, SQL, internal
 * IDs). Pair with `reportRpcDenied(rpcName, err)` from `@/lib/api-error` to
 * log the RPC name to the console for diagnostics.
 */
export function AccessDenied({
  title = "403 — Access denied",
  message = "You don't have permission to perform this action.",
  showSignIn = false,
  backTo = "/",
  srHint,
}: AccessDeniedProps) {
  return (
    <div
      role="alert"
      aria-live="polite"
      className="mx-auto max-w-lg rounded-2xl border border-destructive/40 bg-destructive/10 p-6 text-center"
    >
      <div className="mx-auto mb-3 inline-flex h-12 w-12 items-center justify-center rounded-full border border-destructive/50 bg-destructive/15">
        <ShieldAlert className="h-6 w-6 text-destructive" />
      </div>
      <h1 className="syndicate-header text-xl text-foreground">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{message}</p>
      {srHint ? <span className="sr-only">{srHint}</span> : null}
      <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
        <Link
          to={backTo}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-secondary px-3 py-2 text-xs font-bold text-foreground hover:bg-secondary/80"
        >
          <ChevronLeft className="h-4 w-4" /> Back
        </Link>
        {showSignIn && (
          <Link
            to="/auth"
            className="inline-flex items-center gap-1.5 rounded-md border border-gold/40 bg-gold/10 px-3 py-2 text-xs font-bold text-gold hover:bg-gold/15"
          >
            <LogIn className="h-4 w-4" /> Sign in
          </Link>
        )}
      </div>
    </div>
  );
}

export default AccessDenied;