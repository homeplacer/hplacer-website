"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowIcon, CloseIcon, PhoneIcon } from "@/components/icons";
import { FinancingForm } from "@/components/financing-form";
import { site } from "@/lib/site";
import { track } from "@/lib/analytics";

export function DownPaymentAssistanceDialog({
  label,
  className,
}: {
  label: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLAnchorElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
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
        href="/down-payment-assistance#learn-more"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={(event) => {
          // The full page remains a no-JavaScript fallback, but the homepage
          // conversion path stays in place for visitors with JavaScript.
          event.preventDefault();
          track("financing_click", { placement: "main_content" });
          setOpen(true);
        }}
        className={className}
      >
        {label} <ArrowIcon className="size-4" />
      </a>
      {open && (
        <div
          className="fixed inset-0 z-[80] flex items-end bg-brand-950/55 p-3 backdrop-blur-sm sm:items-center sm:justify-center sm:p-6"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeDialog();
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="assistance-dialog-title"
            className="max-h-[calc(100dvh-1.5rem)] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl sm:p-8"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-brand-600">
                  Down-payment assistance
                </p>
                <h2 id="assistance-dialog-title" className="mt-1 font-display text-2xl font-semibold text-stone-ink">
                  Get assistance details
                </h2>
                <p className="mt-4 font-display text-4xl font-semibold leading-none text-brand-800 sm:text-5xl">
                  $5,000–$50,000
                </p>
                <p className="mt-1 text-base font-semibold text-stone-ink">
                  in possible assistance for qualifying buyers
                </p>
                <p className="mt-3 text-sm leading-relaxed text-stone-muted">
                  Restrictions apply; availability, program funding, property, location, and buyer
                  eligibility can all affect what is available.
                </p>
              </div>
              <button
                ref={closeRef}
                type="button"
                onClick={closeDialog}
                aria-label="Close down-payment assistance form"
                className="grid size-10 shrink-0 place-items-center rounded-full text-stone-muted transition hover:bg-stone-sunken hover:text-stone-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
              >
                <CloseIcon className="size-5" />
              </button>
            </div>
            <div className="mt-5 border-y border-stone-line py-4">
              <a
                href={`tel:${site.phoneDial}`}
                className="inline-flex items-center gap-2 rounded-full bg-brand-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-800"
              >
                <PhoneIcon className="size-4" /> Call {site.phoneDisplay}
              </a>
            </div>
            <div className="mt-6">
              <FinancingForm
                compact
                requireEmail
                submitLabel="Send me assistance details"
                successTitle="Thanks — we'll be in touch."
                successMessage="A Home Placer team member will help you understand the potential assistance options for your land-home plan."
              />
            </div>
          </section>
        </div>
      )}
    </>
  );
}
