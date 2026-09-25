"use client";

import { useEffect, useState } from "react";
import { MailIcon, MessageIcon, PhoneIcon } from "@/components/icons";
import { HomeInquiryDialog } from "@/components/home-inquiry-dialog";
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
  const visibility = hiddenForForm
    ? "pointer-events-none translate-y-24 opacity-0"
    : "translate-y-0 opacity-100";

  return (
    <>
      <aside
        data-contact-bar
        aria-label="Contact Home Placer"
        className={`fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-[60] mx-auto max-w-sm rounded-[1.45rem] border border-white/10 bg-brand-950/95 p-1.5 shadow-2xl backdrop-blur-lg transition duration-200 ${visibility}`}
      >
        <div className="grid grid-cols-3 gap-1.5">
          <a
            href={`tel:${site.phoneDial}`}
            aria-label={`Call Home Placer at ${site.phoneDisplay}`}
            className="inline-flex min-h-14 flex-col items-center justify-center gap-1 rounded-[1rem] bg-white px-3 text-xs font-semibold text-brand-900 transition hover:bg-brand-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-brand-950"
          >
            <PhoneIcon className="size-[18px]" /> Call
          </a>
          <a
            href={`sms:${site.phoneDial}?body=${textMessage}`}
            aria-label={`Text Home Placer at ${site.phoneDisplay}`}
            className="inline-flex min-h-14 flex-col items-center justify-center gap-1 rounded-[1rem] bg-white/10 px-3 text-xs font-semibold text-white transition hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-brand-950"
          >
            <MessageIcon className="size-[18px]" /> Text
          </a>
          <a
            href={`mailto:${site.email}`}
            aria-label="Email Home Placer"
            className="inline-flex min-h-14 flex-col items-center justify-center gap-1 rounded-[1rem] bg-white/10 px-3 text-xs font-semibold text-white transition hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-brand-950"
          >
            <MailIcon className="size-[18px]" /> Email
          </a>
        </div>
      </aside>

      <HomeInquiryDialog
        homeName="a Home Placer land-home package"
        label="Contact us"
        showArrow={false}
        className={`fixed bottom-[calc(max(0.75rem,env(safe-area-inset-bottom))+5.75rem)] right-3 z-[60] inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-accent-500 px-5 text-sm font-semibold text-white shadow-xl transition duration-200 hover:bg-accent-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-700 focus-visible:ring-offset-2 sm:bottom-[max(1.25rem,env(safe-area-inset-bottom))] sm:right-5 ${visibility}`}
      />
    </>
  );
}
