import { useRef, useState } from "react";
import { Brain, Loader2, Sparkles, Search, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

type Hub = "trade" | "music" | "tools" | "connect" | "general";

/**
 * Live stream of 0G-BRAIN's reasoning. Hits the streaming server route
 * (/api/public/0g-orchestrator), which proxies Gemini 2.5-flash with thinking_mode
 * HIGH and googleSearch grounding. Renders thought-summaries and the final
 * answer as tokens arrive.
 */
export function ZeroGStreamPanel() {
  const [hub, setHub] = useState<Hub>("trade");
  const [asset, setAsset] = useState("GOLD");
  const [bias, setBias] = useState<"BULL" | "BEAR" | "NEUTRAL">("NEUTRAL");
  const [vibe, setVibe] = useState("");
  const [genre, setGenre] = useState("Urdu/English fusion");
  const [thoughts, setThoughts] = useState("");
  const [answer, setAnswer] = useState("");
  const [groundingHits, setGroundingHits] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const stop = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setBusy(false);
  };

  const run = async () => {
    setThoughts("");
    setAnswer("");
    setGroundingHits([]);
    setBusy(true);
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    const params: Record<string, any> =
      hub === "trade"
        ? { asset, bias }
        : hub === "music"
          ? { genre, vibe }
          : { prompt: vibe || asset };

    try {
      const resp = await fetch("/api/public/0g-orchestrator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hub, params }),
        signal: ac.signal,
      });
      if (!resp.ok || !resp.body) {
        const txt = await resp.text().catch(() => "");
        throw new Error(txt || `Stream failed (${resp.status})`);
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });

        let nl: number;
        while ((nl = buf.indexOf("\n")) !== -1) {
          let line = buf.slice(0, nl);
          buf = buf.slice(nl + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data:")) continue;
          const json = line.slice(5).trim();
          if (!json || json === "[DONE]") continue;

          try {
            const ev = JSON.parse(json);
            const parts = ev?.candidates?.[0]?.content?.parts ?? [];
            for (const p of parts) {
              const txt = typeof p?.text === "string" ? p.text : "";
              if (!txt) continue;
              if (p.thought) setThoughts((t) => t + txt);
              else setAnswer((a) => a + txt);
            }
            const grounding =
              ev?.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
            if (grounding.length) {
              setGroundingHits((prev) => {
                const next = [...prev];
                for (const g of grounding) {
                  const t = g?.web?.title || g?.web?.uri;
                  if (t && !next.includes(t)) next.push(t);
                }
                return next.slice(0, 12);
              });
            }
          } catch {
            // partial JSON across chunks — push back and wait
            buf = "data: " + json + "\n" + buf;
            break;
          }
        }
      }
    } catch (e: any) {
      if (e?.name !== "AbortError") {
        console.error(e);
        toast.error(e?.message || "0G-BRAIN stream failed");
      }
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  };

  return (
    <section
      className="rounded-2xl border p-6 mb-10"
      style={{
        borderColor: "color-mix(in oklab, var(--neon-blue-bright) 40%, transparent)",
        background:
          "linear-gradient(135deg, color-mix(in oklab, var(--neon-blue-bright) 6%, transparent), transparent)",
      }}
    >
      <div className="flex items-center justify-between mb-4">
        <h2
          className="text-xs uppercase tracking-[0.4em] flex items-center gap-2"
          style={{ color: "var(--neon-blue-bright)" }}
        >
          <Brain className="h-4 w-4" />
          0G-BRAIN · Live Reasoning Stream
        </h2>
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground inline-flex items-center gap-1">
          <Zap className="h-3 w-3 text-yellow-400" /> Thinking HIGH · <Search className="h-3 w-3" /> Google Search
        </span>
      </div>

      <div className="grid sm:grid-cols-5 gap-2 mb-3">
        <select
          value={hub}
          onChange={(e) => setHub(e.target.value as Hub)}
          className="sm:col-span-1 bg-background border border-border rounded-md px-3 py-2 text-sm"
        >
          <option value="trade">TradeHUB</option>
          <option value="music">MusicHUB</option>
          <option value="tools">ToolHUB</option>
          <option value="connect">ConnectHUB</option>
          <option value="general">General</option>
        </select>

        {hub === "trade" ? (
          <>
            <Input
              value={asset}
              onChange={(e) => setAsset(e.target.value)}
              placeholder="Asset (e.g. GOLD, BTC, NVDA)"
              className="sm:col-span-2"
            />
            <select
              value={bias}
              onChange={(e) => setBias(e.target.value as any)}
              className="sm:col-span-2 bg-background border border-border rounded-md px-3 py-2 text-sm"
            >
              <option value="BULL">BULL bias</option>
              <option value="BEAR">BEAR bias</option>
              <option value="NEUTRAL">NEUTRAL bias</option>
            </select>
          </>
        ) : hub === "music" ? (
          <>
            <Input
              value={genre}
              onChange={(e) => setGenre(e.target.value)}
              placeholder="Genre"
              className="sm:col-span-2"
            />
            <Input
              value={vibe}
              onChange={(e) => setVibe(e.target.value)}
              placeholder="Vibe / theme"
              className="sm:col-span-2"
            />
          </>
        ) : (
          <Input
            value={vibe}
            onChange={(e) => setVibe(e.target.value)}
            placeholder={hub === "tools" ? "What should the tool do?" : "Your prompt"}
            className="sm:col-span-4"
          />
        )}
      </div>

      <div className="flex gap-2">
        <Button onClick={run} disabled={busy} className="font-bold">
          {busy ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Reasoning…</> : <><Sparkles className="h-4 w-4 mr-2" />Run 0G-BRAIN</>}
        </Button>
        {busy && (
          <Button variant="outline" onClick={stop}>Stop</Button>
        )}
      </div>

      {(thoughts || answer || groundingHits.length > 0) && (
        <div className="mt-5 grid lg:grid-cols-2 gap-3">
          <div className="rounded-md border border-border bg-black/30 p-3 min-h-[120px]">
            <p className="text-[10px] uppercase tracking-[0.3em] text-yellow-300/80 mb-2">
              💭 Thought stream
            </p>
            <pre className="whitespace-pre-wrap text-xs leading-relaxed text-yellow-100/80 max-h-72 overflow-auto">
              {thoughts || (busy ? "…thinking…" : "—")}
            </pre>
          </div>
          <div className="rounded-md border border-border bg-black/40 p-3 min-h-[120px]">
            <p className="text-[10px] uppercase tracking-[0.3em] text-[color:var(--neon-blue-bright)] mb-2">
              ⚡ Final answer
            </p>
            <pre className="whitespace-pre-wrap text-xs leading-relaxed text-white max-h-72 overflow-auto">
              {answer || (busy ? "…composing…" : "—")}
            </pre>
          </div>
          {groundingHits.length > 0 && (
            <div className="lg:col-span-2 rounded-md border border-border bg-black/20 p-3">
              <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground mb-2">
                🔎 Grounded via Google Search
              </p>
              <ul className="text-xs text-muted-foreground space-y-1">
                {groundingHits.map((h, i) => (
                  <li key={i} className="truncate">• {h}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}