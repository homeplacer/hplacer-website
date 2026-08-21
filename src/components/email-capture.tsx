"use client";

import { useState } from "react";
import { ArrowIcon, CheckIcon } from "@/components/icons";
import { submitLead } from "@/lib/lead";
import { Honeypot } from "@/components/honeypot";

// Site-wide new-homes capture. It intentionally collects complete contact
// information so Follow Up Boss never receives an unusable email-only record.
export function EmailCapture() {
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [via, setVia] = useState<"api" | "mailto">("api");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (status === "sending") return; // guard against double-submit while in flight
    setStatus("sending");
    const form = e.currentTarget;
    const fd = new FormData(form);
    const data = Object.fromEntries(fd.entries());
    // Honeypot: forwarded so the server can drop bot submissions (empty for humans).
    const company = (fd.get("company") as string) || undefined;
    const result = await submitLead("subscribe", { ...data, company });
    if (result === "error") {
      setStatus("error");
      return;
    }
    setVia(result);
    setStatus("sent");
    form.reset();
  }

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

        {status === "sent" ? (
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-5 py-3 text-sm font-semibold text-white ring-1 ring-white/20">
            <CheckIcon className="size-5 text-accent-300" strokeWidth={2.5} />{" "}
            {via === "mailto" ? "Check your mail app — hit send to subscribe!" : "You're subscribed — thanks!"}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="w-full max-w-md shrink-0">
            <Honeypot />
            <div className="grid gap-2 sm:grid-cols-2">
              <input
                name="name"
                required
                autoComplete="name"
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
                placeholder="you@email.com"
                aria-label="Email address"
                className="w-full rounded-full border border-white/20 bg-white/10 px-5 py-3 text-sm text-white placeholder:text-stone-100/50 outline-none focus:border-accent-300 focus:ring-2 focus:ring-accent-300/40 sm:col-span-2"
              />
              <button
                type="submit"
                disabled={status === "sending"}
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-accent-500 px-6 py-3 text-sm font-semibold text-white transition hover:bg-accent-600 disabled:opacity-60 sm:col-span-2"
              >
                {status === "sending" ? "…" : "Subscribe"} <ArrowIcon className="size-4" />
              </button>
            </div>
            {status === "error" && (
              <p className="mt-2 text-left text-sm text-red-200">
                Please enter your name, a valid phone number, and email address.
              </p>
            )}
          </form>
        )}
      </div>
    </section>
  );
}
