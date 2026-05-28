import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ChevronDown, type LucideIcon } from "lucide-react";
import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * Single-line tab bar that auto-collapses overflowing items into a
 * "More" dropdown. Used across the Boss Mega Dashboard so every tab
 * surface fits the viewport on narrow screens.
 *
 * Must be rendered inside a Radix <Tabs value onValueChange> wrapper.
 * The same `onChange` passed to <Tabs> is forwarded here so overflow
 * menu items can switch tabs from outside the visible TabsTrigger row.
 */
export type ResponsiveTabItem = {
  id: string;
  label: string;
  Icon: LucideIcon;
  tint: string;
  purpose?: string;
};

export function ResponsiveTabsList({
  items,
  value,
  onChange,
}: {
  items: readonly ResponsiveTabItem[];
  value: string;
  onChange: (id: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const [visibleCount, setVisibleCount] = useState(items.length);

  const useIso =
    typeof window !== "undefined" ? useLayoutEffect : useEffect;

  useIso(() => {
    const container = containerRef.current;
    const measure = measureRef.current;
    if (!container || !measure) return;

    const recalc = () => {
      const containerW = container.clientWidth;
      const kids = Array.from(measure.children) as HTMLElement[];
      if (!kids.length) return;
      // gap-1 between items (4px). Reserve ~88px for the More button.
      const GAP = 4;
      const MORE = 92;
      let used = 0;
      let count = 0;
      for (let i = 0; i < kids.length; i++) {
        const w = kids[i].offsetWidth + (i > 0 ? GAP : 0);
        const willOverflow = i < kids.length - 1; // last item gets to skip MORE
        const limit = containerW - (willOverflow ? MORE + GAP : 0);
        if (used + w <= limit) {
          used += w;
          count = i + 1;
        } else {
          break;
        }
      }
      // Always keep the active tab visible — pull it forward if hidden.
      const activeIdx = items.findIndex((it) => it.id === value);
      const next = Math.max(1, count);
      setVisibleCount(activeIdx >= next ? Math.max(next, 1) : next);
    };

    recalc();
    const ro = new ResizeObserver(recalc);
    ro.observe(container);
    return () => ro.disconnect();
  }, [items, value]);

  // Reorder so the active tab is always within the visible window.
  const activeIdx = items.findIndex((it) => it.id === value);
  const ordered =
    activeIdx >= visibleCount && activeIdx >= 0
      ? [items[activeIdx], ...items.filter((_, i) => i !== activeIdx)]
      : [...items];

  const visible = ordered.slice(0, visibleCount);
  const overflow = ordered.slice(visibleCount);

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Off-screen measurer renders every label at full size so we can
          decide how many fit on a single line. aria-hidden + opacity-0 so
          assistive tech and visuals ignore it. */}
      <div
        ref={measureRef}
        aria-hidden="true"
        className="pointer-events-none invisible absolute inset-0 flex flex-nowrap gap-1 overflow-hidden"
      >
        {items.map((t) => (
          <span
            key={`m-${t.id}`}
            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium"
          >
            <t.Icon className="h-3.5 w-3.5" />
            {t.label}
          </span>
        ))}
      </div>

      <TabsList className="flex w-full flex-nowrap items-center gap-1 overflow-hidden rounded-xl bg-white/5 p-1 h-auto">
        {visible.map((t) => (
          <TabsTrigger
            key={t.id}
            value={t.id}
            title={t.purpose}
            className="data-[state=active]:bg-white/10 data-[state=active]:text-white text-white/60 gap-1.5 flex-shrink-0"
          >
            <t.Icon className="h-3.5 w-3.5" style={{ color: t.tint }} />
            {t.label}
          </TabsTrigger>
        ))}

        {overflow.length > 0 ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="ml-auto inline-flex flex-shrink-0 items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold text-white/70 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                aria-label={`More tabs (${overflow.length})`}
              >
                More
                <span className="rounded-sm bg-white/10 px-1 text-[10px] leading-4 text-white/70">
                  {overflow.length}
                </span>
                <ChevronDown className="h-3 w-3" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="min-w-[12rem] border-white/10 bg-black/90 backdrop-blur-xl"
            >
              {overflow.map((t) => (
                <DropdownMenuItem
                  key={t.id}
                  onSelect={() => onChange(t.id)}
                  className="gap-2 text-white/80 focus:bg-white/10 focus:text-white"
                >
                  <t.Icon className="h-3.5 w-3.5" style={{ color: t.tint }} />
                  <span className="flex-1">{t.label}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </TabsList>
    </div>
  );
}