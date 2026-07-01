"use client";

import { useEffect } from "react";
import { track } from "@/lib/analytics";

// One capture-phase listener for every tel: link on the site, so a "phone_call"
// GA4 event fires no matter which phone link a visitor taps (header, hero,
// footer, contact page, location pages). No per-link wiring needed.
export function AnalyticsEvents() {
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const link = (e.target as Element | null)?.closest?.('a[href^="tel:"]');
      if (link) {
        track("phone_call", { phone: link.getAttribute("href")?.replace("tel:", "") ?? "" });
      }
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);
  return null;
}
