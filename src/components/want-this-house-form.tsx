"use client";

import { useState } from "react";
import { CheckIcon, ArrowIcon } from "@/components/icons";
import { submitLead } from "@/lib/lead";
import { site } from "@/lib/site";

const fieldClass =
  "w-full rounded-lg border border-stone-line bg-stone-bg px-3.5 py-2.5 text-sm text-stone-ink outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-200";

// "Want this same house?" lead capture. Used two ways:
//   • placed-home pages — pass the real `address` (+ model) of the home they liked
//   • model detail pages — pass just `model` (no address) to request a home's price
// Submits to FUB (via /api/lead) with that context baked into the note so the team
// knows exactly which home the buyer wants. Mailto fallback.
export function WantThisHouseForm({ address, model }: { address?: string; model?: string }) {
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [via, setVia] = useState<"api" | "mailto">("api");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("sending");
    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries()) as Record<string, string>;
    const note = data.message?.trim();
    // Enrich so the FUB lead is instantly actionable — context in structured
    // fields (home of interest + address), the buyer's own words in the message.
    if (address) {
      data.home = model ? `${model} (like the one at ${address})` : `A home like ${address}`;
      data.address = address;
      data.message = note || `Interested in a home like the one at ${address}.`;
    } else {
      data.home = model || "Website inquiry";
      data.message =
        note || `Interested in ${model || "this home"} — please send pricing and an estimated monthly payment.`;
    }
    const result = await submitLead("contact", data);
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
        <h3 className="mt-4 font-display text-xl font-semibold text-brand-900">Got it — we&apos;re on it.</h3>
        <p className="mt-2 text-sm text-stone-muted">
          {via === "mailto"
            ? "We've opened a pre-filled email — just hit send and we'll price it out. Didn't open? Call or text (843) 849-HOME."
            : "A Home Placer team member will reach out shortly with pricing on a home like this. Want us sooner? Just call."}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {status === "error" && (
        <p className="rounded-lg border border-red-300 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
          Something didn&apos;t look right — please check your name and phone, then try again. Or call{" "}
          <a href={`tel:${site.phoneDial}`} className="font-semibold underline">{site.phoneDisplay}</a>.
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="wth-name" className="mb-1.5 block text-sm font-medium text-stone-ink">
            Name
          </label>
          <input id="wth-name" name="name" required autoComplete="name" className={fieldClass} />
        </div>
        <div>
          <label htmlFor="wth-phone" className="mb-1.5 block text-sm font-medium text-stone-ink">
            Phone
          </label>
          <input id="wth-phone" name="phone" type="tel" required autoComplete="tel" className={fieldClass} />
        </div>
      </div>
      <div>
        <label htmlFor="wth-email" className="mb-1.5 block text-sm font-medium text-stone-ink">
          Email <span className="text-stone-muted">(optional)</span>
        </label>
        <input id="wth-email" name="email" type="email" autoComplete="email" className={fieldClass} />
      </div>
      <div>
        <label htmlFor="wth-message" className="mb-1.5 block text-sm font-medium text-stone-ink">
          Do you have land? Any details? <span className="text-stone-muted">(optional)</span>
        </label>
        <textarea
          id="wth-message"
          name="message"
          rows={3}
          placeholder="I have land in… / I need land too / timeline / budget…"
          className={fieldClass}
        />
      </div>

      <button
        type="submit"
        disabled={status === "sending"}
        className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-brand-700 px-6 py-3 text-base font-semibold text-white transition hover:bg-brand-800 disabled:opacity-60"
      >
        {status === "sending" ? "Sending…" : "Get my price"} <ArrowIcon className="size-4" />
      </button>
      <p className="text-xs text-stone-muted">
        By submitting, you agree to be contacted by Home Placer about your inquiry.
      </p>
    </form>
  );
}
