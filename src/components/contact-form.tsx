"use client";

import { useEffect, useState } from "react";
import { CheckIcon, ArrowIcon, PhoneIcon } from "@/components/icons";
import { submitLead } from "@/lib/lead";
import { site } from "@/lib/site";
import { Honeypot } from "@/components/honeypot";

const fieldClass =
  "w-full rounded-lg border border-stone-line bg-stone-bg px-3.5 py-2.5 text-sm text-stone-ink outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-200";

export function ContactForm({
  defaultHome = "",
  packageId,
}: {
  defaultHome?: string;
  packageId?: string;
}) {
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle",
  );
  const [via, setVia] = useState<"api" | "mailto">("api");
  const [home, setHome] = useState(defaultHome);
  const textMessage = encodeURIComponent(
    home
      ? `Hi Home Placer, I’m interested in the ${home}.`
      : "Hi Home Placer, I’m interested in a manufactured home and land package.",
  );
  const emailSubject = encodeURIComponent(
    home ? `Question about ${home}` : "Home Placer inquiry",
  );

  // Prefill from ?home= client-side (keeps the page statically exportable).
  // URL params aren't available during SSR, so this must be an effect; setting
  // state here is the intended use (same pattern as homes-browser.tsx).
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const h = new URLSearchParams(window.location.search).get("home");
    if (h) setHome(h);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (status === "sending") return; // guard against double-submit while in flight
    const form = e.currentTarget;
    const phone = form.elements.namedItem("phone") as HTMLInputElement;
    const email = form.elements.namedItem("email") as HTMLInputElement;
    if (!phone.value.trim() && !email.value.trim()) {
      setStatus("error");
      return;
    }
    setStatus("sending");
    const data = Object.fromEntries(new FormData(form).entries());
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
        <h3 className="mt-4 font-display text-xl font-semibold text-brand-900">
          {via === "mailto" ? "Finish sending your inquiry" : "Thanks — we’ve got it."}
        </h3>
        <p className="mt-2 text-sm text-stone-muted">
          {via === "mailto"
            ? "We've opened a pre-filled email in your mail app — just hit send and we'll be in touch. Didn't open? Call or text (843) 849-HOME."
            : "A Home Placer team member will reach out shortly. Need us sooner? Just call."}
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-2 text-sm font-semibold">
          <a
            href={`tel:${site.phoneDial}`}
            className="inline-flex items-center gap-1.5 rounded-full bg-brand-700 px-4 py-2 text-white transition hover:bg-brand-800"
          >
            <PhoneIcon className="size-4" /> Call now
          </a>
          <a
            href={`sms:${site.phoneDial}?body=${textMessage}`}
            className="rounded-full border border-brand-300 px-4 py-2 text-brand-800 transition hover:bg-white"
          >
            Text us
          </a>
          <a
            href={`mailto:${site.email}?subject=${emailSubject}`}
            className="rounded-full border border-brand-300 px-4 py-2 text-brand-800 transition hover:bg-white"
          >
            Email us
          </a>
        </div>
      </div>
    );
  }

  return (
    <form
      data-form-type="contact"
      onSubmit={handleSubmit}
      className="space-y-4"
    >
      <Honeypot />
      {packageId && <input type="hidden" name="packageId" value={packageId} />}
      {status === "error" && (
        <p className="rounded-lg border border-red-300 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
          Please enter your name and a valid phone number or email address, then
          try again. Or call{" "}
          <a href={`tel:${site.phoneDial}`} className="font-semibold underline">
            {site.phoneDisplay}
          </a>
          .
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor="name"
            className="mb-1.5 block text-sm font-medium text-stone-ink"
          >
            Name
          </label>
          <input
            id="name"
            name="name"
            required
            autoComplete="name"
            className={fieldClass}
          />
        </div>
        <div>
          <label
            htmlFor="phone"
            className="mb-1.5 block text-sm font-medium text-stone-ink"
          >
            Phone <span className="text-stone-muted">(or email)</span>
          </label>
          <input
            id="phone"
            name="phone"
            type="tel"
            inputMode="tel"
            pattern="[0-9()+.\s-]{7,}"
            title="Please enter a valid phone number."
            autoComplete="tel"
            className={fieldClass}
          />
        </div>
      </div>
      <div>
        <label
          htmlFor="email"
          className="mb-1.5 block text-sm font-medium text-stone-ink"
        >
          Email <span className="text-stone-muted">(or phone)</span>
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          className={fieldClass}
        />
      </div>
      <div>
        <label
          htmlFor="home"
          className="mb-1.5 block text-sm font-medium text-stone-ink"
        >
          Home you&apos;re interested in{" "}
          <span className="text-stone-muted">(optional)</span>
        </label>
        <input
          id="home"
          name="home"
          value={home}
          onChange={(e) => setHome(e.target.value)}
          placeholder="Any model or “not sure yet”"
          className={fieldClass}
        />
      </div>
      <div>
        <label
          htmlFor="message"
          className="mb-1.5 block text-sm font-medium text-stone-ink"
        >
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
        {status === "sending" ? "Sending…" : "Send"}{" "}
        <ArrowIcon className="size-4" />
      </button>
      <p className="text-xs text-stone-muted">
        By submitting, you agree to be contacted by Home Placer about your
        inquiry. Please include a phone number or email address so we can reply.
      </p>
    </form>
  );
}
