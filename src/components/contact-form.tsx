"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { CheckIcon, ArrowIcon, PhoneIcon } from "@/components/icons";
import { submitLead } from "@/lib/lead";
import { site } from "@/lib/site";
import { Honeypot } from "@/components/honeypot";
import { contactHomeFromLocation } from "@/lib/contact-context";

const fieldClass =
  "w-full rounded-lg border border-stone-line bg-stone-bg px-3.5 py-2.5 text-sm text-stone-ink outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-200";

// Keep the server snapshot inert until React has attached the form's handlers.
const subscribeToHydration = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;

export function ContactForm({
  defaultHome = "",
  packageId,
}: {
  defaultHome?: string;
  packageId?: string;
}) {
  const formId = useId();
  const hydrated = useSyncExternalStore(
    subscribeToHydration,
    clientSnapshot,
    serverSnapshot,
  );
  const submissionInFlight = useRef(false);
  const successHeadingRef = useRef<HTMLHeadingElement>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle",
  );
  const [via, setVia] = useState<"api" | "mailto">("api");
  const [errorReason, setErrorReason] = useState<"contact" | "submission">("contact");
  const [home, setHome] = useState(defaultHome);
  const textMessage = encodeURIComponent(
    home
      ? `Hi Home Placer, I’m interested in the ${home}.`
      : "Hi Home Placer, I’m interested in a manufactured home and land package.",
  );
  const emailSubject = encodeURIComponent(
    home ? `Question about ${home}` : "Home Placer inquiry",
  );

  // Form-only context does not create a new crawlable page. Read it after
  // hydration, while continuing to accept bookmarked legacy ?home= URLs.
  useEffect(() => {
    const prefillHome = () => {
      const context = contactHomeFromLocation(window.location);
      if (context) setHome(context);
    };
    prefillHome();
    window.addEventListener("hashchange", prefillHome);
    return () => window.removeEventListener("hashchange", prefillHome);
  }, []);

  useEffect(() => {
    if (status === "sent") successHeadingRef.current?.focus({ preventScroll: true });
    if (status === "error" && errorReason === "submission") errorRef.current?.focus();
  }, [status, errorReason]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    // A ref also guards two submits before React commits the pending state.
    if (!hydrated || submissionInFlight.current || status === "sent") return;
    const form = e.currentTarget;
    const phone = form.elements.namedItem("phone") as HTMLInputElement;
    const email = form.elements.namedItem("email") as HTMLInputElement;
    if (!phone.value.trim() && !email.value.trim()) {
      setErrorReason("contact");
      setStatus("error");
      phone.focus();
      return;
    }
    // Capture before disabling the fieldset: disabled fields are omitted by FormData.
    const data = Object.fromEntries(new FormData(form).entries());
    submissionInFlight.current = true;
    setStatus("sending");
    try {
      const result = await submitLead("contact", data);
      if (result === "error") {
        setErrorReason("submission");
        setStatus("error");
        return;
      }
      setVia(result);
      setStatus("sent");
      form.reset();
    } catch {
      setErrorReason("submission");
      setStatus("error");
    } finally {
      submissionInFlight.current = false;
    }
  }

  const confirmation = (
      <div className="rounded-card border border-brand-200 bg-brand-50 p-8 text-center">
        <div className="mx-auto grid size-12 place-items-center rounded-full bg-brand-600 text-white">
          <CheckIcon className="size-6" strokeWidth={2.5} />
        </div>
        <h3
          ref={successHeadingRef}
          tabIndex={-1}
          className="mt-4 font-display text-xl font-semibold text-brand-900 focus:outline-none"
        >
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

  const fields = (
    <fieldset
      disabled={!hydrated || status === "sending"}
      className="min-w-0 space-y-4"
    >
      <legend className="sr-only">Send an inquiry to Home Placer</legend>
      <Honeypot />
      {packageId && <input type="hidden" name="packageId" value={packageId} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor={`${formId}-name`}
            className="mb-1.5 block text-sm font-medium text-stone-ink"
          >
            Name
          </label>
          <input
            id={`${formId}-name`}
            name="name"
            required
            autoComplete="name"
            className={fieldClass}
          />
        </div>
        <div>
          <label
            htmlFor={`${formId}-phone`}
            className="mb-1.5 block text-sm font-medium text-stone-ink"
          >
            Phone <span className="text-stone-muted">(or email)</span>
          </label>
          <input
            id={`${formId}-phone`}
            name="phone"
            type="tel"
            inputMode="tel"
            pattern="[0-9()+.\s-]{7,}"
            title="Please enter a valid phone number."
            autoComplete="tel"
            aria-describedby={`${formId}-error`}
            aria-invalid={(status === "error" && errorReason === "contact") || undefined}
            className={fieldClass}
          />
        </div>
      </div>
      <div>
        <label
          htmlFor={`${formId}-email`}
          className="mb-1.5 block text-sm font-medium text-stone-ink"
        >
          Email <span className="text-stone-muted">(or phone)</span>
        </label>
        <input
          id={`${formId}-email`}
          name="email"
          type="email"
          autoComplete="email"
          aria-describedby={`${formId}-error`}
          aria-invalid={(status === "error" && errorReason === "contact") || undefined}
          className={fieldClass}
        />
      </div>
      <div>
        <label
          htmlFor={`${formId}-home`}
          className="mb-1.5 block text-sm font-medium text-stone-ink"
        >
          Home you&apos;re interested in{" "}
          <span className="text-stone-muted">(optional)</span>
        </label>
        <input
          id={`${formId}-home`}
          name="home"
          value={home}
          onChange={(e) => setHome(e.target.value)}
          placeholder="Any model or “not sure yet”"
          className={fieldClass}
        />
      </div>
      <div>
        <label
          htmlFor={`${formId}-message`}
          className="mb-1.5 block text-sm font-medium text-stone-ink"
        >
          What are you looking for?
        </label>
        <textarea
          id={`${formId}-message`}
          name="message"
          rows={4}
          placeholder="Beds/baths, budget, land or no land, timeline…"
          className={fieldClass}
        />
      </div>

      <button
        type="submit"
        disabled={!hydrated || status === "sending"}
        className="inline-flex items-center gap-2 rounded-full bg-brand-700 px-6 py-3 text-base font-semibold text-white transition hover:bg-brand-800 disabled:opacity-60"
      >
        {status === "sending" ? "Sending…" : "Send"}{" "}
        <ArrowIcon className="size-4" />
      </button>
      <p className="text-xs text-stone-muted">
        By submitting, you agree to be contacted by Home Placer about your
        inquiry. Please include a phone number or email address so we can reply.
      </p>
    </fieldset>
  );

  return (
    <div data-form-region className="space-y-4">
      {/* These regions stay mounted when the form becomes a confirmation. */}
      <p role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {status === "sending" && "Sending your inquiry…"}
        {status === "sent" && (via === "mailto"
          ? "Finish sending your inquiry in your mail app. Your message has not been sent yet."
          : "Thanks — we’ve got your inquiry. A Home Placer team member will reach out shortly.")}
      </p>
      <p
        id={`${formId}-error`}
        ref={errorRef}
        tabIndex={-1}
        role="alert"
        aria-atomic="true"
        className={status === "error"
          ? "rounded-lg border border-red-300 bg-red-50 px-3.5 py-2.5 text-sm text-red-700"
          : "sr-only"}
      >
        {status === "error" && <>
          {errorReason === "contact"
            ? "Please enter a phone number or email address so we can reply."
            : "We couldn’t accept your inquiry. Check your name and contact details, then try again."}
          {" "}Or call{" "}
          <a href={`tel:${site.phoneDial}`} className="font-semibold underline">
            {site.phoneDisplay}
          </a>.
        </>}
      </p>
      {status === "sent" ? confirmation : hydrated ? (
        <form data-form-type="contact" onSubmit={handleSubmit} aria-busy={status === "sending"}>
          {fields}
        </form>
      ) : (
        // There is no native form to submit (including Enter) before hydration.
        <div data-form-type="contact">{fields}</div>
      )}
      {status !== "sent" && (
        // Permanent fallback below the fields avoids a disappearing startup panel.
        <div className="rounded-lg border border-brand-200 bg-brand-50 p-4 text-sm text-stone-ink">
          <p>Prefer another way to get in touch? Call, text, or email us.</p>
          <div className="mt-2 flex flex-wrap gap-3 font-semibold text-brand-800">
            <a href={`tel:${site.phoneDial}`} className="underline">Call {site.phoneDisplay}</a>
            <a href={`sms:${site.phoneDial}?body=${textMessage}`} className="underline">Text us</a>
            <a href={`mailto:${site.email}?subject=${emailSubject}`} className="underline">Email us</a>
          </div>
          <noscript><p className="mt-2">The message form needs JavaScript to load. Please use the contact options above.</p></noscript>
        </div>
      )}
    </div>
  );
}
