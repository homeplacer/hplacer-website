"use client";

import { useEffect } from "react";
import { track } from "@/lib/analytics";

function modelSlugFromPath(pathname: string) {
  const match = pathname.match(/^\/homes\/([^/?#]+)\/?$/);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

function linkPlacement(link: Element) {
  if (link.closest("header")) return "header";
  if (link.closest("footer")) return "footer";
  if (link.closest("nav")) return "navigation";
  if (link.closest("main")) return "main_content";
  return "other";
}

// One capture-phase listener for every tel: link on the site, so a "phone_call"
// GA4 event fires no matter which phone link a visitor taps (header, hero,
// footer, contact page, location pages). No per-link wiring needed.
export function AnalyticsEvents() {
  useEffect(() => {
    const viewedModel = modelSlugFromPath(window.location.pathname);
    if (viewedModel) {
      track("view_model", {
        model_context: viewedModel,
        page_path: window.location.pathname,
      });
    }

    const onClick = (e: MouseEvent) => {
      const link = (e.target as Element | null)?.closest?.("a[href]");
      if (!link) return;

      const href = link.getAttribute("href") ?? "";
      const placement = linkPlacement(link);

      if (href.startsWith("tel:")) {
        track("phone_call", {
          placement,
          page_path: window.location.pathname,
        });
        return;
      }

      const modelContext = modelSlugFromPath(href);
      if (modelContext) {
        track("select_model", {
          model_context: modelContext,
          placement,
          page_path: window.location.pathname,
        });
        return;
      }

      try {
        const destination = new URL(href, window.location.origin);
        if (destination.hostname === "forturro.com" || destination.hostname === "www.forturro.com") {
          track("land_search_click", {
            destination: `${destination.hostname}${destination.pathname}`,
            link_text: link.textContent?.trim().slice(0, 80) || "forturro_handoff",
            placement,
            page_path: window.location.pathname,
          });
        }
      } catch {
        // Ignore malformed href values; navigation should continue normally.
      }
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);
  return null;
}
