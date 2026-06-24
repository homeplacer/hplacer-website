"use client";

import { useEffect, useState } from "react";
import { CheckIcon, ArrowIcon } from "@/components/icons";
import { submitLead } from "@/lib/lead";

const fieldClass =
  "w-full rounded-lg border border-stone-line bg-stone-bg px-3.5 py-2.5 text-sm text-stone-ink outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-200";

export function ContactForm({ defaultHome = "" }: { defaultHome?: string }) {
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");
  const [via, setVia] = useState<"api" | "mailto">("api");
  const [home, setHome] = useState(defaultHome);

  // Prefill from ?home= client-side (keeps the page statically exportable).
  useEffect(() => {
    const h = new URLSearchParams(window.location.search).get("home");
    if (h) setHome(h);
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("sending");
    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());
    setVia(await submitLead("contact", data));
    setStatus("sent");
    form.reset();
  }

  if (status === "sent") {
    return (
      <div className="rounded-card border border-brand-200 bg-brand-50 p-8 text-center">
        <div className="mx-auto grid size-12 place-items-center rounded-full bg-brand-600 text-white">
          <CheckIcon className="size-6" strokeWidth={2.5} />
        </div>
        <h3 className="mt-4 font-display text-xl font-semibold text-brand-900">Thanks — we&apos;ve got it.</h3>
        <p className="mt-2 text-sm text-stone-muted">
          {via === "mailto"
            ? "We've opened a pre-filled email in your mail app — just hit send and we'll be in touch. Didn't open? Call or text (843) 849-HOME."
            : "A Home Placer team member will reach out shortly. Need us sooner? Just call."}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="name" className="mb-1.5 block text-sm font-medium text-stone-ink">
            Name
          </label>
          <input id="name" name="name" required autoComplete="name" className={fieldClass} />
        </div>
        <div>
          <label htmlFor="phone" className="mb-1.5 block text-sm font-medium text-stone-ink">
            Phone
          </label>
          <input id="phone" name="phone" type="tel" required autoComplete="tel" className={fieldClass} />
        </div>
      </div>
      <div>
        <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-stone-ink">
          Email
        </label>
        <input id="email" name="email" type="email" autoComplete="email" className={fieldClass} />
      </div>
      <div>
        <label htmlFor="home" className="mb-1.5 block text-sm font-medium text-stone-ink">
          Home you&apos;re interested in <span className="text-stone-muted">(optional)</span>
        </label>
        <input id="home" name="home" value={home} onChange={(e) => setHome(e.target.value)} placeholder="Any model or “not sure yet”" className={fieldClass} />
      </div>
      <div>
        <label htmlFor="message" className="mb-1.5 block text-sm font-medium text-stone-ink">
          What are you looking for?
        </label>
        <textarea
          id="message"
          name="message"
          rows={4}
          placeholder="Beds/baths, budget, land or no land, timeline…"
          className={fieldClass}
        />
      </div>

      <button
        type="submit"
        disabled={status === "sending"}
        className="inline-flex items-center gap-2 rounded-full bg-brand-700 px-6 py-3 text-base font-semibold text-white transition hover:bg-brand-800 disabled:opacity-60"
      >
        {status === "sending" ? "Sending…" : "Send"} <ArrowIcon className="size-4" />
      </button>
      <p className="text-xs text-stone-muted">
        By submitting, you agree to be contacted by Home Placer about your inquiry.
      </p>
    </form>
  );
}
