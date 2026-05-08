import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

async function isAdmin(supabase: any, userId: string): Promise<boolean> {
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  return !!data;
}

async function requireAdmin(ctx: any) {
  const { supabase, userId } = ctx as { supabase: any; userId: string };
  if (!(await isAdmin(supabase, userId))) throw new Error("Admin only");
  return { supabase, userId };
}

// ---------- SCOUT: Firecrawl latest news ----------
async function firecrawlScout(company: string, hint?: string): Promise<{ summary: string; news: any[] }> {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) throw new Error("FIRECRAWL_API_KEY missing");
  const query = `${company} latest news press release funding announcement 2026`;
  const res = await fetch("https://api.firecrawl.dev/v2/search", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      query,
      limit: 5,
      tbs: "qdr:m",
      scrapeOptions: { formats: ["markdown"] },
    }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`Firecrawl ${res.status}: ${t.slice(0, 200)}`);
  }
  const json: any = await res.json();
  const list: any[] = json.data?.web ?? json.data ?? json.web ?? [];
  const news = list.slice(0, 5).map((r: any) => ({
    title: r.title ?? r.metadata?.title ?? "",
    url: r.url ?? r.metadata?.sourceURL ?? "",
    snippet: (r.description ?? r.markdown ?? "").slice(0, 400),
  }));
  const summary = news.map((n) => `• ${n.title}: ${n.snippet}`).join("\n").slice(0, 1500);
  return { summary, news };
}

// ---------- ENRICH: Apollo people search ----------
async function apolloFindPeople(company: string): Promise<any[]> {
  const apiKey = process.env.APOLLO_API_KEY;
  if (!apiKey) throw new Error("APOLLO_API_KEY missing");
  const res = await fetch("https://api.apollo.io/api/v1/mixed_people/search", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Api-Key": apiKey },
    body: JSON.stringify({
      q_organization_name: company,
      person_titles: ["CEO", "Founder", "Co-Founder", "Head of Growth", "VP Marketing", "Chief Marketing Officer"],
      page: 1,
      per_page: 10,
      reveal_personal_emails: false,
    }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`Apollo ${res.status}: ${t.slice(0, 200)}`);
  }
  const json: any = await res.json();
  const people = json.people ?? json.contacts ?? [];
  return people.slice(0, 10).map((p: any) => ({
    full_name: p.name ?? `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim(),
    job_title: p.title ?? null,
    email: p.email ?? null,
    linkedin_url: p.linkedin_url ?? null,
    company: p.organization?.name ?? company,
    raw: p,
  }));
}

// ---------- WRITE: Gemini draft ----------
async function geminiDraft(person: any, news: any[], offer: string): Promise<{ subject: string; body: string }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY missing");
  const newsBlock = news.map((n) => `- ${n.title}`).join("\n");
  const prompt = `You are an elite cold-email writer. Write a 3-sentence email.

Recipient: ${person.full_name}, ${person.job_title} at ${person.company}.

Recent company news:
${newsBlock}

Our offer: ${offer}

Rules:
- Sentence 1: Congratulate them on a SPECIFIC item from the news above (name it).
- Sentence 2: Connect that news to why they need our offer.
- Sentence 3: Low-friction CTA (e.g., "open to a 10-min call?").
- Friendly, punchy, no fluff, no emojis.

Return JSON only: {"subject":"...","body":"..."}`;
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json" },
      }),
    }
  );
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`Gemini ${res.status}: ${t.slice(0, 200)}`);
  }
  const json: any = await res.json();
  const text = json.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
  try {
    const parsed = JSON.parse(text);
    return { subject: parsed.subject ?? "Quick note", body: parsed.body ?? "" };
  } catch {
    return { subject: "Quick note", body: text.slice(0, 800) };
  }
}

// ---------- CREATE CAMPAIGN (Scout + Enrich + Draft) ----------
export const createConnectCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        targetCompany: z.string().min(2).max(120),
        targetUrl: z.string().url().optional().or(z.literal("")),
        icp: z.string().min(2).max(500),
        offer: z.string().min(2).max(500),
      })
      .parse(d)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = await requireAdmin(context);

    const { summary, news } = await firecrawlScout(data.targetCompany, data.targetUrl || undefined);
    const people = await apolloFindPeople(data.targetCompany);

    const { data: campaign, error: cErr } = await supabase
      .from("connect_campaigns")
      .insert({
        created_by: userId,
        target_company: data.targetCompany,
        target_url: data.targetUrl || null,
        icp: data.icp,
        offer: data.offer,
        status: "drafted",
        scout_summary: summary,
        scout_news: news,
      })
      .select()
      .single();
    if (cErr) throw new Error(cErr.message);

    // Draft emails for the first 5 to limit AI cost
    const draftSlice = people.slice(0, 5);
    const drafts = await Promise.all(
      draftSlice.map(async (p) => {
        try {
          return await geminiDraft(p, news, data.offer);
        } catch {
          return { subject: "Quick note", body: "" };
        }
      })
    );

    const rows = people.map((p, i) => ({
      campaign_id: campaign.id,
      full_name: p.full_name,
      job_title: p.job_title,
      email: p.email,
      linkedin_url: p.linkedin_url,
      company: p.company,
      news_snippet: news[0]?.title ?? null,
      email_subject: drafts[i]?.subject ?? null,
      email_body: drafts[i]?.body ?? null,
      send_status: p.email ? "drafted" : "no_email",
      apollo_payload: p.raw ?? {},
    }));
    if (rows.length) {
      const { error: lErr } = await supabase.from("connect_leads").insert(rows);
      if (lErr) throw new Error(lErr.message);
    }
    return { campaignId: campaign.id, leadCount: rows.length, news };
  });

// ---------- LAUNCH: Push to Instantly ----------
export const launchConnectCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ campaignId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = await requireAdmin(context);
    const apiKey = process.env.INSTANTLY_API_KEY;
    if (!apiKey) throw new Error("INSTANTLY_API_KEY missing");

    const { data: campaign } = await supabase
      .from("connect_campaigns")
      .select("*")
      .eq("id", data.campaignId)
      .single();
    if (!campaign) throw new Error("Campaign not found");

    const { data: leads } = await supabase
      .from("connect_leads")
      .select("*")
      .eq("campaign_id", data.campaignId)
      .not("email", "is", null);
    const validLeads = (leads ?? []).filter((l: any) => l.email && l.email_body);

    // Inbox-rotation precheck: ensure we have capacity across active domains
    const today = new Date().toISOString().slice(0, 10);
    await supabase
      .from("connect_sending_domains")
      .update({ sent_today: 0, last_reset: today })
      .lt("last_reset", today);
    const { data: domains } = await supabase
      .from("connect_sending_domains")
      .select("*")
      .eq("active", true);
    const capacity = (domains ?? []).reduce(
      (s: number, d: any) => s + Math.max(0, d.daily_cap - d.sent_today),
      0
    );
    if (capacity < validLeads.length) {
      throw new Error(
        `Inbox-rotation cap: ${capacity} sends available today across ${domains?.length ?? 0} domains, need ${validLeads.length}.`
      );
    }

    let campaignName = `ConnectHUB · ${campaign.target_company} · ${new Date().toISOString().slice(0, 10)}`;
    let instantlyCampaignId = campaign.instantly_campaign_id;

    // Create campaign in Instantly v2 if needed
    if (!instantlyCampaignId) {
      const cRes = await fetch("https://api.instantly.ai/api/v2/campaigns", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          name: campaignName,
          campaign_schedule: {
            schedules: [
              {
                name: "Default",
                timing: { from: "09:00", to: "17:00" },
                days: { "1": true, "2": true, "3": true, "4": true, "5": true },
                timezone: "Etc/GMT",
              },
            ],
          },
        }),
      });
      if (!cRes.ok) {
        const t = await cRes.text().catch(() => "");
        throw new Error(`Instantly campaign ${cRes.status}: ${t.slice(0, 200)}`);
      }
      const cJson: any = await cRes.json();
      instantlyCampaignId = cJson.id ?? cJson.campaign_id ?? cJson.data?.id;
      await supabase
        .from("connect_campaigns")
        .update({ instantly_campaign_id: instantlyCampaignId, status: "launching" })
        .eq("id", data.campaignId);
    }

    // Push leads
    let pushed = 0;
    for (const lead of validLeads) {
      const lRes = await fetch("https://api.instantly.ai/api/v2/leads", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          campaign: instantlyCampaignId,
          email: lead.email,
          first_name: (lead.full_name ?? "").split(" ")[0],
          last_name: (lead.full_name ?? "").split(" ").slice(1).join(" "),
          company_name: lead.company,
          personalization: lead.email_body,
          custom_variables: { subject: lead.email_subject, news: lead.news_snippet ?? "" },
        }),
      });
      if (lRes.ok) {
        pushed++;
        await supabase
          .from("connect_leads")
          .update({ send_status: "queued" })
          .eq("id", lead.id);
      }
    }

    // Decrement domain capacity round-robin
    let remaining = pushed;
    for (const d of domains ?? []) {
      if (remaining <= 0) break;
      const take = Math.min(remaining, d.daily_cap - d.sent_today);
      if (take > 0) {
        await supabase
          .from("connect_sending_domains")
          .update({ sent_today: d.sent_today + take })
          .eq("id", d.id);
        remaining -= take;
      }
    }

    await supabase
      .from("connect_campaigns")
      .update({ status: "live" })
      .eq("id", data.campaignId);

    return { pushed, instantlyCampaignId };
  });

// ---------- LIVE STATS from Instantly ----------
export const getCampaignStats = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ campaignId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = await requireAdmin(context);
    const apiKey = process.env.INSTANTLY_API_KEY;
    if (!apiKey) throw new Error("INSTANTLY_API_KEY missing");
    const { data: c } = await supabase
      .from("connect_campaigns")
      .select("instantly_campaign_id")
      .eq("id", data.campaignId)
      .single();
    if (!c?.instantly_campaign_id) return { sent: 0, opens: 0, replies: 0, clicks: 0 };
    const res = await fetch(
      `https://api.instantly.ai/api/v2/campaigns/${c.instantly_campaign_id}/analytics`,
      { headers: { Authorization: `Bearer ${apiKey}` } }
    );
    if (!res.ok) return { sent: 0, opens: 0, replies: 0, clicks: 0, error: `Instantly ${res.status}` };
    const json: any = await res.json();
    return {
      sent: json.emails_sent_count ?? json.sent ?? 0,
      opens: json.open_count ?? json.opens ?? 0,
      replies: json.reply_count ?? json.replies ?? 0,
      clicks: json.link_click_count ?? json.clicks ?? 0,
    };
  });

// ---------- LIST campaigns + leads ----------
export const listConnectCampaigns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context);
    const { supabase } = context as { supabase: any };
    const { data } = await supabase
      .from("connect_campaigns")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    return { campaigns: data ?? [] };
  });

export const listCampaignLeads = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ campaignId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { supabase } = context as { supabase: any };
    const { data: leads } = await supabase
      .from("connect_leads")
      .select("*")
      .eq("campaign_id", data.campaignId)
      .order("created_at", { ascending: false });
    return { leads: leads ?? [] };
  });

// ---------- SENDING DOMAINS CRUD ----------
export const listSendingDomains = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context);
    const { supabase } = context as { supabase: any };
    const today = new Date().toISOString().slice(0, 10);
    await supabase
      .from("connect_sending_domains")
      .update({ sent_today: 0, last_reset: today })
      .lt("last_reset", today);
    const { data } = await supabase
      .from("connect_sending_domains")
      .select("*")
      .order("created_at", { ascending: false });
    return { domains: data ?? [] };
  });

export const upsertSendingDomain = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        domain: z.string().min(3).max(255),
        dailyCap: z.number().int().min(1).max(500).default(30),
        active: z.boolean().default(true),
      })
      .parse(d)
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { supabase } = context as { supabase: any };
    const { error } = await supabase
      .from("connect_sending_domains")
      .upsert(
        { domain: data.domain.toLowerCase(), daily_cap: data.dailyCap, active: data.active },
        { onConflict: "domain" }
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteSendingDomain = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { supabase } = context as { supabase: any };
    await supabase.from("connect_sending_domains").delete().eq("id", data.id);
    return { ok: true };
  });
