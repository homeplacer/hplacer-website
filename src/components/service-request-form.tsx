"use client";

import { useState } from "react";
import { CheckIcon, ArrowIcon } from "@/components/icons";
import { submitLead } from "@/lib/lead";
import { site } from "@/lib/site";

const fieldClass =
  "w-full rounded-lg border border-stone-line bg-stone-bg px-3.5 py-2.5 text-sm text-stone-ink outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-200";

export function ServiceRequestForm() {
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [via, setVia] = useState<"api" | "mailto">("api");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("sending");
    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());
    const result = await submitLead("service", data);
    if (result === "error") {
      setStatus("error");
      return;
    }
    setVia(result);
    setStatus("sent");
    form.reset();
  }

  if (status === "sent") {
    return (
      <div className="rounded-card border border-brand-200 bg-brand-50 p-8 text-center">
        <div className="mx-auto grid size-12 place-items-center rounded-full bg-brand-600 text-white">
          <CheckIcon className="size-6" strokeWidth={2.5} />
        </div>
        <h3 className="mt-4 font-display text-xl font-semibold text-brand-900">Request received.</h3>
        <p className="mt-2 text-sm text-stone-muted">
          {via === "mailto"
            ? "We've opened a pre-filled email in your mail app — just hit send and our service team will follow up. Didn't open? Call (843) 484-9844."
            : "Our service team will reach out to schedule. For anything urgent, call us directly."}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {status === "error" && (
        <p className="rounded-lg border border-red-300 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
          Something didn&apos;t look right — please check the required fields and try again. Or call our
          service line at{" "}
          <a href={`tel:${site.warrantyPhoneDial}`} className="font-semibold underline">{site.warrantyPhoneDisplay}</a>.
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="sr-name" className="mb-1.5 block text-sm font-medium text-stone-ink">Name</label>
          <input id="sr-name" name="name" required autoComplete="name" className={fieldClass} />
        </div>
        <div>
          <label htmlFor="sr-phone" className="mb-1.5 block text-sm font-medium text-stone-ink">Phone</label>
          <input id="sr-phone" name="phone" type="tel" required autoComplete="tel" className={fieldClass} />
        </div>
      </div>
      <div>
        <label htmlFor="sr-email" className="mb-1.5 block text-sm font-medium text-stone-ink">
          Email <span className="text-stone-muted">(optional)</span>
        </label>
        <input id="sr-email" name="email" type="email" autoComplete="email" className={fieldClass} />
      </div>
      <div>
        <label htmlFor="sr-address" className="mb-1.5 block text-sm font-medium text-stone-ink">Home address</label>
        <input id="sr-address" name="address" autoComplete="street-address" placeholder="Street, city" className={fieldClass} />
      </div>
      <div>
        <label htmlFor="sr-message" className="mb-1.5 block text-sm font-medium text-stone-ink">
          What do you need help with?
        </label>
        <textarea id="sr-message" name="message" rows={4} required placeholder="Describe the issue or service you need…" className={fieldClass} />
      </div>

      <button
        type="submit"
        disabled={status === "sending"}
        className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-brand-700 px-6 py-3 text-base font-semibold text-white transition hover:bg-brand-800 disabled:opacity-60"
      >
        {status === "sending" ? "Sending…" : "Submit service request"} <ArrowIcon className="size-4" />
      </button>
    </form>
  );
}
