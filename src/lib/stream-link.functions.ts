import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const DEFAULT_SERVER = "http://xiu96ctyh6-system.xyz:80";

function normalizeServer(s: string): string {
  let v = (s || "").trim();
  if (!v) return DEFAULT_SERVER;
  if (!/^https?:\/\//i.test(v)) v = "http://" + v;
  return v.replace(/\/+$/, "");
}

type XtreamUserInfo = {
  status?: string;
  exp_date?: string | number | null;
  message?: string;
  auth?: number;
};

async function probeXtream(server: string, username: string, password: string): Promise<XtreamUserInfo> {
  const url = `${server}/player_api.php?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(`Stream server returned ${res.status}`);
    const json = (await res.json().catch(() => ({}))) as { user_info?: XtreamUserInfo } | XtreamUserInfo;
    const ui = ((json as any)?.user_info ?? json) as XtreamUserInfo;
    return ui ?? {};
  } finally {
    clearTimeout(t);
  }
}

export const verifyAndLinkStream = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { username: string; password: string; server?: string }) => {
    const username = String(d.username ?? "").trim();
    const password = String(d.password ?? "");
    if (username.length < 2 || username.length > 120) throw new Error("Username 2-120 chars");
    if (password.length < 2 || password.length > 200) throw new Error("Password 2-200 chars");
    return { username, password, server: normalizeServer(String(d.server ?? "")) };
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    let info: XtreamUserInfo;
    try {
      info = await probeXtream(data.server, data.username, data.password);
    } catch (e: any) {
      return { ok: false as const, error: e?.message || "Could not reach stream server" };
    }
    const status = (info.status || (info.auth === 1 ? "Active" : "Unknown")).toString();
    const expUnix = Number(info.exp_date);
    const expiresAt = Number.isFinite(expUnix) && expUnix > 0 ? new Date(expUnix * 1000).toISOString() : null;

    // Save credentials regardless (lets Boss re-verify later)
    {
      const { error } = await supabase.rpc("set_stream_credentials", {
        _user_id: userId, _username: data.username, _password: data.password, _server: data.server,
      });
      if (error) return { ok: false as const, error: error.message };
    }

    if (status !== "Active") {
      return { ok: false as const, error: `Stream account not active (status: ${status})`, status };
    }

    const { error: vErr } = await supabase.rpc("mark_stream_verified", {
      _user_id: userId, _status: status, _expires_at: expiresAt,
    });
    if (vErr) return { ok: false as const, error: vErr.message };
    return { ok: true as const, status, expiresAt };
  });

export const reverifyStream = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId?: string } | undefined) => ({ userId: d?.userId ? String(d.userId) : "" }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    const targetId = data.userId || userId;
    const { data: prof, error } = await supabase
      .from("profiles")
      .select("stream_username,stream_password,stream_server")
      .eq("id", targetId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!prof?.stream_username || !prof?.stream_password) {
      return { ok: false as const, error: "No stream credentials saved" };
    }
    const server = normalizeServer(prof.stream_server || "");
    let info: XtreamUserInfo;
    try {
      info = await probeXtream(server, prof.stream_username, prof.stream_password);
    } catch (e: any) {
      return { ok: false as const, error: e?.message || "Could not reach stream server" };
    }
    const status = (info.status || (info.auth === 1 ? "Active" : "Unknown")).toString();
    const expUnix = Number(info.exp_date);
    const expiresAt = Number.isFinite(expUnix) && expUnix > 0 ? new Date(expUnix * 1000).toISOString() : null;
    const { error: vErr } = await supabase.rpc("mark_stream_verified", {
      _user_id: targetId, _status: status, _expires_at: expiresAt,
    });
    if (vErr) return { ok: false as const, error: vErr.message };
    return { ok: status === "Active", status, expiresAt };
  });