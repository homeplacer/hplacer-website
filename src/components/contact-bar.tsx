"use client";

import { useEffect, useState } from "react";
import { PhoneIcon } from "@/components/icons";
import { site } from "@/lib/site";

/**
 * Persistent, low-friction contact controls. This is intentionally present on
 * every route: a buyer can call or text from an inventory page without hunting
 * for a form or returning to the homepage.
 */
export function ContactBar() {
  const [hiddenForForm, setHiddenForForm] = useState(false);
  const textMessage = encodeURIComponent(
    "Hi Home Placer, I’m interested in a manufactured home and land package.",
  );

  useEffect(() => {
    const forms = [...document.querySelectorAll("form")];
    if (!forms.length) return;
    const visible = new Set<Element>();
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) visible.add(entry.target);
        else visible.delete(entry.target);
      }
      setHiddenForForm(visible.size > 0);
    }, { threshold: 0.2 });
    forms.forEach((form) => observer.observe(form));
    return () => observer.disconnect();
  }, []);
  return (
    <aside
      data-contact-bar
      aria-label="Contact Home Placer"
      className={`fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-[60] mx-auto max-w-md rounded-2xl border border-brand-800/15 bg-brand-950/95 p-1.5 shadow-2xl backdrop-blur-lg transition duration-200 ${hiddenForForm ? "pointer-events-none translate-y-24 opacity-0" : "translate-y-0 opacity-100"}`}
    >
      <div className="flex items-center gap-1.5">
        <a
          href={`tel:${site.phoneDial}`}
          aria-label={`Call Home Placer at ${site.phoneDisplay}`}
          className="inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl bg-white px-3 text-sm font-semibold text-brand-900 transition hover:bg-brand-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-brand-950"
        >
          <PhoneIcon className="size-4" /> Call us
        </a>
        <a
          href={`sms:${site.phoneDial}?body=${textMessage}`}
          aria-label={`Text Home Placer at ${site.phoneDisplay}`}
          className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl bg-white/10 px-3 text-sm font-semibold text-white transition hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-brand-950"
        >
          Text us
        </a>
        <a
          href={`mailto:${site.email}`}
          aria-label="Email Home Placer"
          className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl bg-white/10 px-3 text-sm font-semibold text-white transition hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-brand-950"
        >
          Email
        </a>
      </div>
    </aside>
  );
}
