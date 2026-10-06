"use client";

import { useState } from "react";
import { ArrowIcon, CheckIcon } from "@/components/icons";
import { submitLead } from "@/lib/lead";
import { Honeypot } from "@/components/honeypot";
import { SafePublicLeadForm, usePublicLeadFormSafety } from "@/components/public-lead-form-safety";

// Site-wide new-homes capture. It intentionally collects complete contact
// information so Follow Up Boss never receives an unusable email-only record.
export function EmailCapture() {
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [via, setVia] = useState<"api" | "mailto">("api");
  const { formId, hydrated, successHeadingRef, errorRef, beginSubmission, endSubmission } = usePublicLeadFormSafety(status);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!beginSubmission()) return;
    const form = e.currentTarget;
    try {
      const fd = new FormData(form);
      const data = Object.fromEntries(fd.entries());
      // Honeypot: forwarded so the server can drop bot submissions (empty for humans).
      const company = (fd.get("company") as string) || undefined;
      setStatus("sending");
      const result = await submitLead("subscribe", { ...data, company });
      if (result === "error") {
        setStatus("error");
        return;
      }
      setVia(result);
      setStatus("sent");
      form.reset();
    } catch {
      setStatus("error");
    } finally {
      endSubmission();
    }
  }

  const confirmation = (
    <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-5 py-3 text-sm text-white ring-1 ring-white/20">
      <CheckIcon className="size-5 shrink-0 text-accent-300" strokeWidth={2.5} />
      <h3 ref={successHeadingRef} tabIndex={-1} className="font-semibold focus:outline-none">
        {via === "mailto" ? "Check your mail app — hit send to subscribe!" : "You're subscribed — thanks!"}
      </h3>
    </div>
  );

  return (
    <section className="bg-brand-900 text-white">
      <div className="container-x flex flex-col items-center gap-6 py-12 text-center md:flex-row md:justify-between md:gap-10 md:text-left">
        <div className="max-w-lg">
          <h2 className="font-display text-2xl font-semibold sm:text-3xl">
            New homes &amp; deals, straight to your inbox
          </h2>
          <p className="mt-2 text-sm text-stone-100/75">
            Tell us how to reach you and we&apos;ll send new models, price drops, and
            move-in-ready packages across the Grand Strand.
          </p>
        </div>

        <div className="w-full max-w-md shrink-0">
          <SafePublicLeadForm hydrated={hydrated} formId={formId} errorRef={errorRef} status={status} dataFormType="subscribe"
            legend="Sign up for new homes and deals" onSubmit={handleSubmit} confirmation={confirmation}
            fieldClassName="space-y-0"
            pendingMessage="Sending your signup…"
            successAnnouncement={via === "mailto"
              ? "Finish sending your signup in your mail app. Your message has not been sent yet."
              : "You're subscribed — thanks!"}
            error="Please enter your name, a valid phone number, and email address.">
            <Honeypot />
            <div className="grid gap-2 sm:grid-cols-2">
              <input
                name="name"
                required
                autoComplete="name"
                aria-describedby={`${formId}-error`}
                placeholder="Your name"
                aria-label="Your name"
                className="w-full rounded-full border border-white/20 bg-white/10 px-5 py-3 text-sm text-white placeholder:text-stone-100/50 outline-none focus:border-accent-300 focus:ring-2 focus:ring-accent-300/40"
              />
              <input
                name="phone"
                type="tel"
                required
                inputMode="tel"
                autoComplete="tel"
                aria-describedby={`${formId}-error`}
                pattern="[0-9()+.\\s-]{7,}"
                title="Please enter a valid phone number."
                placeholder="Phone number"
                aria-label="Phone number"
                className="w-full rounded-full border border-white/20 bg-white/10 px-5 py-3 text-sm text-white placeholder:text-stone-100/50 outline-none focus:border-accent-300 focus:ring-2 focus:ring-accent-300/40"
              />
              <input
                name="email"
                type="email"
                required
                autoComplete="email"
                aria-describedby={`${formId}-error`}
                placeholder="you@email.com"
                aria-label="Email address"
                className="w-full rounded-full border border-white/20 bg-white/10 px-5 py-3 text-sm text-white placeholder:text-stone-100/50 outline-none focus:border-accent-300 focus:ring-2 focus:ring-accent-300/40 sm:col-span-2"
              />
              <button
                type="submit"
                disabled={!hydrated || status === "sending"}
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-accent-500 px-6 py-3 text-sm font-semibold text-white transition hover:bg-accent-600 disabled:opacity-60 sm:col-span-2"
              >
                {status === "sending" ? "…" : "Subscribe"} <ArrowIcon className="size-4" />
              </button>
            </div>
          </SafePublicLeadForm>
        </div>
      </div>
    </section>
  );
}
