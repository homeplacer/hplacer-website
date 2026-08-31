import { site } from "@/lib/site";
import { ArrowIcon, PinIcon } from "@/components/icons";

// Cross-over to Home Placer's sister real estate company (The Forturro Group).
// A buyer who needs to find land — or wants to browse existing homes — gets sent
// to the new Forturro website instead of leaving for Zillow. UTMs preserve the
// Home Placer referral; no legacy search-provider domain is used.
export function ForturroLandSearch({
  variant = "section",
}: {
  variant?: "section" | "bare";
}) {
  const inner = (
    <div className="relative overflow-hidden rounded-3xl border border-brand-200 bg-gradient-to-br from-brand-50 via-stone-bg to-accent-50 p-8 sm:p-12">
      <div className="relative mx-auto max-w-3xl text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-stone-bg px-3 py-1 text-xs font-semibold uppercase tracking-wider text-brand-700">
          <PinIcon className="size-3.5" /> Don&apos;t have land yet?
        </span>
        <h2 className="mt-4 font-display text-3xl font-semibold text-stone-ink sm:text-4xl">
          Find your land. We&apos;ll place the home.
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-lg leading-relaxed text-stone-ink/85">
          No lot? No problem. Our sister company, <strong className="font-semibold text-stone-ink">{site.forturro.name}</strong>,
          is a Grand Strand real estate team with the{" "}
          <strong className="font-semibold text-stone-ink">full MLS</strong>{" "}at your fingertips — every lot and acre
          for sale from Conway to the coast. Find the right piece of land, and we&apos;ll handle the rest: the home, the
          setup, and the package.
        </p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <a
            href={site.forturro.landSearchUrl}
            target="_blank"
            rel="noopener"
            className="inline-flex items-center gap-2 rounded-full bg-brand-700 px-6 py-3 text-base font-semibold text-white transition hover:bg-brand-800"
          >
            Search land for sale <ArrowIcon className="size-4" />
          </a>
          <a
            href={site.forturro.searchUrl}
            target="_blank"
            rel="noopener"
            className="inline-flex items-center gap-2 rounded-full border border-stone-line bg-stone-bg px-6 py-3 text-base font-semibold text-stone-ink transition hover:border-brand-300"
          >
            Browse all listings
          </a>
        </div>
        <p className="mt-5 text-sm text-stone-muted">
          Already have land?{" "}
          <a href="/contact" className="font-semibold text-brand-700 hover:text-brand-900">Tell us about your lot</a>{" "}and we&apos;ll get you a real number.
        </p>
      </div>
    </div>
  );

  if (variant === "bare") return inner;

  return (
    <section className="container-x py-16">
      {inner}
    </section>
  );
}
