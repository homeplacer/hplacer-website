"use client";

import { useState } from "react";
import { ArrowIcon, CheckIcon } from "@/components/icons";

// Site-wide "new homes & deals in your inbox" capture. Email-only, lowest
// possible friction. Posts type: "subscribe" to /api/lead.
export function EmailCapture() {
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("sending");
    const form = e.currentTarget;
    const email = (new FormData(form).get("email") as string)?.trim();
    try {
      const res = await fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "subscribe", email }),
      });
      if (!res.ok) throw new Error("Request failed");
      setStatus("sent");
      form.reset();
    } catch {
      setStatus("error");
    }
  }

  return (
    <section className="bg-brand-900 text-white">
      <div className="container-x flex flex-col items-center gap-6 py-12 text-center md:flex-row md:justify-between md:gap-10 md:text-left">
        <div className="max-w-lg">
          <h2 className="font-display text-2xl font-semibold sm:text-3xl">
            New homes &amp; deals, straight to your inbox
          </h2>
          <p className="mt-2 text-sm text-stone-100/75">
            Be first to see new models, price drops, and move-in-ready packages across the
            Grand Strand. No spam — unsubscribe anytime.
          </p>
        </div>

        {status === "sent" ? (
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-5 py-3 text-sm font-semibold text-white ring-1 ring-white/20">
            <CheckIcon className="size-5 text-accent-300" strokeWidth={2.5} /> You&apos;re subscribed — thanks!
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="w-full max-w-md shrink-0">
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder="you@email.com"
                aria-label="Email address"
                className="w-full rounded-full border border-white/20 bg-white/10 px-5 py-3 text-sm text-white placeholder:text-stone-100/50 outline-none focus:border-accent-300 focus:ring-2 focus:ring-accent-300/40"
              />
              <button
                type="submit"
                disabled={status === "sending"}
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-accent-500 px-6 py-3 text-sm font-semibold text-white transition hover:bg-accent-600 disabled:opacity-60"
              >
                {status === "sending" ? "…" : "Subscribe"} <ArrowIcon className="size-4" />
              </button>
            </div>
            {status === "error" && (
              <p className="mt-2 text-left text-xs text-accent-200">
                Something went wrong — please try again.
              </p>
            )}
          </form>
        )}
      </div>
    </section>
  );
}
