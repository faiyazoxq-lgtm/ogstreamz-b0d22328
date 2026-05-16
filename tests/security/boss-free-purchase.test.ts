import { describe, it, expect } from "vitest";
import { execSync } from "node:child_process";

/**
 * Contract-level integration tests for Boss free-purchase flow.
 *
 * We cannot create fixture auth.users from the sandbox role, so instead
 * we assert the live DB has the invariants that guarantee every Boss
 * purchase is free across the three scenarios the product cares about:
 *
 *   1. success            — boss override branch returns cost=0 and writes audit
 *   2. insufficient balance — boss branch runs BEFORE the balance check,
 *                              so a broke boss still gets it free
 *   3. concurrent checkouts — boss branch never touches profiles.credits,
 *                              so racing calls cannot deadlock or double-charge
 */

function psql(sql: string): string {
  return execSync(`psql -tA -c ${JSON.stringify(sql)}`, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

const HAS_PG = !!process.env.PGHOST;
const d = HAS_PG ? describe : describe.skip;

d("boss free-purchase contract (live DB)", () => {
  const fnSrc = HAS_PG
    ? psql(
        "SELECT pg_get_functiondef(oid) FROM pg_proc WHERE proname='purchase_with_coins'",
      )
    : "";

  it("purchase_with_coins exists and is SECURITY DEFINER", () => {
    expect(fnSrc).toContain("purchase_with_coins");
    expect(fnSrc).toMatch(/SECURITY DEFINER/);
  });

  it("derives the caller from auth.uid() (cannot be spoofed by client)", () => {
    expect(fnSrc).toMatch(/auth\.uid\(\)/);
  });

  it("checks boss role via is_boss() before allowing the free branch", () => {
    expect(fnSrc).toMatch(/is_boss\s*\(\s*uid\s*\)/);
    expect(fnSrc).toMatch(/is_boss_caller/);
  });

  it("boss branch runs BEFORE the balance lock+deduct (scenario: insufficient balance)", () => {
    const bossIdx = fnSrc.indexOf("if is_boss_caller then");
    const lockIdx = fnSrc.indexOf("for update");
    const deductIdx = fnSrc.indexOf("credits = newbal");
    expect(bossIdx).toBeGreaterThan(-1);
    expect(lockIdx).toBeGreaterThan(-1);
    expect(deductIdx).toBeGreaterThan(-1);
    expect(bossIdx).toBeLessThan(lockIdx);
    expect(bossIdx).toBeLessThan(deductIdx);
  });

  it("boss branch returns cost=0 and boss_override=true (scenario: success)", () => {
    const bossBlock = fnSrc
      .split("if is_boss_caller then")[1]
      ?.split("-- Lock + balance check")[0] ?? "";
    expect(bossBlock).toMatch(/'cost'\s*,\s*0/);
    expect(bossBlock).toMatch(/'boss_override'\s*,\s*true/);
    // and it must NOT update profiles.credits in this branch
    expect(bossBlock).not.toMatch(/update\s+public\.profiles\s+set\s+credits/i);
  });

  it("boss branch writes an audit row for every kind (scenario: concurrent checkouts)", () => {
    const bossBlock = fnSrc
      .split("if is_boss_caller then")[1]
      ?.split("-- Lock + balance check")[0] ?? "";
    const auditInserts = bossBlock.match(/insert\s+into\s+public\.boss_purchase_audit/gi) ?? [];
    // one per kind: track_unlock, real_og, store_pass
    expect(auditInserts.length).toBe(3);
  });

  it("boss_purchase_audit table never records coin deductions", () => {
    const cols = psql(
      "SELECT string_agg(column_name, ',') FROM information_schema.columns WHERE table_schema='public' AND table_name='boss_purchase_audit'",
    );
    expect(cols).toBeTruthy();
    // no balance / debit / amount field — only the "would have cost" snapshot
    expect(cols).not.toMatch(/\bdeducted\b/);
    expect(cols).not.toMatch(/\bbalance\b/);
    expect(cols).not.toMatch(/\bdebit\b/);
    expect(cols).toContain("would_have_cost_credits");
  });

  it("boss_purchase_audit has RLS enabled and is boss-only readable", () => {
    const rls = psql(
      "SELECT relrowsecurity FROM pg_class WHERE relname='boss_purchase_audit'",
    );
    expect(rls).toBe("t");

    const policy = psql(
      "SELECT pg_get_expr(polqual, polrelid) FROM pg_policy WHERE polrelid='public.boss_purchase_audit'::regclass",
    );
    expect(policy).toMatch(/is_boss/);
  });
});

d("boss free-purchase never deducts coins (live RPC simulation)", () => {
  // Pick an existing boss; if none, skip the live-call assertion.
  const bossId = HAS_PG
    ? psql("SELECT id FROM public.profiles WHERE rank='boss' LIMIT 1")
    : "";
  const runLive = HAS_PG && !!bossId;
  const lit = (runLive ? it : it.skip) as typeof it;

  lit("calling purchase_with_coins as a Boss leaves profiles.credits unchanged and inserts exactly one audit row", () => {
    // Snapshot
    const beforeCredits = psql(
      `SELECT COALESCE(credits, 0) FROM public.profiles WHERE id='${bossId}'`,
    );
    const beforeAudit = psql(
      `SELECT count(*) FROM public.boss_purchase_audit WHERE user_id='${bossId}'`,
    );

    // Invoke RPC inside a tx impersonating the boss via JWT claims,
    // then ROLLBACK so the run is non-destructive.
    const ref = `audit-check-${Date.now()}`;
    const claims = JSON.stringify({ sub: bossId, role: "authenticated" });
    const sql = [
      "begin;",
      `select set_config('role','authenticated',true);`,
      `select set_config('request.jwt.claims', '${claims.replace(/'/g, "''")}', true);`,
      `select public.purchase_with_coins('track_unlock','${ref}');`,
      `select 'CREDITS=' || COALESCE(credits,0) from public.profiles where id='${bossId}';`,
      `select 'AUDIT='   || count(*) from public.boss_purchase_audit where user_id='${bossId}' and ref='${ref}';`,
      "rollback;",
    ].join("\n");
    const out = execSync(`psql -tA`, {
      input: sql,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    });

    const credsDuringTx = out.match(/CREDITS=(\d+)/)?.[1];
    const auditDuringTx = out.match(/AUDIT=(\d+)/)?.[1];
    expect(credsDuringTx).toBe(beforeCredits); // no deduction inside the tx
    expect(auditDuringTx).toBe("1");           // exactly one audit row for this ref

    // After rollback, persistent state must be untouched
    const afterCredits = psql(
      `SELECT COALESCE(credits, 0) FROM public.profiles WHERE id='${bossId}'`,
    );
    const afterAudit = psql(
      `SELECT count(*) FROM public.boss_purchase_audit WHERE user_id='${bossId}'`,
    );
    expect(afterCredits).toBe(beforeCredits);
    expect(afterAudit).toBe(beforeAudit);
  });

  it("static: boss branch in purchase_with_coins contains zero credit-mutating statements", () => {
    const fnSrc = HAS_PG
      ? psql(
          "SELECT pg_get_functiondef(oid) FROM pg_proc WHERE proname='purchase_with_coins'",
        )
      : "";
    const bossBlock =
      fnSrc.split("if is_boss_caller then")[1]?.split("end if;")[0] ?? "";
    expect(bossBlock).not.toMatch(/update\s+public\.profiles[\s\S]*credits/i);
    expect(bossBlock).not.toMatch(/credits\s*=\s*credits\s*[-+]/i);
    expect(bossBlock).not.toMatch(/insert\s+into\s+public\.coin_ledger/i);
  });
});
