// Server-only Claude caller. Shared by the authenticated `askClaude` serverFn
// and any other serverFn that needs Claude (e.g. the portal wizard council).
// Never import from client code — reads ANTHROPIC_API_KEY from process.env.

export type CallClaudeInput = {
  prompt: string;
  system?: string;
  model?: string;
  maxTokens?: number;
};

export type CallClaudeResult =
  | { ok: true; text: string }
  | { ok: false; error: string };

export async function callClaude(input: CallClaudeInput): Promise<CallClaudeResult> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return { ok: false, error: "ANTHROPIC_API_KEY is not configured" };

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: input.model ?? "claude-sonnet-4-5",
        max_tokens: input.maxTokens ?? 1024,
        system: input.system,
        messages: [{ role: "user", content: input.prompt }],
      }),
    });

    if (!res.ok) {
      const t = await res.text().catch(() => "");
      return { ok: false, error: `Claude ${res.status}: ${t.slice(0, 200)}` };
    }

    const json = (await res.json()) as { content?: Array<{ type?: string; text?: string }> };
    const text = (json.content ?? [])
      .map((b) => (b?.type === "text" ? b.text ?? "" : ""))
      .join("")
      .trim();
    return { ok: true, text };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Claude request failed" };
  }
}