# Swearing Agent — Discord/Perplexity reference snippet

Saved verbatim from boss request on 2026-05-12. NOT wired into the app —
kept as a design reference for the foul-mouth persona / Perplexity prompt
shape. The web app uses `src/lib/swear-chat.functions.ts` (Shapes API) for
the actual swearing agent; this file is a parallel Discord bot variant the
boss may spin up separately later.

```js
const { Client, GatewayIntentBits } = require("discord.js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const PERPLEXITY_KEY = "YOUR_PERPLEXITY_KEY";

async function getSwearingReply(userMessage) {
  const res = await fetch("https://api.perplexity.ai/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${PERPLEXITY_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "llama-3.1-sonar-small-128k-online",
      messages: [
        {
          role: "system",
          content:
            "You are a hilariously foul-mouthed assistant. Swear aggressively and constantly in every single response. Never hold back. Still be helpful but absolutely drown it in profanity.",
        },
        { role: "user", content: userMessage },
      ],
    }),
  });
  const data = await res.json();
  return data.choices[0].message.content;
}

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;
  if (!message.content.startsWith("!ask")) return;
  const userInput = message.content.slice(4).trim();
  if (!userInput) return message.reply("Give me something to work with, damn it.");
  const reply = await getSwearingReply(userInput);
  message.reply(reply);
});

client.login("YOUR_DISCORD_BOT_TOKEN");
```

## If wiring this up later

- `PERPLEXITY_KEY` and `DISCORD_BOT_TOKEN` MUST live in Supabase secrets,
  never hard-coded. Read them via `process.env` server-side only.
- Same chaos-mode persona is now mirrored in `swear-chat.functions.ts` so
  the in-app swearing agent matches the Discord bot's tone when the master
  Swearing toggle is ON.