import type { Metadata } from "next";
import { PageHero } from "@/components/page-hero";
import { ServiceRequestForm } from "@/components/service-request-form";
import { site } from "@/lib/site";
import { PhoneIcon, CheckIcon } from "@/components/icons";

export const metadata: Metadata = {
  title: "Request Service",
  description:
    "Home Placer homeowners: request warranty or service help. Submit a service request or call our service line at (843) 484-9844.",
  alternates: { canonical: "/service-request" },
};

export default function ServiceRequestPage() {
  return (
    <section className="container-x grid gap-12 py-16 lg:grid-cols-[1fr_1.1fr]">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wider text-brand-600">Homeowner service</p>
        <h1 className="mt-2 font-display text-4xl font-semibold text-stone-ink sm:text-5xl">
          Request service
        </h1>
        <p className="mt-4 max-w-md text-stone-muted">
          Already living in a Home Placer home? Tell us what you need and our service team will
          follow up. Prefer to call? Use our service line below.
        </p>
        <p className="mt-4 max-w-md text-sm text-stone-muted">
          Warranty issue with the home itself?{" "}
          <a href="/warranty-request" className="font-semibold underline">Submit a warranty request</a>{" "}
          instead — you can attach photos and it goes straight to our service board.
        </p>

        <a
          href={`tel:${site.warrantyPhoneDial}`}
          className="mt-8 flex items-center gap-4 rounded-card border border-stone-line bg-stone-surface p-5 transition hover:border-brand-300"
        >
          <span className="grid size-11 place-items-center rounded-lg bg-brand-700 text-white">
            <PhoneIcon className="size-5" />
          </span>
          <span>
            <span className="block text-xs font-semibold uppercase tracking-wider text-stone-muted">Service &amp; warranty line</span>
            <span className="block font-display text-lg font-semibold text-stone-ink">{site.warrantyPhoneDisplay}</span>
          </span>
        </a>

        <ul className="mt-8 space-y-2 text-sm text-stone-ink/80">
          {["1-year limited warranty", "30-day walk-through after move-in", "Local service team — real people"].map((t) => (
            <li key={t} className="inline-flex items-center gap-2">
              <CheckIcon className="size-4 text-brand-600" /> {t}
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-card border border-stone-line bg-stone-bg p-6 shadow-sm sm:p-8">
        <ServiceRequestForm />
      </div>
    </section>
  );
}
