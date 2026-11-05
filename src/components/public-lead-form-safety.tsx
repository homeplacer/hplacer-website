"use client";

import { useEffect, useId, useRef, useSyncExternalStore } from "react";
import type { FormEventHandler, ReactNode, RefObject } from "react";
import { site } from "@/lib/site";

export type LeadFormStatus = "idle" | "sending" | "sent" | "error";
const subscribeToHydration = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;

/** Frontend-only safety: no native form exists until its handlers are ready. */
export function usePublicLeadFormSafety(status: LeadFormStatus) {
  const formId = useId();
  const hydrated = useSyncExternalStore(subscribeToHydration, clientSnapshot, serverSnapshot);
  const inFlight = useRef(false);
  const successHeadingRef = useRef<HTMLHeadingElement>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (status === "sent") successHeadingRef.current?.focus({ preventScroll: true });
    if (status === "error") errorRef.current?.focus();
  }, [status]);

  return {
    formId,
    hydrated,
    successHeadingRef,
    errorRef,
    beginSubmission() {
      if (!hydrated || inFlight.current || status === "sent") return false;
      inFlight.current = true;
      return true;
    },
    endSubmission() { inFlight.current = false; },
  };
}

export function SafePublicLeadForm({
  hydrated, formId, errorRef, status, dataFormType, legend, onSubmit, children, confirmation,
  error, pendingMessage, successAnnouncement, service = false,
  encType, fieldClassName = "space-y-4",
}: {
  hydrated: boolean;
  formId: string;
  errorRef: RefObject<HTMLParagraphElement | null>;
  status: LeadFormStatus;
  dataFormType: string;
  legend: string;
  onSubmit: FormEventHandler<HTMLFormElement>;
  children: ReactNode;
  confirmation: ReactNode;
  error: ReactNode;
  pendingMessage: string;
  successAnnouncement: string;
  service?: boolean;
  encType?: "multipart/form-data";
  fieldClassName?: string;
}) {
  const errorId = `${formId}-error`;
  const phoneDial = service ? site.warrantyPhoneDial : site.phoneDial;
  const phoneDisplay = service ? site.warrantyPhoneDisplay : site.phoneDisplay;
  const subject = encodeURIComponent(legend);
  const text = encodeURIComponent(service ? "Hi Home Placer, I have a service request." : `Hi Home Placer, ${legend.toLowerCase()}.`);
  const fields = (
    <fieldset disabled={!hydrated || status === "sending"} className={`min-w-0 ${fieldClassName}`}>
      <legend className="sr-only">{legend}</legend>
      {children}
    </fieldset>
  );

  return (
    <div data-form-region={dataFormType} className="space-y-4">
      {/* Keep both regions mounted across pending, retries, and confirmation. */}
      <p role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {status === "sending" ? pendingMessage : status === "sent" ? successAnnouncement : ""}
      </p>
      <p ref={errorRef} id={errorId} role="alert" aria-atomic="true" tabIndex={-1} className={status === "error"
        ? "rounded-lg border border-red-300 bg-red-50 px-3.5 py-2.5 text-sm text-red-700"
        : "sr-only"}>
        {status === "error" ? error : null}
      </p>
      {status === "sent" ? confirmation : hydrated ? (
        <form data-form-type={dataFormType} onSubmit={onSubmit} encType={encType}
          aria-busy={status === "sending"} aria-describedby={errorId}>
          {fields}
        </form>
      ) : (
        <div data-form-type={dataFormType}>{fields}</div>
      )}
      {!hydrated && (
        <div className="rounded-lg border border-brand-200 bg-brand-50 p-4 text-sm text-stone-ink">
          <p>This form needs JavaScript to load. If it doesn’t become available, call, text, or email us instead.</p>
          <div className="mt-2 flex flex-wrap gap-3 font-semibold text-brand-800">
            <a href={`tel:${phoneDial}`} className="underline">Call {phoneDisplay}</a>
            <a href={`sms:${phoneDial}?body=${text}`} className="underline">Text us</a>
            <a href={`mailto:${site.email}?subject=${subject}`} className="underline">Email us</a>
          </div>
        </div>
      )}
    </div>
  );
}
