import Link from "next/link";
import { PageHero } from "@/components/page-hero";
import { ForturroLandSearch } from "@/components/forturro-land-search";
import { LivePackageListings } from "@/components/live-package-listings";
import { getLivePackageListings } from "@/lib/forturro-package-feed";
import { pageMetadata } from "@/lib/metadata";

export const metadata = pageMetadata({
  title: "Plan a land-home package",
  description:
    "Compare home-and-land records, prepare your lot questions, and request a written package scope and current price from Home Placer.",
  alternates: { canonical: "/land-packages" },
});
export default async function LandPackagesPage() {
  const livePackages = await getLivePackageListings();
  return (
    <>
      <PageHero
        eyebrow="A home and a place for it"
        title="Land-home packages available now"
      >
        These are active Home Placer packages from the MLS. Pick one you like,
        then call or message us for the complete home-and-land scope.
      </PageHero>
      <section className="container-x py-12 sm:py-16">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand-700">
              Active MLS packages
            </p>
            <h2 className="mt-2 font-display text-3xl font-semibold text-stone-ink">
              Available now
            </h2>
          </div>
          <p className="max-w-xl text-sm leading-relaxed text-stone-muted">
            Live status and price come from Forturro&apos;s MLS feed. We show only
            Home Placer addresses registered for this feed.
          </p>
        </div>
        <div className="mt-8"><LivePackageListings listings={livePackages} /></div>
      </section>
      <section className="container-x grid gap-6 py-10 md:grid-cols-2">
        <div className="rounded-card border border-stone-line bg-brand-950 p-8 text-white">
          <p className="text-sm font-semibold uppercase tracking-wider text-accent-300">Already have land?</p>
          <h2 className="mt-2 font-display text-2xl font-semibold">We&apos;ll build the package around it.</h2>
          <p className="mt-3 text-stone-100/80">
            Send us the county and a few details about your lot. We&apos;ll help you
            match the home, site work, and next steps.
          </p>
          <Link
            href="/contact"
            className="mt-6 inline-block rounded-full bg-accent-500 px-5 py-3 font-semibold"
          >
            Message Home Placer →
          </Link>
        </div>
        <div className="rounded-card border border-stone-line bg-stone-surface p-8">
          <p className="text-sm font-semibold uppercase tracking-wider text-brand-700">Need land?</p>
          <h2 className="mt-2 font-display text-2xl font-semibold">Start with the right lot.</h2>
          <p className="mt-3 text-stone-muted">
            Browse lots with our real-estate partner, then come back to Home
            Placer for the home-and-land package.
          </p>
          <Link
            href="/find-land"
            className="mt-6 inline-block font-semibold text-brand-700 underline"
          >
            Find land →
          </Link>
        </div>
      </section>
      <ForturroLandSearch />
    </>
  );
}
