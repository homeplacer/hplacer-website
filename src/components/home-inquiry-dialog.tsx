"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { CloseIcon, ArrowIcon } from "@/components/icons";
import { ContactForm } from "@/components/contact-form";
import { site } from "@/lib/site";
import { track } from "@/lib/analytics";
import { contactContextHref } from "@/lib/contact-context";

export function HomeInquiryDialog({
  homeName,
  label = "Ask about this home",
  className,
  showArrow = true,
  triggerInert = false,
}: {
  homeName: string;
  label?: string;
  className?: string;
  showArrow?: boolean;
  triggerInert?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const triggerRef = useRef<HTMLAnchorElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const textMessage = encodeURIComponent(
    `Hi Home Placer, I’m interested in the ${homeName}.`,
  );
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
    // showModal puts the dialog in the browser's top layer, contains keyboard
    // focus, and makes the page behind it inert, including other card triggers.
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
        href={contactContextHref(homeName)}
        aria-haspopup="dialog"
        aria-expanded={open}
        inert={triggerInert}
        aria-hidden={triggerInert || undefined}
        onClick={(event) => {
          // Keep the contact-page URL as progressive fallback. JavaScript
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
            if (event.target === event.currentTarget) {
              closeDialog();
            }
          }}
        >
          <section
            className="max-h-[calc(100dvh-1.5rem)] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl sm:p-8"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-brand-600">Quick question</p>
                <h2 id={titleId} className="mt-1 font-display text-2xl font-semibold text-stone-ink">
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
                className="grid size-11 shrink-0 place-items-center rounded-full text-stone-muted transition hover:bg-stone-sunken hover:text-stone-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
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
        </dialog>
      )}
    </>
  );
}
