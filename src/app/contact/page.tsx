import type { Metadata } from "next";
import { ContactForm } from "@/components/contact-form";
import { site } from "@/lib/site";
import { PhoneIcon, PinIcon, CheckIcon } from "@/components/icons";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Talk to Home Placer about new manufactured homes on land in Horry County, SC. Call (843) 849-HOME or send a message.",
};

export default async function ContactPage({
  searchParams,
}: {
  searchParams: Promise<{ home?: string }>;
}) {
  const { home } = await searchParams;

  return (
    <section className="container-x grid gap-12 py-16 lg:grid-cols-[1fr_1.1fr]">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wider text-brand-600">Let&apos;s talk</p>
        <h1 className="mt-2 font-display text-4xl font-semibold text-stone-ink sm:text-5xl">
          Get your home placed
        </h1>
        <p className="mt-4 max-w-md text-stone-muted">
          Tell us what you need and we&apos;ll match you to a home, a lot, and a payment.
          Prefer to talk? Call or text — a real person answers.
        </p>

        <div className="mt-8 space-y-4">
          <a
            href={`tel:${site.phoneDial}`}
            className="flex items-center gap-4 rounded-card border border-stone-line bg-stone-surface p-5 transition hover:border-brand-300"
          >
            <span className="grid size-11 place-items-center rounded-lg bg-brand-700 text-white">
              <PhoneIcon className="size-5" />
            </span>
            <span>
              <span className="block text-xs font-semibold uppercase tracking-wider text-stone-muted">Call or text</span>
              <span className="block font-display text-lg font-semibold text-stone-ink">{site.phoneDisplay}</span>
            </span>
          </a>

          <div className="flex items-center gap-4 rounded-card border border-stone-line bg-stone-surface p-5">
            <span className="grid size-11 place-items-center rounded-lg bg-brand-700 text-white">
              <PinIcon className="size-5" />
            </span>
            <span>
              <span className="block text-xs font-semibold uppercase tracking-wider text-stone-muted">Visit by appointment</span>
              <span className="block font-medium text-stone-ink">
                {site.address.street}, {site.address.city}, {site.address.state} {site.address.zip}
              </span>
            </span>
          </div>
        </div>

        <ul className="mt-8 space-y-2 text-sm text-stone-ink/80">
          {["No-pressure, honest pricing", "We handle land, permits & setup", "Financing help for every budget"].map((t) => (
            <li key={t} className="inline-flex items-center gap-2">
              <CheckIcon className="size-4 text-brand-600" /> {t}
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-card border border-stone-line bg-stone-bg p-6 shadow-sm sm:p-8">
        <ContactForm defaultHome={home ?? ""} />
      </div>
    </section>
  );
}
