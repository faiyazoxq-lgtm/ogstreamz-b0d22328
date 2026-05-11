import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

let cache: string[] | null = null;
const listeners = new Set<(v: string[]) => void>();
let loadPromise: Promise<string[]> | null = null;
let realtimeBound = false;

function normalize(d: string): string {
  return d
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/:\d+$/, "")
    .replace(/^www\./, "");
}

async function load(): Promise<string[]> {
  if (cache) return cache;
  if (loadPromise) return loadPromise;
  loadPromise = supabase
    .from("domain_denylist")
    .select("domain")
    .then(({ data }) => {
      cache = (data ?? []).map((r) => normalize(r.domain)).filter(Boolean);
      listeners.forEach((cb) => cb(cache!));
      return cache;
    });
  return loadPromise;
}

function bindRealtime() {
  if (realtimeBound) return;
  realtimeBound = true;
  supabase
    .channel("domain-denylist")
    .on("postgres_changes", { event: "*", schema: "public", table: "domain_denylist" }, () => {
      cache = null;
      loadPromise = null;
      load();
    })
    .subscribe();
}

export function useDomainDenylist(): string[] {
  const [list, setList] = useState<string[]>(cache ?? []);
  useEffect(() => {
    listeners.add(setList);
    bindRealtime();
    load().then(setList);
    return () => {
      listeners.delete(setList);
    };
  }, []);
  return list;
}

export function buildDenylistRegex(domains: string[]): RegExp | null {
  const safe = domains.map((d) => d.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).filter(Boolean);
  if (!safe.length) return null;
  // match optional scheme, optional www., the domain, optional port/path/query
  return new RegExp(
    `(?:https?:\\/\\/)?(?:www\\.)?(?:${safe.join("|")})(?::\\d+)?(?:\\/[^\\s<"']*)?`,
    "gi",
  );
}

export function urlMatchesDenylist(url: string, domains: string[]): boolean {
  if (!url) return false;
  let host: string;
  try {
    host = new URL(url, "https://placeholder.invalid").hostname;
  } catch {
    host = url;
  }
  host = normalize(host);
  return domains.some((d) => host === d || host.endsWith("." + d));
}

export { normalize as normalizeDomain };