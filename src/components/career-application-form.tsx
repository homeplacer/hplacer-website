"use client";

import { useState } from "react";
import { ArrowIcon, CheckIcon } from "@/components/icons";
import { Honeypot } from "@/components/honeypot";

const field = "mt-1.5 w-full rounded-lg border border-stone-line bg-stone-bg px-3.5 py-2.5 text-sm text-stone-ink outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-200";
const roles = ["Site Work & Equipment Operator", "Laborer", "CDL Driver", "Carpenter", "Diesel / Heavy Equipment Service Technician", "General application"];

export function CareerApplicationForm() {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState("");
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (state === "sending") return;
    setState("sending"); setError(""); const form = event.currentTarget;
    try {
      const response = await fetch("/api/careers/apply", { method: "POST", body: new FormData(form) });
      const data = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(data.error || "We could not submit your application. Please try again.");
      form.reset(); setState("sent");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Please try again."); setState("error"); }
  }
  if (state === "sent") return <div className="rounded-card border border-brand-200 bg-brand-50 p-8 text-center"><div className="mx-auto grid size-12 place-items-center rounded-full bg-brand-600 text-white"><CheckIcon className="size-6" strokeWidth={2.5} /></div><h2 className="mt-4 font-display text-2xl font-semibold text-brand-900">Application received.</h2><p className="mt-2 text-sm text-stone-muted">Thank you. Our team will review it and contact you if there is a fit.</p></div>;
  return <form onSubmit={submit} encType="multipart/form-data" className="space-y-5"><Honeypot />
    {state === "error" && <p className="rounded-lg border border-red-300 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">{error}</p>}
    <div className="grid gap-4 sm:grid-cols-2"><Input label="Full name" name="name" autoComplete="name" required /><Input label="Phone" name="phone" type="tel" autoComplete="tel" required /><Input label="Email" name="email" type="email" autoComplete="email" required /><Input label="City and state" name="location" required /></div>
    <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-medium text-stone-ink">Position<select name="position" required defaultValue="" className={field}><option value="" disabled>Select a position</option>{roles.map((role) => <option key={role}>{role}</option>)}</select></label><Input label="When can you start?" name="available_on" type="date" /></div>
    <label className="block text-sm font-medium text-stone-ink">Relevant experience<textarea name="experience" rows={5} required className={field} placeholder="Construction, manufactured-home, driving, carpentry, equipment, or service experience" /></label>
    <Input label="CDL class, endorsements, or certifications (optional)" name="credentials" placeholder="Class A CDL, tanker endorsement, excavator experience" />
    <label className="block text-sm font-medium text-stone-ink">References (optional)<textarea name="references" rows={3} className={field} placeholder="Name, company, phone, and how you worked together" /></label>
    <label className="block text-sm font-medium text-stone-ink">Resume (optional · PDF, DOC, or DOCX · 10 MB max)<input name="resume" type="file" accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" className={`${field} file:mr-3 file:rounded-md file:border-0 file:bg-brand-100 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-brand-800`} /></label>
    <label className="flex items-start gap-3 text-sm text-stone-muted"><input name="consent" value="yes" type="checkbox" required className="mt-1 size-4 accent-brand-700" /><span>I confirm this information is accurate and authorize Home Placer to contact me about employment opportunities.</span></label>
    <button disabled={state === "sending"} className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-accent-500 px-6 py-3 text-base font-semibold text-white transition hover:bg-accent-600 disabled:opacity-60">{state === "sending" ? "Submitting…" : "Submit application"}<ArrowIcon className="size-4" /></button>
  </form>;
}
function Input({ label, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) { return <label className="block text-sm font-medium text-stone-ink">{label}<input {...props} className={field} /></label>; }
