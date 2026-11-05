"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
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
  const titleId = useId();
  const triggerRef = useRef<HTMLAnchorElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const closeDialog = useCallback(() => {
    setOpen(false);
  }, []);

  useEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    const trigger = triggerRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.showModal();
    closeRef.current?.focus();
    return () => {
      if (dialog.open) dialog.close();
      document.body.style.overflow = previousOverflow;
      trigger?.focus();
    };
  }, [open]);

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
        <dialog
          ref={dialogRef}
          aria-labelledby={titleId}
          className="fixed inset-0 m-0 h-dvh max-h-none w-full max-w-none items-end border-0 bg-transparent p-3 text-inherit open:flex backdrop:bg-brand-950/55 backdrop:backdrop-blur-sm sm:items-center sm:justify-center sm:p-6"
          onCancel={(event) => {
            event.preventDefault();
            closeDialog();
          }}
          onClose={(event) => {
            if (!event.currentTarget.open) closeDialog();
          }}
          onKeyDown={(event) => {
            if (event.key !== "Tab") return;
            const controls = Array.from(
              event.currentTarget.querySelectorAll<HTMLElement>(
                "a[href], button, input, select, textarea, [tabindex]",
              ),
            ).filter((control) => control.tabIndex >= 0 &&
              !control.matches(":disabled") && control.getClientRects().length > 0);
            const first = controls[0];
            const last = controls.at(-1);
            if (!first || !last) return;
            if (event.shiftKey && document.activeElement === first) {
              event.preventDefault();
              last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
              event.preventDefault();
              first.focus();
            }
          }}
          onClick={(event) => {
            if (event.target === event.currentTarget) closeDialog();
          }}
        >
          <section
            className="max-h-[calc(100dvh-1.5rem)] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl sm:p-8"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-brand-600">
                  Down-payment assistance
                </p>
                <h2 id={titleId} className="mt-1 font-display text-2xl font-semibold text-stone-ink">
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
                className="grid size-11 shrink-0 place-items-center rounded-full text-stone-muted transition hover:bg-stone-sunken hover:text-stone-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
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
        </dialog>
      )}
    </>
  );
}
