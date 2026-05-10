import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import {
  Crown, Radio, Image as ImageIcon, Package, ArrowLeft, Loader2,
  ShieldCheck, Clock, ExternalLink, Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { getStripe, getStripeEnvironment } from "@/lib/stripe";
import { createPassCheckoutSession } from "@/lib/pass-checkout.functions";
import { requireMember } from "@/lib/route-guards";
import { toast } from "sonner";

type Kind = "vip_pass" | "streams_pass" | "digital" | "nft";

type Product = {
  id: string;
  sku: string;
  kind: Kind;
  title: string;
  description: string | null;
  image_url: string | null;
  price_cents: number;
  currency: string;
  duration_days: number | null;
  asset_url: string | null;
  metadata: Record<string, any>;
  active: boolean;
  sort_order: number;
};

type Search = { tab?: Kind };
const KINDS: Kind[] = ["vip_pass", "streams_pass", "digital", "nft"];

export const Route = createFileRoute("/store/catalog")({
  beforeLoad: requireMember,
  validateSearch: (s: Record<string, unknown>): Search => ({
    tab: KINDS.includes(s.tab as Kind) ? (s.tab as Kind) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Vault Catalog · 0G-PORTAL" },
      { name: "description", content: "VIP Passes, Streams Passes, digital drops and NFT collections." },
    ],
  }),
  component: CatalogPage,
});

const TAB_META: Record<Kind, { label: string; icon: any; blurb: string }> = {
  vip_pass:     { label: "VIP Passes",     icon: Crown,      blurb: "Unlock everything. Priority queues, deep tools, all hubs." },
  streams_pass: { label: "Streams Passes", icon: Radio,      blurb: "Live streams + boss frequency for the duration of your pass." },
  digital:      { label: "Digital",        icon: Package,    blurb: "Downloadable drops — packs, presets, lyric kits." },
  nft:          { label: "NFT",            icon: ImageIcon,  blurb: "Collectible drops minted to the syndicate." },
};

function CatalogPage() {
  const { tab } = Route.useSearch();
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [active, setActive] = useState<Kind>(tab ?? "vip_pass");
  const [checkoutFor, setCheckoutFor] = useState<Product | null>(null);

  useEffect(() => { if (!loading && !user) navigate({ to: "/auth" }); }, [loading, user, navigate]);
  useEffect(() => { if (tab && tab !== active) setActive(tab); /* keep URL in sync */ }, [tab]);

  useEffect(() => {
    let cancelled = false;
    setLoadingProducts(true);
    supabase
      .from("store_products")
      .select("id,sku,kind,title,description,image_url,price_cents,currency,duration_days,asset_url,metadata,active,sort_order")
      .eq("active", true)
      .order("sort_order", { ascending: true })
      .order("price_cents", { ascending: true })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) toast.error(error.message);
        else setProducts((data ?? []) as Product[]);
        setLoadingProducts(false);
      });
    return () => { cancelled = true; };
  }, []);

  const tabs = useMemo(() => KINDS.map((k) => ({
    kind: k,
    count: products.filter((p) => p.kind === k).length,
    ...TAB_META[k],
  })), [products]);

  if (loading || !user) {
    return <main className="px-5 py-20 text-center text-muted-foreground">Loading catalog…</main>;
  }

  const filtered = products.filter((p) => p.kind === active);
  const meta = TAB_META[active];

  return (
    <main className="relative max-w-6xl mx-auto px-5 sm:px-8 py-12 sm:py-16">
      <div className="flex items-center justify-between gap-3">
        <Link to="/store" className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.3em] font-bold text-muted-foreground hover:text-white">
          <ArrowLeft className="h-4 w-4" /> Credits store
        </Link>
        <Link to="/account/passes" className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.3em] font-bold text-muted-foreground hover:text-white">
          My passes
          <ShieldCheck className="h-4 w-4" />
        </Link>
      </div>

      <header className="text-center mt-6 mb-8">
        <p className="text-xs uppercase tracking-[0.4em] font-semibold" style={{ color: "var(--neon-blue-bright)" }}>
          Vault Catalog
        </p>
        <h1 className="mt-3 font-[Montserrat] font-black text-4xl sm:text-6xl text-metallic">
          Pick your unlock
        </h1>
        <p className="mt-3 text-muted-foreground max-w-2xl mx-auto">
          Passes, drops and collections — one shelf, four channels.
        </p>
      </header>

      {/* Tabs */}
      <div role="tablist" aria-label="Catalog categories" className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-6">
        {tabs.map(({ kind, label, icon: Icon, count }) => {
          const isActive = active === kind;
          return (
            <button
              key={kind}
              role="tab"
              aria-selected={isActive}
              onClick={() => {
                setActive(kind);
                navigate({ to: "/store/catalog", search: { tab: kind } });
              }}
              className={`group flex items-center justify-between gap-2 rounded-xl border px-4 py-3 text-left transition-all ${
                isActive
                  ? "border-[oklch(0.72_0.22_245/0.7)] bg-[oklch(0.72_0.22_245/0.12)] shadow-[0_0_24px_-6px_oklch(0.72_0.22_245/0.8)]"
                  : "border-white/10 bg-black/40 hover:border-white/30"
              }`}
            >
              <span className="flex items-center gap-2">
                <Icon className={`h-4 w-4 ${isActive ? "text-[color:var(--neon-blue-bright)]" : "text-white/70"}`} />
                <span className="text-[11px] font-black uppercase tracking-[0.2em] text-white">{label}</span>
              </span>
              <span className="text-[10px] font-bold text-white/50 tabular-nums">{count}</span>
            </button>
          );
        })}
      </div>

      <p className="text-sm text-muted-foreground mb-6">{meta.blurb}</p>

      {loadingProducts ? (
        <p className="text-center py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 inline animate-spin mr-2" /> Loading vault…
        </p>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/15 bg-black/40 p-10 text-center">
          <Sparkles className="h-6 w-6 mx-auto text-white/40" />
          <p className="mt-3 text-sm text-muted-foreground">Nothing in this aisle yet — check back soon.</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((p) => (
            <ProductCard key={p.id} product={p} onBuy={() => setCheckoutFor(p)} />
          ))}
        </div>
      )}

      {checkoutFor && (
        <CheckoutDrawer
          product={checkoutFor}
          email={user.email ?? undefined}
          userId={user.id}
          onClose={() => setCheckoutFor(null)}
        />
      )}
    </main>
  );
}

function ProductCard({ product, onBuy }: { product: Product; onBuy: () => void }) {
  const purchasable = product.kind === "vip_pass" || product.kind === "streams_pass";
  const Icon = TAB_META[product.kind].icon;
  const price = (product.price_cents / 100).toFixed(2);
  const sym = currencySymbol(product.currency);
  const isLifetime = product.duration_days && product.duration_days >= 36500;

  return (
    <article className="relative rounded-2xl overflow-hidden border border-border bg-card flex flex-col">
      <div className="relative aspect-[16/9] bg-gradient-to-br from-[oklch(0.18_0.04_265)] via-[oklch(0.13_0.03_260)] to-[oklch(0.10_0.02_255)]">
        {product.image_url ? (
          <img src={product.image_url} alt={product.title} className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="absolute inset-0 grid place-items-center">
            <Icon className="h-12 w-12 text-white/30" />
          </div>
        )}
        <div className="absolute top-2 left-2 inline-flex items-center gap-1 rounded-full bg-black/70 backdrop-blur px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.3em] text-white/80 border border-white/15">
          <Icon className="h-3 w-3" /> {TAB_META[product.kind].label}
        </div>
        {isLifetime && (
          <div className="absolute top-2 right-2 rounded-full bg-amber-300 text-black px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.3em]">
            Lifetime
          </div>
        )}
      </div>

      <div className="p-5 flex-1 flex flex-col">
        <h3 className="font-[Montserrat] font-black text-lg text-white">{product.title}</h3>
        {product.description && (
          <p className="mt-1 text-xs text-muted-foreground line-clamp-3">{product.description}</p>
        )}

        <div className="mt-3 flex items-center gap-3 text-[11px] text-white/60">
          {product.duration_days ? (
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {isLifetime ? "Lifetime" : `${product.duration_days} day${product.duration_days === 1 ? "" : "s"}`}
            </span>
          ) : null}
          <span className="font-mono uppercase tracking-widest text-white/40">{product.sku}</span>
        </div>

        <div className="mt-4 flex items-end justify-between">
          <p className="font-[Montserrat] font-black text-3xl text-metallic">
            {sym}{price}
            <span className="ml-1 text-xs uppercase text-white/40">{product.currency.toUpperCase()}</span>
          </p>
        </div>

        <div className="mt-4">
          {purchasable ? (
            <Button onClick={onBuy} className="btn-glass-blue w-full text-white text-xs uppercase tracking-[0.25em] font-bold py-5">
              Buy {product.kind === "vip_pass" ? "VIP Pass" : "Streams Pass"}
            </Button>
          ) : product.asset_url ? (
            <a
              href={product.asset_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-white/15 bg-black/40 px-4 py-3 text-[11px] uppercase tracking-[0.25em] font-bold text-white/80 hover:border-white/40"
            >
              View drop <ExternalLink className="h-3.5 w-3.5" />
            </a>
          ) : (
            <p className="text-center text-[11px] uppercase tracking-[0.25em] text-white/40 py-3">
              Coming soon
            </p>
          )}
        </div>
      </div>
    </article>
  );
}

function CheckoutDrawer({
  product, email, userId, onClose,
}: { product: Product; email?: string; userId: string; onClose: () => void }) {
  const createSession = useServerFn(createPassCheckoutSession);

  const fetchClientSecret = async (): Promise<string> => {
    const secret = await createSession({
      data: {
        productId: product.id,
        userId,
        customerEmail: email,
        returnUrl: `${window.location.origin}/checkout/return?session_id={CHECKOUT_SESSION_ID}`,
        environment: getStripeEnvironment(),
      },
    });
    if (!secret) throw new Error("Could not start checkout");
    return secret;
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/90 backdrop-blur overflow-y-auto">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <button onClick={onClose} className="text-xs uppercase tracking-[0.3em] font-bold text-muted-foreground hover:text-white mb-4">
          ← Back to catalog
        </button>
        <h2 className="font-[Montserrat] font-black text-2xl text-metallic mb-1">{product.title}</h2>
        <p className="text-xs text-muted-foreground mb-4">
          {currencySymbol(product.currency)}{(product.price_cents / 100).toFixed(2)} {product.currency.toUpperCase()}
          {product.duration_days ? ` · ${product.duration_days} days` : ""}
        </p>
        <div id="checkout">
          <EmbeddedCheckoutProvider stripe={getStripe()} options={{ fetchClientSecret }}>
            <EmbeddedCheckout />
          </EmbeddedCheckoutProvider>
        </div>
      </div>
    </div>
  );
}

function currencySymbol(c: string) {
  switch ((c || "").toLowerCase()) {
    case "gbp": return "£";
    case "eur": return "€";
    case "usd":
    default:    return "$";
  }
}