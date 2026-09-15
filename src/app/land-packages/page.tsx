import Link from "next/link";
import { PageHero } from "@/components/page-hero";
import { ContactForm } from "@/components/contact-form";
import { ForturroLandSearch } from "@/components/forturro-land-search";
import { HomeInquiryDialog } from "@/components/home-inquiry-dialog";
import { getLivePackageListings } from "@/lib/forturro-package-feed";
import { pageMetadata } from "@/lib/metadata";

export const metadata = pageMetadata({
  title: "Plan a land-home package",
  description:
    "Compare home-and-land records, prepare your lot questions, and request a written package scope and current price from Home Placer.",
  alternates: { canonical: "/land-packages" },
});
const scope = [
  {
    title: "The home",
    body: "Identify the model, size, layout, and selected options. A model page describes a design; it does not establish a particular home's availability.",
  },
  {
    title: "The lot",
    body: "Identify the location and whether you already own land. Confirm suitability, access, and any applicable restrictions for the particular parcel.",
  },
  {
    title: "Site work and setup",
    body: "Ask for the proposed foundation, clearing, grading, transport, setup, steps, skirting, and related work to be itemized in writing.",
  },
  {
    title: "Utilities and approvals",
    body: "Identify water, sewer or septic, power, permits, and inspections. Record who confirms each item, what is included, and what is still an allowance or unknown.",
  },
];
export default async function LandPackagesPage() {
  const livePackages = await getLivePackageListings();
  return (
    <>
      <PageHero
        eyebrow="A home and a place for it"
        title="Build your package around the actual lot"
      >
        Start with the home you want, the land, and a written scope. Confirm the
        package&apos;s current status and price before making plans.
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
        {livePackages.length ? (
          <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {livePackages.map((listing) => (
              <article
                key={listing.listingKey}
                className="overflow-hidden rounded-card border border-stone-line bg-stone-bg shadow-sm"
              >
                {listing.photoUrl && (
                  // Plain img preserves Forturro's MLS media proxy URL without duplicating its images.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={listing.photoUrl}
                    alt={`${listing.address}, ${listing.city}`}
                    className="aspect-[4/3] w-full object-cover"
                    loading="lazy"
                  />
                )}
                <div className="p-5">
                  <p className="text-sm font-semibold text-brand-700">Home + land package</p>
                  <h3 className="mt-1 font-display text-2xl font-semibold text-stone-ink">
                    {listing.address}
                  </h3>
                  <p className="mt-1 text-stone-muted">{listing.city}, SC</p>
                  <p className="mt-5 font-display text-2xl font-semibold text-brand-800">
                    {new Intl.NumberFormat("en-US", {
                      style: "currency",
                      currency: "USD",
                      maximumFractionDigits: 0,
                    }).format(listing.listPrice)}
                  </p>
                  <p className="mt-2 text-sm text-stone-muted">
                    {listing.beds} bed · {listing.baths} bath
                    {listing.sqft ? ` · ${listing.sqft.toLocaleString()} sqft` : ""}
                  </p>
                  <div className="mt-6 grid grid-cols-2 gap-3">
                    <HomeInquiryDialog
                      homeName={`${listing.address}, ${listing.city}`}
                      label="Message"
                      showArrow={false}
                      className="inline-flex items-center justify-center rounded-lg border border-brand-200 bg-white px-3 py-2.5 text-sm font-semibold text-brand-800 transition hover:border-brand-400 hover:bg-brand-50"
                    />
                    <a
                      href={listing.listingUrl}
                      className="inline-flex items-center justify-center rounded-lg bg-brand-700 px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-800"
                    >
                      See home
                    </a>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="mt-8 rounded-card border border-stone-line bg-stone-surface p-6 text-stone-muted">
            No registered packages are active in the MLS right now. Message us for
            upcoming options or a package on your land.
          </p>
        )}
      </section>
      <section className="container-x grid gap-6 py-12 md:grid-cols-2">
        <div className="rounded-card border border-stone-line bg-brand-950 p-8 text-white">
          <h2 className="font-display text-2xl font-semibold">
            Explore package records
          </h2>
          <p className="mt-3 text-stone-100/80">
            Browse by town, model, and status. Historical sold examples are
            clearly labeled; current availability appears only after
            verification.
          </p>
          <Link
            href="/packages"
            className="mt-6 inline-block rounded-full bg-accent-500 px-5 py-3 font-semibold"
          >
            Browse package records →
          </Link>
        </div>
        <div className="rounded-card border border-stone-line bg-stone-surface p-8">
          <h2 className="font-display text-2xl font-semibold">
            Already have land?
          </h2>
          <p className="mt-3 text-stone-muted">
            Prepare the parcel information and the home dimensions for a site
            discussion. Use our planning checklists to identify the questions
            that need an answer.
          </p>
          <Link
            href="/guides"
            className="mt-6 inline-block font-semibold text-brand-700 underline"
          >
            Prepare for your land review →
          </Link>
        </div>
      </section>
      <section className="bg-stone-surface py-14">
        <div className="container-x">
          <h2 className="font-display text-3xl font-semibold">
            Compare the scope, then the price
          </h2>
          <p className="mt-3 max-w-2xl text-stone-muted">
            These are topics to confirm in your written quote. Inclusions,
            allowances, exclusions, and price depend on the specific home and
            lot.
          </p>
          <div className="mt-8 grid gap-6 md:grid-cols-2">
            {scope.map((s) => (
              <article
                key={s.title}
                className="rounded-card border border-stone-line bg-stone-bg p-6"
              >
                <h3 className="font-display text-xl font-semibold">
                  {s.title}
                </h3>
                <p className="mt-3 text-stone-muted">{s.body}</p>
              </article>
            ))}
          </div>
          <p className="mt-8">
            <Link href="/stories" className="font-semibold underline">
              Explore recorded project experience
            </Link>{" "}
            ·{" "}
            <Link href="/buyer-resources" className="underline">
              Find official county resources
            </Link>
          </p>
        </div>
      </section>
      <section
        id="get-package-price"
        className="container-x grid scroll-mt-24 gap-10 py-16 lg:grid-cols-2"
      >
        <div>
          <h2 className="font-display text-3xl font-semibold">
            Discuss your home and land
          </h2>
          <p className="mt-4 text-stone-muted">
            Tell us the home you like, whether you have land, and the general
            location. Ask the team to confirm current options and prepare a
            written scope and price for your project.
          </p>
          <p className="mt-5">
            <Link href="/homes" className="font-semibold underline">
              Browse the model catalog
            </Link>
          </p>
        </div>
        <div className="rounded-card border border-stone-line p-6">
          <ContactForm />
        </div>
      </section>
      <ForturroLandSearch />
    </>
  );
}
