import { pageMetadata } from "@/lib/metadata";
import type { Metadata } from "next";
import Link from "next/link";
import { ServiceRequestForm } from "@/components/service-request-form";
import { site } from "@/lib/site";
import { PhoneIcon, ArrowIcon } from "@/components/icons";

export const metadata: Metadata = pageMetadata({
  title: "Request Service",
  description:
    "Request general service for your Home Placer home, prepare the details our team needs, or use the separate warranty form to attach photos. Service line: (843) 484-9844.",
  alternates: { canonical: "/service-request" },
});

export default function ServiceRequestPage() {
  return (
    <section className="container-x grid gap-8 py-12 lg:grid-cols-[1fr_1.1fr] lg:gap-12 sm:py-16">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wider text-brand-600">Homeowner service</p>
        <h1 className="mt-2 font-display text-4xl font-semibold text-stone-ink sm:text-5xl">
          Request service
        </h1>
        <p className="mt-4 max-w-md text-stone-muted">
          Already living in a Home Placer home? Use the form for a general service or
          maintenance question. Tell us which home and what needs attention so our team can
          review the request. Prefer to talk? Call the service line below.
        </p>

        <div className="mt-6 rounded-card border border-brand-200 bg-brand-50 p-5">
          <h2 className="font-display text-xl font-semibold text-stone-ink">Warranty issue or defect?</h2>
          <p className="mt-2 text-sm leading-relaxed text-stone-muted">
            Use the separate warranty request form for an issue with the home itself.
            That form accepts photos and lets you identify the home by serial number or address.
            Sending either form does not confirm warranty coverage.
          </p>
          <Link href="/warranty-request" className="mt-4 inline-flex min-h-11 items-center gap-2 font-semibold text-brand-800 underline underline-offset-4">
            Warranty request with photos <ArrowIcon className="size-4 shrink-0" />
          </Link>
        </div>

        <a
          href={`tel:${site.warrantyPhoneDial}`}
          className="mt-8 flex items-center gap-4 rounded-card border border-stone-line bg-stone-surface p-5 transition hover:border-brand-300"
        >
          <span className="grid size-11 place-items-center rounded-lg bg-brand-700 text-white">
            <PhoneIcon className="size-5" />
          </span>
          <span>
            <span className="block text-xs font-semibold uppercase tracking-wider text-stone-muted">Service &amp; warranty line</span>
            <span className="block font-display text-2xl font-semibold text-stone-ink">{site.warrantyPhoneDisplay}</span>
          </span>
        </a>
      </div>

      <div className="rounded-card border border-stone-line bg-stone-bg p-6 shadow-sm sm:p-8">
        <h2 className="font-display text-2xl font-semibold text-stone-ink">General service request</h2>
        <p className="mb-6 mt-2 text-sm leading-relaxed text-stone-muted">
          Name, phone, and a description are required. Email is optional.
          Include your home address to help us identify the property.
          For warranty photos, use the warranty form instead.
        </p>
        <ServiceRequestForm />
      </div>

      <div className="lg:col-span-2">
        <h2 className="font-display text-2xl font-semibold text-stone-ink">What to include</h2>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-stone-muted">
          A clear description helps the team understand the issue without an extra round of questions.
          You do not need to diagnose the problem yourself.
        </p>
        <ul className="mt-5 grid gap-4 md:grid-cols-3">
          {[
            {
              title: "Identify the home",
              body: "Give the street address and city, plus your name and best callback number. If known, mention the model and when you moved in.",
            },
            {
              title: "Describe what changed",
              body: "Explain which room or part of the home is affected, when you first noticed it, and whether it happens constantly or comes and goes.",
            },
            {
              title: "Note access and availability",
              body: "Mention useful callback times and any gate, pet, or property-access details. Do not put private entry codes in the form; share them directly if a visit is arranged.",
            },
          ].map((item) => (
            <li key={item.title} className="rounded-card border border-stone-line bg-stone-surface p-5">
              <h3 className="font-semibold text-stone-ink">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-stone-muted">{item.body}</p>
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-card border border-stone-line bg-stone-surface p-6 lg:col-span-2 sm:p-8">
        <h2 className="font-display text-2xl font-semibold text-stone-ink">Review first, then plan the next step</h2>
        <p className="mt-3 max-w-4xl text-sm leading-relaxed text-stone-muted">
          Our team may need more details, photos, or documents to understand your request.
          Submitting the form does not confirm an appointment, repair, or coverage.
          Timing depends on the issue, access, parts, and any applicable warranty process.
          Wait for a confirmed appointment before making arrangements for a visit.
        </p>
        <p className="mt-3 max-w-4xl text-sm leading-relaxed text-stone-muted">
          If the issue needs a conversation, call the service line rather than relying on a form response.
          This form is not an emergency service.
        </p>
      </div>

      <div className="lg:col-span-2">
        <h2 className="font-display text-2xl font-semibold text-stone-ink">Which warranty applies?</h2>
        <p className="mt-3 max-w-4xl text-sm leading-relaxed text-stone-muted">
          Home Placer provides a one-year builder warranty for defects.
          The separate 2–10 Home Buyers Warranty provides two years of mechanical coverage
          and ten years of structural coverage through the 2–10 company.
          Coverage, exclusions, and claim procedures follow your written warranties.
          Keep those documents available when discussing a warranty issue.
        </p>
        <Link href="/warranty" className="mt-3 inline-flex min-h-11 items-center gap-2 font-semibold text-brand-800 underline underline-offset-4">
          See the warranty overview <ArrowIcon className="size-4 shrink-0" />
        </Link>
      </div>
    </section>
  );
}
