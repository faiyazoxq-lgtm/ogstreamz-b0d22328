# OG Streamz

## Required secrets

All secrets are stored in Lovable Cloud (encrypted at rest) and exposed to
server code as `process.env.*`. Never read them from client bundles.

### Telegram boss-chat IDs

These two secrets identify **which Telegram chat receives boss notifications
and accepts boss commands**. Despite the `_API_KEY` suffix, the values are
numeric Telegram chat IDs, not bot tokens. The bot token itself lives in the
Telegram connector and is exposed as `TELEGRAM_API_KEY`.

| Secret | Purpose |
| --- | --- |
| `BOSS_TELEGRAM_API_KEY` | Production boss chat ID. Used when `NODE_ENV === "production"` (or `TELEGRAM_ENV=prod`). |
| `BOSS_TELEGRAM_API_KEY_TEST` | Test/dev boss chat ID. Used in preview/dev (or `TELEGRAM_ENV=test`). |

Optional override: set `TELEGRAM_ENV` to `prod` / `production` / `live` or
`test` / `dev` / `staging` to force one regardless of `NODE_ENV`. If the
preferred key is unset, the helper falls back to the other so a partially
configured environment still notifies somewhere.

#### Where each is used

Both secrets are read **only** through the central helper
`src/lib/boss-chat.server.ts` (`getBossChatId()` / `requireBossChatId()`).
Call sites:

- `src/lib/boss-login-notify.functions.ts` — DMs the boss chat whenever the
  configured `BOSS_EMAIL` signs in (device, browser, IP country).
- `src/routes/api/public/telegram/webhook.ts` — recognizes inbound messages
  from the boss chat as operator commands, and is the destination for member
  `/msg` / `/contact` / `/boss` relays.

If you add new code that needs to message or identify the boss chat, import
the helper instead of reading `process.env.BOSS_TELEGRAM_API_KEY*` directly:

```ts
import { getBossChatId } from "@/lib/boss-chat.server";

const chatId = getBossChatId();
if (!chatId) return; // not configured in this environment
```

### Other related secrets

| Secret | Purpose |
| --- | --- |
| `TELEGRAM_API_KEY` | Telegram **bot connector** key (auth for the gateway, `X-Connection-Api-Key`). Single value across environments. |
| `LOVABLE_API_KEY` | Bearer for the Lovable connector gateway. Managed — rotate via the Lovable dashboard. |
| `BOSS_EMAIL` | Email address that gets promoted to boss role on sign-in. |

## Managing secrets

Add or update secrets from **Lovable Cloud → Secrets** (or ask the agent to
open the secrets form). Values are never committed to the repo and there is
no `.env` file.