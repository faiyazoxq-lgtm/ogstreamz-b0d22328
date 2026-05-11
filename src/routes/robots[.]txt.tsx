import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/robots.txt")({
  server: {
    handlers: {
      GET: async () => {
        const body = `User-agent: *
Allow: /

# Auth & account flows — no SEO value, never index
Disallow: /auth
Disallow: /forgot-password
Disallow: /reset-password
Disallow: /vault-login
Disallow: /connect-telegram
Disallow: /welcome

# Private dashboards & operator surfaces
Disallow: /admin
Disallow: /dashboard
Disallow: /boss
Disallow: /boss/
Disallow: /settings
Disallow: /profile
Disallow: /account
Disallow: /account/
Disallow: /wallet
Disallow: /history
Disallow: /reseller
Disallow: /fleet
Disallow: /syndicate-overlord
Disallow: /console

# Transactional flows
Disallow: /checkout/

# Server endpoints — never index API responses
Disallow: /api/

# Block common AI scraper bots that ignore copyright
User-agent: GPTBot
Disallow: /
User-agent: CCBot
Disallow: /
User-agent: anthropic-ai
Disallow: /
User-agent: ClaudeBot
Disallow: /
User-agent: Google-Extended
Disallow: /

Sitemap: https://ogstreamz.co.uk/sitemap.xml
Host: ogstreamz.co.uk
`;
        return new Response(body, {
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
