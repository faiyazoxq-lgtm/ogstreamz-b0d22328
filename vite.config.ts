// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
// @cloudflare/vite-plugin builds from this — wrangler.jsonc main alone is insufficient.
export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  vite: {
    build: {
      // Most remaining "large" chunks are vendor bundles, not app code.
      // Bump the warning slightly so noise doesn't hide real regressions.
      chunkSizeWarningLimit: 800,
      rollupOptions: {
        output: {
          // Split heavy third-party libs into their own long-cacheable chunks.
          // App route code stays under TanStack Router's auto-code-split chunks.
          manualChunks(id) {
            if (!id.includes("node_modules")) return undefined;

            if (id.includes("/@supabase/")) return "vendor-supabase";
            if (id.includes("/@tanstack/")) return "vendor-tanstack";
            if (id.includes("/@stripe/") || id.includes("/stripe")) return "vendor-stripe";
            if (id.includes("/@radix-ui/")) return "vendor-radix";
            if (id.includes("/lucide-react/")) return "vendor-icons";
            if (id.includes("/recharts/") || id.includes("/d3-")) return "vendor-charts";
            if (id.includes("/framer-motion/") || id.includes("/motion/")) return "vendor-motion";
            if (
              id.includes("/react/") ||
              id.includes("/react-dom/") ||
              id.includes("/scheduler/")
            ) {
              return "vendor-react";
            }
            return "vendor";
          },
        },
      },
    },
  },
});
