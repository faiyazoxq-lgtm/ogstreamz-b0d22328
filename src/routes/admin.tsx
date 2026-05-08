import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Shield, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Admin Console · 0G-PORTAL" }] }),
  component: AdminPage,
});

type Row = { id: string; email: string; status: "free" | "vip"; credits: number };

function AdminPage() {
  const { user, isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user || !isAdmin) navigate({ to: "/" });
  }, [user, isAdmin, loading, navigate]);

  useEffect(() => {
    if (!isAdmin) return;
    supabase
      .from("profiles")
      .select("id,email,status,credits")
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (error) toast.error(error.message);
        else setRows((data as Row[]) ?? []);
      });
  }, [isAdmin]);

  const update = async (id: string, patch: Partial<Row>) => {
    setBusy(id);
    const { error } = await supabase.from("profiles").update(patch).eq("id", id);
    setBusy(null);
    if (error) return toast.error(error.message);
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    toast.success("Vault updated");
  };

  if (loading || !isAdmin) {
    return <main className="px-5 py-20 text-center text-muted-foreground">Verifying clearance…</main>;
  }

  return (
    <main className="max-w-5xl mx-auto px-5 sm:px-8 py-12">
      <header className="mb-8">
        <p className="text-xs uppercase tracking-[0.4em] font-semibold" style={{ color: "var(--neon-blue-bright)" }}>
          <Shield className="inline h-3.5 w-3.5 mr-2" />Admin Console
        </p>
        <h1 className="mt-3 font-[Montserrat] font-black text-3xl sm:text-5xl text-metallic">Syndicate Roster</h1>
      </header>

      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="grid grid-cols-12 gap-2 px-5 py-3 text-[10px] uppercase tracking-[0.3em] text-muted-foreground border-b border-border">
          <div className="col-span-5">Email</div>
          <div className="col-span-3">Status</div>
          <div className="col-span-2">Credits</div>
          <div className="col-span-2 text-right">Action</div>
        </div>
        {rows.map((r) => (
          <RoleRow key={r.id} row={r} busy={busy === r.id} onSave={(p) => update(r.id, p)} />
        ))}
        {rows.length === 0 && (
          <p className="px-5 py-10 text-center text-sm text-muted-foreground">No members yet.</p>
        )}
      </div>
    </main>
  );
}

function RoleRow({ row, busy, onSave }: { row: Row; busy: boolean; onSave: (p: Partial<Row>) => void }) {
  const [credits, setCredits] = useState(String(row.credits));
  const [status, setStatus] = useState<"free" | "vip">(row.status);
  return (
    <div className="grid grid-cols-12 gap-2 px-5 py-4 items-center border-b border-border last:border-b-0">
      <div className="col-span-5 text-sm truncate">{row.email}</div>
      <div className="col-span-3">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as "free" | "vip")}
          className="bg-background border border-border rounded-md px-2 py-1.5 text-sm w-full"
        >
          <option value="free">Free</option>
          <option value="vip">VIP</option>
        </select>
      </div>
      <div className="col-span-2">
        <Input
          type="number"
          min={0}
          value={credits}
          onChange={(e) => setCredits(e.target.value)}
          className="h-9"
        />
      </div>
      <div className="col-span-2 text-right">
        <Button
          size="sm"
          disabled={busy}
          onClick={() => onSave({ credits: parseInt(credits, 10) || 0, status })}
          className="btn-glass-blue text-white text-xs uppercase tracking-widest"
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><Save className="h-3.5 w-3.5 mr-1" />Save</>}
        </Button>
      </div>
    </div>
  );
}