"use client";

import { useEffect, useState } from "react";
import { CloseIcon, ArrowIcon } from "@/components/icons";
import { ContactForm } from "@/components/contact-form";

export function HomeInquiryDialog({ homeName }: { homeName: string }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-brand-700 px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2"
      >
        Ask about this home <ArrowIcon className="size-4" />
      </button>
      {open && (
        <div
          className="fixed inset-0 z-[80] flex items-end bg-brand-950/55 p-3 backdrop-blur-sm sm:items-center sm:justify-center sm:p-6"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
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
                onClick={() => setOpen(false)}
                aria-label="Close inquiry form"
                className="grid size-10 shrink-0 place-items-center rounded-full text-stone-muted transition hover:bg-stone-sunken hover:text-stone-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
              >
                <CloseIcon className="size-5" />
              </button>
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
