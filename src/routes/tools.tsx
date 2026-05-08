import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Timer, Zap, Play, Pause, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/tools")({
  head: () => ({
    meta: [
      { title: "ToolHUB — 0G-STREAMZ" },
      { name: "description", content: "Sharp utilities: countdown timer and electrical calculator." },
    ],
  }),
  component: ToolsPage,
});

function ToolsPage() {
  return (
    <main className="max-w-7xl mx-auto px-5 sm:px-8 py-12 sm:py-16">
      <header className="mb-10">
        <p className="text-xs tracking-[0.4em] text-gold uppercase font-semibold">ToolHUB</p>
        <h1 className="mt-3 font-[Montserrat] font-black text-4xl sm:text-6xl tracking-tight">
          Utility, <span className="text-gradient-gold">Elevated.</span>
        </h1>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        <CountdownCard />
        <OhmsCard />
      </div>
    </main>
  );
}

function CountdownCard() {
  const [input, setInput] = useState("60");
  const [seconds, setSeconds] = useState(60);
  const [running, setRunning] = useState(false);
  const ref = useRef<number | null>(null);

  useEffect(() => {
    if (!running) return;
    ref.current = window.setInterval(() => {
      setSeconds((s) => {
        if (s <= 1) {
          setRunning(false);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => { if (ref.current) window.clearInterval(ref.current); };
  }, [running]);

  const reset = () => { setRunning(false); setSeconds(parseInt(input || "0", 10)); };
  const apply = () => { const n = parseInt(input || "0", 10); setSeconds(n); setRunning(false); };

  const m = Math.floor(seconds / 60);
  const s = seconds % 60;

  return (
    <section className="rounded-2xl border border-border bg-card p-6 sm:p-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="h-10 w-10 rounded-lg bg-secondary text-gold flex items-center justify-center">
          <Timer className="h-5 w-5" />
        </div>
        <h2 className="font-[Montserrat] font-bold text-xl">Countdown Timer</h2>
      </div>

      <div className="text-center py-8">
        <div className="font-[Montserrat] font-black text-7xl sm:text-8xl tabular-nums text-gradient-gold tracking-tighter">
          {String(m).padStart(2, "0")}:{String(s).padStart(2, "0")}
        </div>
      </div>

      <div className="flex gap-2 mb-4">
        <Input
          type="number"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Seconds"
          className="bg-background"
        />
        <Button variant="outline" onClick={apply}>Set</Button>
      </div>
      <div className="flex gap-2">
        <Button
          onClick={() => setRunning((r) => !r)}
          className="flex-1 bg-gold text-primary-foreground hover:bg-gold/90 font-semibold"
        >
          {running ? <Pause className="h-4 w-4 mr-2" /> : <Play className="h-4 w-4 mr-2" />}
          {running ? "Pause" : "Start"}
        </Button>
        <Button variant="outline" onClick={reset}>
          <RotateCcw className="h-4 w-4" />
        </Button>
      </div>
    </section>
  );
}

function OhmsCard() {
  const [v, setV] = useState("12");
  const [i, setI] = useState("2");
  const voltage = parseFloat(v) || 0;
  const current = parseFloat(i) || 0;
  const resistance = current ? voltage / current : 0;
  const power = voltage * current;

  return (
    <section className="rounded-2xl border border-border bg-card p-6 sm:p-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="h-10 w-10 rounded-lg bg-secondary text-gold flex items-center justify-center">
          <Zap className="h-5 w-5" />
        </div>
        <h2 className="font-[Montserrat] font-bold text-xl">Electrical Calculator</h2>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">Voltage (V)</Label>
          <Input type="number" value={v} onChange={(e) => setV(e.target.value)} className="mt-2 bg-background" />
        </div>
        <div>
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">Current (A)</Label>
          <Input type="number" value={i} onChange={(e) => setI(e.target.value)} className="mt-2 bg-background" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <ResultTile label="Resistance" value={resistance.toFixed(2)} unit="Ω" />
        <ResultTile label="Power" value={power.toFixed(2)} unit="W" />
      </div>

      <p className="mt-5 text-xs text-muted-foreground">
        Ohm's Law: R = V / I · P = V × I
      </p>
    </section>
  );
}

function ResultTile({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="rounded-xl border border-border bg-background p-4">
      <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">{label}</p>
      <p className="mt-2 font-[Montserrat] font-black text-3xl text-gold tabular-nums">
        {value} <span className="text-base text-muted-foreground font-normal">{unit}</span>
      </p>
    </div>
  );
}