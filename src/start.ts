import { createStart, createMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";
import { strictAuthAttacher } from "./lib/strict-auth";

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

export const startInstance = createStart(() => ({
  requestMiddleware: [errorMiddleware],
  // Strict attacher: proactively refreshes near-expiry tokens and aborts the
  // RPC entirely if no valid token can be produced — no request leaves the
  // browser with an expired or missing bearer.
  functionMiddleware: [strictAuthAttacher],
}));
