"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CloseIcon, ArrowIcon } from "@/components/icons";
import { ContactForm } from "@/components/contact-form";
import { site } from "@/lib/site";
import { track } from "@/lib/analytics";

export function HomeInquiryDialog({
  homeName,
  label = "Ask about this home",
  className,
  showArrow = true,
}: {
  homeName: string;
  label?: string;
  className?: string;
  showArrow?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLAnchorElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const textMessage = encodeURIComponent(
    `Hi Home Placer, I’m interested in the ${homeName}.`,
  );
  const closeDialog = useCallback(() => {
    setOpen(false);
    triggerRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeDialog();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, closeDialog]);

  return (
    <>
      <a
        ref={triggerRef}
        href={`/contact?home=${encodeURIComponent(homeName)}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={(event) => {
          // Keep the real contact-page URL as progressive fallback. JavaScript
          // users stay on the card page and get the faster in-place dialog.
          event.preventDefault();
          track("pricing_inquiry", { placement: "main_content" });
          setOpen(true);
        }}
        className={className ?? "inline-flex items-center justify-center gap-1.5 rounded-lg bg-brand-700 px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2"}
      >
        {label} {showArrow && <ArrowIcon className="size-4" />}
      </a>
      {open && (
        <div
          className="fixed inset-0 z-[80] flex items-end bg-brand-950/55 p-3 backdrop-blur-sm sm:items-center sm:justify-center sm:p-6"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeDialog();
            }
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="home-inquiry-title"
            className="max-h-[calc(100dvh-1.5rem)] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl sm:p-8"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-brand-600">Quick question</p>
                <h2 id="home-inquiry-title" className="mt-1 font-display text-2xl font-semibold text-stone-ink">
                  Ask about {homeName}
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-stone-muted">
                  Tell us what you&apos;d like to know. A Home Placer team member will get back to you directly.
                </p>
              </div>
              <button
                type="button"
                ref={closeRef}
                onClick={closeDialog}
                aria-label="Close inquiry form"
                className="grid size-10 shrink-0 place-items-center rounded-full text-stone-muted transition hover:bg-stone-sunken hover:text-stone-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
              >
                <CloseIcon className="size-5" />
              </button>
            </div>
            <div className="mt-5 flex flex-wrap gap-2 border-y border-stone-line py-4 text-sm font-semibold">
              <a
                href={`tel:${site.phoneDial}`}
                className="rounded-full bg-brand-700 px-4 py-2 text-white transition hover:bg-brand-800"
              >
                Call {site.phoneDisplay}
              </a>
              <a
                href={`sms:${site.phoneDial}?body=${textMessage}`}
                className="rounded-full border border-brand-200 px-4 py-2 text-brand-800 transition hover:border-brand-400 hover:bg-brand-50"
              >
                Text us
              </a>
              <a
                href={`mailto:${site.email}?subject=${encodeURIComponent(`Question about ${homeName}`)}`}
                className="rounded-full border border-brand-200 px-4 py-2 text-brand-800 transition hover:border-brand-400 hover:bg-brand-50"
              >
                Email us
              </a>
            </div>
            <div className="mt-6">
              <ContactForm defaultHome={homeName} />
            </div>
          </section>
        </div>
      )}
    </>
  );
}
