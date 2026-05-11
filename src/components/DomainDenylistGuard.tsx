import { useEffect, useMemo } from "react";
import { useRouterState } from "@tanstack/react-router";
import { useDomainDenylist, buildDenylistRegex, urlMatchesDenylist } from "@/lib/use-domain-denylist";

const HIDDEN_TOKEN = "[hidden]";
const SCRUB_ATTRS = ["href", "src", "action", "data-href", "data-url", "poster"];
const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE", "CODE", "PRE"]);

/**
 * Removes any reference to Boss-denylisted domains from the rendered DOM.
 * Strips matching <a>/<iframe>/<img> nodes, blanks form actions, and
 * replaces the domain text inside any visible text node with [hidden].
 * Skipped on the Boss management page so the Boss can still see/edit the list.
 */
export function DomainDenylistGuard() {
  const domains = useDomainDenylist();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isBossManagePage = pathname.startsWith("/boss/domain-denylist");

  const regex = useMemo(() => buildDenylistRegex(domains), [domains]);

  useEffect(() => {
    if (isBossManagePage || !regex || domains.length === 0) return;
    if (typeof document === "undefined") return;

    const scrubAttrs = (el: Element) => {
      for (const attr of SCRUB_ATTRS) {
        const val = el.getAttribute(attr);
        if (!val) continue;
        if (urlMatchesDenylist(val, domains) || regex.test(val)) {
          regex.lastIndex = 0;
          if (attr === "href" || attr === "src" || attr === "action") {
            // Neutralise navigation/loading
            if (el.tagName === "A") {
              el.setAttribute("href", "#");
              el.setAttribute("aria-hidden", "true");
              (el as HTMLElement).style.display = "none";
            } else if (el.tagName === "IFRAME" || el.tagName === "IMG" || el.tagName === "VIDEO" || el.tagName === "SOURCE") {
              el.removeAttribute("src");
              (el as HTMLElement).style.display = "none";
            } else {
              el.setAttribute(attr, "");
            }
          } else {
            el.setAttribute(attr, "");
          }
        }
        regex.lastIndex = 0;
      }
    };

    const scrubTextNode = (node: Text) => {
      const v = node.nodeValue;
      if (!v) return;
      regex.lastIndex = 0;
      if (regex.test(v)) {
        regex.lastIndex = 0;
        node.nodeValue = v.replace(regex, HIDDEN_TOKEN);
      }
    };

    const walk = (root: Node) => {
      if (root.nodeType === Node.TEXT_NODE) {
        scrubTextNode(root as Text);
        return;
      }
      if (root.nodeType !== Node.ELEMENT_NODE) return;
      const el = root as Element;
      if (SKIP_TAGS.has(el.tagName)) return;
      // attribute scrubbing
      scrubAttrs(el);
      // walk children
      const tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
        acceptNode: (n) => {
          if (n.nodeType === Node.ELEMENT_NODE && SKIP_TAGS.has((n as Element).tagName)) {
            return NodeFilter.FILTER_REJECT;
          }
          return NodeFilter.FILTER_ACCEPT;
        },
      });
      let cur: Node | null = tw.nextNode();
      while (cur) {
        if (cur.nodeType === Node.TEXT_NODE) scrubTextNode(cur as Text);
        else scrubAttrs(cur as Element);
        cur = tw.nextNode();
      }
    };

    // initial sweep
    walk(document.body);

    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.type === "characterData" && m.target.nodeType === Node.TEXT_NODE) {
          scrubTextNode(m.target as Text);
        } else if (m.type === "attributes" && m.target.nodeType === Node.ELEMENT_NODE) {
          scrubAttrs(m.target as Element);
        } else if (m.type === "childList") {
          m.addedNodes.forEach(walk);
        }
      }
    });

    observer.observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: SCRUB_ATTRS,
    });

    return () => observer.disconnect();
  }, [regex, domains, isBossManagePage]);

  return null;
}