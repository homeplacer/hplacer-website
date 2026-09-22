import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { HomeInquiryDialog } from "@/components/home-inquiry-dialog";
import { BathIcon, BedIcon, PhoneIcon, RulerIcon } from "@/components/icons";
import { JsonLd, breadcrumbLd } from "@/lib/jsonld";
import { getLivePackageBySlug } from "@/lib/forturro-package-feed";
import { pageMetadata } from "@/lib/metadata";
import { site } from "@/lib/site";

export const revalidate = 300;

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const listing = await getLivePackageBySlug((await params).slug);
  if (!listing) return { title: "Land-home package not found" };
  return pageMetadata({
    title: `${listing.address}, ${listing.city}, SC | Land-home package`,
    description: `${listing.beds}-bed, ${listing.baths}-bath land-home package in ${listing.city}, SC, currently offered at ${new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(listing.listPrice)}. Ask Home Placer for the current scope and availability.`,
    alternates: { canonical: `/land-packages/${(await params).slug}` },
  });
}

export default async function LandPackageDetail({ params }: Props) {
  const { slug } = await params;
  const listing = await getLivePackageBySlug(slug);
  if (!listing) notFound();
  const price = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(listing.listPrice);
  const url = `${site.url}/land-packages/${slug}`;
  const residence = {
    "@context": "https://schema.org",
    "@type": "SingleFamilyResidence",
    name: `${listing.address}, ${listing.city}, SC land-home package`,
    url,
    ...(listing.photoUrl ? { image: listing.photoUrl } : {}),
    numberOfBedrooms: listing.beds,
    numberOfBathroomsTotal: listing.baths,
    ...(listing.sqft ? { floorSize: { "@type": "QuantitativeValue", value: listing.sqft, unitCode: "FTK" } } : {}),
    address: { "@type": "PostalAddress", streetAddress: listing.address, addressLocality: listing.city, addressRegion: "SC", addressCountry: "US" },
    offers: { "@type": "Offer", price: listing.listPrice, priceCurrency: "USD", availability: "https://schema.org/InStock", url },
  };

  return <>
    <JsonLd data={residence} />
    <JsonLd data={breadcrumbLd([{ name: "Home", path: "/" }, { name: "Land Packages", path: "/land-packages" }, { name: listing.address, path: `/land-packages/${slug}` }])} />
    <section className="container-x py-8 sm:py-12">
      <Link href="/land-packages" className="text-sm font-semibold text-brand-700 hover:underline">← All land-home packages</Link>
      <div className="mt-5 grid gap-8 lg:grid-cols-[1.35fr_0.65fr]">
        <div>
          {listing.photoUrl ? (
            // Forturro's signed MLS proxy URL cannot be safely re-hosted by Next's image optimizer.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={listing.photoUrl} alt={`${listing.address}, ${listing.city}, SC`} className="aspect-[3/2] w-full rounded-card object-cover shadow-sm" decoding="async" />
          ) : <div className="aspect-[3/2] rounded-card bg-stone-surface" />}
        </div>
        <aside className="rounded-card border border-stone-line bg-stone-surface p-6 sm:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand-700">Active MLS package</p>
          <h1 className="mt-3 font-display text-3xl font-semibold text-stone-ink">{listing.address}</h1>
          <p className="mt-1 text-stone-muted">{listing.city}, South Carolina</p>
          <p className="mt-5 font-display text-4xl font-semibold text-brand-900">{price}</p>
          <p className="mt-1 text-sm text-stone-muted">Current MLS list price. Availability and package scope should be confirmed with Home Placer.</p>
          <div className="mt-6 flex flex-wrap gap-x-5 gap-y-3 border-y border-stone-line py-5 text-sm font-semibold text-stone-ink">
            <span className="inline-flex items-center gap-1.5"><BedIcon className="size-4 text-accent-500" /> {listing.beds} beds</span>
            <span className="inline-flex items-center gap-1.5"><BathIcon className="size-4 text-accent-500" /> {listing.baths} baths</span>
            {listing.sqft ? <span className="inline-flex items-center gap-1.5"><RulerIcon className="size-4 text-accent-500" /> {listing.sqft.toLocaleString()} sq ft</span> : null}
          </div>
          <HomeInquiryDialog homeName={`${listing.address}, ${listing.city}`} label="Ask about this home" showArrow={false} className="mt-6 flex w-full items-center justify-center rounded-lg bg-brand-700 px-4 py-3 font-semibold text-white transition hover:bg-brand-800" />
          <a href={`tel:${site.phoneDial}`} className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-brand-700 px-4 py-3 font-semibold text-brand-800 transition hover:bg-brand-50"><PhoneIcon className="size-4" /> Call {site.phoneDisplay}</a>
        </aside>
      </div>
    </section>
    <section className="bg-stone-surface py-10"><div className="container-x max-w-4xl"><h2 className="font-display text-2xl font-semibold text-stone-ink">One team for the home and the land</h2><p className="mt-3 leading-relaxed text-stone-muted">We will confirm the current home-and-land scope, timing, included site work, and financing path before you make a decision. Ask us about this package or about placing a home on your own land.</p></div></section>
  </>;
}
