import { createFileRoute, notFound, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { HubSectionsRenderer } from "@/components/HubSectionsRenderer";
import { HubSectionsZ, type HubSection } from "@/lib/hub-sections";
import { useAuth } from "@/hooks/use-auth";
import { requireBossHub } from "@/lib/route-guards";

export const Route = createFileRoute("/hub/$slug")({
  beforeLoad: requireBossHub,
  component: HubPage,
  notFoundComponent: () => (
    <div className="max-w-xl mx-auto px-6 py-24 text-center">
      <h1 className="text-3xl font-black mb-3">Hub not found</h1>
      <p className="text-muted-foreground text-sm mb-6">This hub may be unpublished or hidden.</p>
      <Link to="/" className="text-sm underline">← Back home</Link>
    </div>
  ),
  errorComponent: ({ error, reset }) => {
    const router = useRouter();
    return (
      <div className="max-w-xl mx-auto px-6 py-24 text-center">
        <h1 className="text-2xl font-black mb-3">Couldn't load hub</h1>
        <p className="text-muted-foreground text-sm mb-6">{error.message}</p>
        <button onClick={() => { router.invalidate(); reset(); }}
                className="text-sm underline">Retry</button>
      </div>
    );
  },
});

function HubPage() {
  const { slug } = Route.useParams();
  const { user, loading: authLoading } = useAuth();
  const [hub, setHub] = useState<any | null>(null);
  const [sections, setSections] = useState<HubSection[]>([]);
  const [state, setState] = useState<"loading" | "ok" | "missing">("loading");

  useEffect(() => {
    let alive = true;
    setState("loading");
    void supabase
      .from("custom_hubs")
      .select("id,slug,title,tagline,description,accent,sections,visibility,published")
      .eq("slug", slug)
      .maybeSingle()
      .then(({ data }) => {
        if (!alive) return;
        if (!data) {
          setState("missing");
          return;
        }
        setHub(data);
        const parsed = HubSectionsZ.safeParse(data.sections ?? []);
        setSections(parsed.success ? parsed.data : []);
        setState("ok");
      });
    return () => { alive = false; };
  }, [slug, user]);

  if (authLoading || state === "loading") {
    return (
      <div className="max-w-xl mx-auto px-6 py-24 text-center text-muted-foreground text-sm">
        <Loader2 className="h-5 w-5 animate-spin inline mr-2" /> Loading hub…
      </div>
    );
  }

  if (state === "missing" || !hub) {
    throw notFound();
  }

  return (
    <div className="relative">
      <div className="max-w-6xl mx-auto px-5 sm:px-8 pt-6">
        <Link to="/" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3 w-3" /> Home
        </Link>
      </div>
      <HubSectionsRenderer hub={hub} sections={sections} />
    </div>
  );
}