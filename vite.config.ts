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
      // TanStack Router auto-splits route components into their own chunks,
      // so the only remaining "large" chunks are vendor bundles. Bumping the
      // warning threshold keeps the build output clean without masking real
      // regressions in app code (which stays well under 800 kB).
      //
      // NOTE: do NOT add `rollupOptions.output.manualChunks` here. Splitting
      // React / TanStack / Supabase into separate vendor chunks breaks
      // Rollup's cross-chunk re-export resolution under the Cloudflare SSR
      // build (errors with `getVariableForExportName` on null). Let Rollup
      // chunk vendors automatically.
      chunkSizeWarningLimit: 800,
    },
  },
});
