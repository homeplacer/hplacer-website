import type { Metadata } from "next";
import Link from "next/link";
import { PageHero } from "@/components/page-hero";
import { locations } from "@/lib/locations";
import { PinIcon, ArrowIcon } from "@/components/icons";

export const metadata: Metadata = {
  title: "Where We Build — Horry County, SC",
  description:
    "Home Placer places new manufactured homes on land across the Grand Strand: Myrtle Beach, Conway, Loris, Longs, and Aynor, SC.",
};

export default function LocationsPage() {
  return (
    <>
      <PageHero eyebrow="Where we build" title="New homes across the Grand Strand">
        We place homes on scattered lots throughout Horry County — your home isn&apos;t confined
        to one subdivision, and there&apos;s never an HOA.
      </PageHero>

      <section className="container-x py-12">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {locations.map((l) => (
            <Link
              key={l.slug}
              href={`/locations/${l.slug}`}
              className="group flex flex-col rounded-card border border-stone-line bg-stone-bg p-6 transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md"
            >
              <span className="inline-flex items-center gap-2 text-brand-600">
                <PinIcon className="size-5" />
                <span className="font-display text-xl font-semibold text-stone-ink group-hover:text-brand-800">
                  {l.name}
                </span>
              </span>
              <p className="mt-3 flex-1 text-sm text-stone-muted">{l.intro}</p>
              <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700">
                Homes in {l.name} <ArrowIcon className="size-3.5" />
              </span>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
