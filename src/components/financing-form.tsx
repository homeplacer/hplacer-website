"use client";

import { useState } from "react";
import { CheckIcon, ArrowIcon } from "@/components/icons";
import { submitLead } from "@/lib/lead";
import { site } from "@/lib/site";
import { Honeypot } from "@/components/honeypot";
import { PUBLIC_PHONE_PATTERN } from "@/lib/phone-pattern";
import { SafePublicLeadForm, usePublicLeadFormSafety } from "@/components/public-lead-form-safety";

const fieldClass =
  "w-full rounded-lg border border-stone-line bg-stone-bg px-3.5 py-2.5 text-sm text-stone-ink outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-200";

// Intentionally an EASY, low-friction capture — contact + one soft qualifier.
// No SSN, income, or credit details are collected here; that happens later with
// a licensed lender. This form just starts the conversation.
export function FinancingForm({
  compact = false,
  requireEmail = false,
  submitLabel = "Apply for financing",
  successTitle = "You're all set.",
  successMessage,
}: {
  compact?: boolean;
  requireEmail?: boolean;
  submitLabel?: string;
  successTitle?: string;
  successMessage?: string;
}) {
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [via, setVia] = useState<"api" | "mailto">("api");
  const [hasLand, setHasLand] = useState("");
  const { formId, hydrated, successHeadingRef, errorRef, beginSubmission, endSubmission } = usePublicLeadFormSafety(status);
  const fieldId = (name: string) => `${formId}-fin-${name}`;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!beginSubmission()) return;
    const form = e.currentTarget;
    try {
      const data = Object.fromEntries(new FormData(form).entries());
      setStatus("sending");
      const result = await submitLead("financing", data);
      if (result === "error") {
        setStatus("error");
        return;
      }
      setVia(result);
      setStatus("sent");
      form.reset();
      setHasLand("");
    } catch {
      setStatus("error");
    } finally {
      endSubmission();
    }
  }

  const confirmation = (
      <div className="rounded-card border border-brand-200 bg-brand-50 p-8 text-center">
        <div className="mx-auto grid size-12 place-items-center rounded-full bg-brand-600 text-white">
          <CheckIcon className="size-6" strokeWidth={2.5} />
        </div>
        <h3 ref={successHeadingRef} tabIndex={-1} className="mt-4 font-display text-xl font-semibold text-brand-900 focus:outline-none">
          {via === "mailto" ? "Finish sending your inquiry" : successTitle}
        </h3>
        <p className="mt-2 text-sm text-stone-muted">
          {via === "mailto"
            ? "We've opened a pre-filled email in your mail app — just hit send and we'll walk you through your options. Didn't open? Call (843) 849-HOME."
            : successMessage ?? "A Home Placer team member will reach out to walk you through your financing options — no credit pull to get started, no obligation."}
        </p>
      </div>
  );

  return (
    <SafePublicLeadForm hydrated={hydrated} formId={formId} errorRef={errorRef} status={status} dataFormType="financing"
      legend="Request financing information" onSubmit={handleSubmit} confirmation={confirmation}
      pendingMessage="Sending your financing inquiry…"
      successAnnouncement={via === "mailto"
        ? "Finish sending your financing inquiry in your mail app. Your message has not been sent yet."
        : `${successTitle} ${successMessage ?? "A Home Placer team member will reach out to discuss your financing options."}`}
      error={<>Something didn&apos;t look right — please check your name and phone, then try again. Or call{" "}
        <a href={`tel:${site.phoneDial}`} className="font-semibold underline">{site.phoneDisplay}</a>.</>}>
      <Honeypot />
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor={fieldId("name")} className="mb-1.5 block text-sm font-medium text-stone-ink">
            Name
          </label>
          <input id={fieldId("name")} name="name" required autoComplete="name" className={fieldClass} />
        </div>
        <div>
          <label htmlFor={fieldId("phone")} className="mb-1.5 block text-sm font-medium text-stone-ink">
            Phone
          </label>
          <input id={fieldId("phone")} name="phone" type="tel" inputMode="tel" pattern={PUBLIC_PHONE_PATTERN} title="Please enter a valid phone number." required autoComplete="tel" className={fieldClass} />
        </div>
      </div>
      <div>
        <label htmlFor={fieldId("email")} className="mb-1.5 block text-sm font-medium text-stone-ink">
          Email {!requireEmail && <span className="text-stone-muted">(optional)</span>}
        </label>
        <input
          id={fieldId("email")}
          name="email"
          type="email"
          required={requireEmail}
          autoComplete="email"
          className={fieldClass}
        />
      </div>

      {!compact && (
        <div>
          <span className="mb-1.5 block text-sm font-medium text-stone-ink">Do you already have land?</span>
          <input type="hidden" name="hasLand" value={hasLand} />
          <div className="flex flex-wrap gap-2">
            {["Yes", "No", "Not sure"].map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => setHasLand(opt)}
                aria-pressed={hasLand === opt}
                className={
                  hasLand === opt
                    ? "rounded-full bg-brand-700 px-4 py-2 text-sm font-semibold text-white"
                    : "rounded-full border border-stone-line bg-stone-bg px-4 py-2 text-sm font-medium text-stone-ink hover:border-brand-300"
                }
              >
                {opt}
              </button>
            ))}
          </div>
        </div>
      )}

      <button
        type="submit"
        disabled={!hydrated || status === "sending"}
        className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-accent-500 px-6 py-3 text-base font-semibold text-white transition hover:bg-accent-600 disabled:opacity-60"
      >
        {status === "sending" ? "Sending…" : submitLabel} <ArrowIcon className="size-4" />
      </button>
      <p className="text-center text-xs text-stone-muted">
        No credit pull to get started. We&apos;ll call to talk through your options.
      </p>
    </SafePublicLeadForm>
  );
}
