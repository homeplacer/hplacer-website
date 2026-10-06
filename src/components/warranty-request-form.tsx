"use client";

import { useState } from "react";
import { CheckIcon, ArrowIcon } from "@/components/icons";
import { Honeypot } from "@/components/honeypot";
import { PUBLIC_PHONE_PATTERN } from "@/lib/phone-pattern";
import { site } from "@/lib/site";
import { SafePublicLeadForm, usePublicLeadFormSafety } from "@/components/public-lead-form-safety";

const fieldClass =
  "w-full rounded-lg border border-stone-line bg-stone-bg px-3.5 py-2.5 text-sm text-stone-ink outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-200";

const MAX_PHOTOS = 6;

/**
 * Warranty request with photos. Posts multipart to /api/warranty-request, which
 * forwards it to the employee portal server-side; the portal is never contacted
 * from the browser.
 */
export function WarrantyRequestForm() {
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [reference, setReference] = useState<string | null>(null);
  const [photoCount, setPhotoCount] = useState(0);
  const { formId, hydrated, successHeadingRef, errorRef, beginSubmission, endSubmission } = usePublicLeadFormSafety(status);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!beginSubmission()) return;
    const form = event.currentTarget;
    try {
      const body = new FormData(form);
      setStatus("sending");
      setMessage(null);
      const response = await fetch("/api/warranty-request", { method: "POST", body });
      const result = (await response.json()) as { ok: boolean; reference?: string | null; error?: string };
      if (!response.ok || !result.ok) {
        setMessage(result.error ?? "Something didn't go through. Please try again, or call us.");
        setStatus("error");
        return;
      }
      setReference(result.reference ?? null);
      setStatus("sent");
      form.reset();
      setPhotoCount(0);
    } catch {
      setMessage("We couldn't reach the server. Please try again, or call our service line.");
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
        <h3 ref={successHeadingRef} tabIndex={-1} className="mt-4 font-display text-xl font-semibold text-brand-900 focus:outline-none">Request received.</h3>
        {reference && (
          <p className="mt-2 text-sm text-stone-ink">
            Your reference is <strong className="font-semibold">{reference}</strong> — keep it handy if you call.
          </p>
        )}
        <p className="mt-2 text-sm text-stone-muted">
          Our service team will reach out to schedule. For anything urgent — no heat, water, or power — please
          call{" "}
          <a href={`tel:${site.warrantyPhoneDial}`} className="font-semibold underline">
            {site.warrantyPhoneDisplay}
          </a>
          .
        </p>
      </div>
  );

  return (
    <SafePublicLeadForm hydrated={hydrated} formId={formId} errorRef={errorRef} status={status} dataFormType="warranty" service
      legend="Send a warranty request" onSubmit={handleSubmit} confirmation={confirmation}
      encType="multipart/form-data" pendingMessage="Sending your warranty request…"
      successAnnouncement={`Request received.${reference ? ` Your reference is ${reference}.` : ""} Our service team will reach out to schedule.`}
      error={<>{message}{" "}<a href={`tel:${site.warrantyPhoneDial}`} className="font-semibold underline">{site.warrantyPhoneDisplay}</a></>}>
      <Honeypot />

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="wr-name" className="mb-1.5 block text-sm font-medium text-stone-ink">Name</label>
          <input id="wr-name" name="name" required autoComplete="name" className={fieldClass} />
        </div>
        <div>
          <label htmlFor="wr-phone" className="mb-1.5 block text-sm font-medium text-stone-ink">Phone</label>
          <input
            id="wr-phone" name="phone" type="tel" inputMode="tel" pattern={PUBLIC_PHONE_PATTERN}
            title="Please enter a valid phone number." autoComplete="tel" className={fieldClass}
          />
        </div>
      </div>

      <div>
        <label htmlFor="wr-email" className="mb-1.5 block text-sm font-medium text-stone-ink">
          Email <span className="text-stone-muted">(optional if you gave a phone number)</span>
        </label>
        <input id="wr-email" name="email" type="email" autoComplete="email" className={fieldClass} />
      </div>

      <fieldset className="rounded-lg border border-stone-line p-4">
        <legend className="px-1 text-sm font-medium text-stone-ink">Which home?</legend>
        <p className="mb-3 text-xs text-stone-muted">
          The serial number is on the data plate — usually inside a kitchen cabinet door or the electrical panel.
          If you can&apos;t find it, your address is enough.
        </p>
        <label htmlFor="wr-serial" className="mb-1.5 block text-sm font-medium text-stone-ink">
          Serial number <span className="text-stone-muted">(optional)</span>
        </label>
        <input id="wr-serial" name="serial" autoCapitalize="characters" autoComplete="off" className={fieldClass} />

        <label htmlFor="wr-address" className="mb-1.5 mt-4 block text-sm font-medium text-stone-ink">Street address</label>
        <input id="wr-address" name="address" autoComplete="street-address" className={fieldClass} />

        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor="wr-city" className="mb-1.5 block text-sm font-medium text-stone-ink">City</label>
            <input id="wr-city" name="city" autoComplete="address-level2" className={fieldClass} />
          </div>
          <div>
            <label htmlFor="wr-state" className="mb-1.5 block text-sm font-medium text-stone-ink">State</label>
            <input id="wr-state" name="state" maxLength={2} autoComplete="address-level1" className={fieldClass} />
          </div>
          <div>
            <label htmlFor="wr-zip" className="mb-1.5 block text-sm font-medium text-stone-ink">ZIP</label>
            <input id="wr-zip" name="zip" inputMode="numeric" autoComplete="postal-code" className={fieldClass} />
          </div>
        </div>
      </fieldset>

      <div>
        <label htmlFor="wr-summary" className="mb-1.5 block text-sm font-medium text-stone-ink">What&apos;s wrong?</label>
        <input
          id="wr-summary" name="summary" required maxLength={200}
          placeholder="Front door won't latch" className={fieldClass}
        />
      </div>

      <div>
        <label htmlFor="wr-details" className="mb-1.5 block text-sm font-medium text-stone-ink">
          Any detail that helps <span className="text-stone-muted">(optional)</span>
        </label>
        <textarea id="wr-details" name="details" rows={4} className={fieldClass} />
      </div>

      <div>
        <label htmlFor="wr-photos" className="mb-1.5 block text-sm font-medium text-stone-ink">
          Photos <span className="text-stone-muted">(optional, up to {MAX_PHOTOS})</span>
        </label>
        <input
          id="wr-photos" name="photos" type="file" multiple accept="image/*,application/pdf" capture="environment"
          onChange={(event) => setPhotoCount(Math.min(event.currentTarget.files?.length ?? 0, MAX_PHOTOS))}
          className={fieldClass}
        />
        <p className="mt-1 text-xs text-stone-muted">
          {photoCount > 0 ? `${photoCount} selected. ` : ""}A photo of the problem usually saves a trip.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="wr-preferred" className="mb-1.5 block text-sm font-medium text-stone-ink">Best way to reach you</label>
          <select id="wr-preferred" name="preferred_contact" defaultValue="phone" className={fieldClass}>
            <option value="phone">Phone call</option>
            <option value="text">Text</option>
            <option value="email">Email</option>
          </select>
        </div>
        <div>
          <label htmlFor="wr-time" className="mb-1.5 block text-sm font-medium text-stone-ink">
            Best time <span className="text-stone-muted">(optional)</span>
          </label>
          <input id="wr-time" name="best_time" placeholder="Weekday mornings" className={fieldClass} />
        </div>
      </div>

      <button
        type="submit"
        disabled={!hydrated || status === "sending"}
        className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-brand-700 px-6 py-3 text-base font-semibold text-white transition hover:bg-brand-800 disabled:opacity-60"
      >
        {status === "sending" ? "Sending…" : "Submit warranty request"} <ArrowIcon className="size-4" />
      </button>
      <p className="text-xs text-stone-muted">
        Urgent — no heat, no water, no power, or anything unsafe? Please call{" "}
        <a href={`tel:${site.warrantyPhoneDial}`} className="font-semibold underline">{site.warrantyPhoneDisplay}</a>{" "}
        instead of using this form.
      </p>
    </SafePublicLeadForm>
  );
}
