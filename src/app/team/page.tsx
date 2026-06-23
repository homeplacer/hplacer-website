import type { Metadata } from "next";
import Link from "next/link";
import { PageHero } from "@/components/page-hero";
import { teamGroups, initials, groupPhoto } from "@/lib/team";
import { site } from "@/lib/site";
import { asset } from "@/lib/asset";
import { PhoneIcon, ArrowIcon } from "@/components/icons";

export const metadata: Metadata = {
  title: "Meet the Team",
  description:
    "Meet the Home Placer team — your local, licensed manufactured-home dealer in Horry County, SC. Real people, start to finish.",
  alternates: { canonical: "/team" },
};

export default function TeamPage() {
  return (
    <>
      <PageHero eyebrow="Who you'll work with" title="Meet the team">
        Home Placer is local people, not a call center. From your first question to your
        30-day walk-through, you&apos;ll work with the same team — right here in Horry County.
      </PageHero>

      <section className="container-x pt-12">
        <figure className="mx-auto max-w-3xl overflow-hidden rounded-card border border-stone-line shadow-sm">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={asset(groupPhoto)}
            alt="The Home Placer crew outside the Myrtle Beach office"
            className="w-full object-cover"
          />
          <figcaption className="bg-stone-surface px-5 py-3 text-center text-sm text-stone-muted">
            The Home Placer crew — Myrtle Beach, SC
          </figcaption>
        </figure>
      </section>

      <section className="container-x space-y-12 py-14">
        {teamGroups.map((group) => (
          <div key={group.label}>
            <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-brand-600">
              {group.label}
            </h2>
            <div className="mt-5 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {group.members.map((m) => (
                <div key={m.name} className="overflow-hidden rounded-card border border-stone-line bg-stone-bg">
                  {m.photo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={asset(m.photo)}
                      alt={m.name}
                      className="aspect-[4/5] w-full object-cover"
                    />
                  ) : (
                    <div className="flex aspect-[4/5] w-full items-center justify-center bg-brand-100">
                      <span className="font-display text-5xl font-semibold text-brand-600/70">
                        {initials(m.name)}
                      </span>
                    </div>
                  )}
                  <div className="p-5 text-center">
                    <h3 className="font-display text-lg font-semibold text-stone-ink">{m.name}</h3>
                    <p className="text-sm font-semibold text-brand-600">{m.title}</p>
                    {m.blurb && <p className="mt-2 text-sm leading-relaxed text-stone-muted">{m.blurb}</p>}
                    {m.email && (
                      <a href={`mailto:${m.email}`} className="mt-3 inline-block text-sm font-medium text-brand-700 hover:text-brand-900">
                        {m.email}
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Existing homeowners */}
        <div className="mt-14 grid gap-6 rounded-card border border-stone-line bg-stone-surface p-8 lg:grid-cols-[1.3fr_1fr] lg:items-center">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-brand-600">Already a homeowner?</p>
            <h2 className="mt-2 font-display text-2xl font-semibold text-stone-ink">
              We&apos;re here after the sale, too
            </h2>
            <p className="mt-3 text-stone-muted">
              Need warranty help or have a service issue? Reach our service team directly, or
              send a service request and we&apos;ll get on it.
            </p>
          </div>
          <div className="flex flex-col gap-3">
            <Link
              href="/service-request"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-brand-700 px-6 py-3 text-base font-semibold text-white transition hover:bg-brand-800"
            >
              Request service <ArrowIcon className="size-4" />
            </Link>
            <a
              href={`tel:${site.warrantyPhoneDial}`}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-stone-line bg-stone-bg px-6 py-3 text-base font-semibold text-stone-ink transition hover:border-brand-300"
            >
              <PhoneIcon className="size-4" /> Service line {site.warrantyPhoneDisplay}
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
