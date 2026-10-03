import Link from "next/link";
import { PageHero } from "@/components/page-hero";
import { pageMetadata } from "@/lib/metadata";
import { buyerLearningLinks } from "@/lib/resource-navigation";

export const metadata = pageMetadata({
  title: "Official county and home-buying resources",
  description: "Find official Horry, Georgetown, Brunswick, and Columbus county resources, plus HUD and USDA program information, from one Home Placer directory.",
  alternates: { canonical: "/buyer-resources" },
});

const countyResources = [
  { name: "Horry County, SC", label: "Code Enforcement and permit resources", url: "https://www.horrycountysc.gov/Departments/Code-Enforcement" },
  { name: "Georgetown County, SC", label: "Manufactured-home permit application (PDF)", url: "https://gtcounty.org/DocumentCenter/View/154/Mobile-Home-Permit-Application-PDF" },
  { name: "Brunswick County, NC", label: "County manufactured-home brochure (PDF)", url: "https://www.brunswickcountync.gov/DocumentCenter/View/214/Manufactured-Homes-Brochure-2022-PDF" },
  { name: "Columbus County, NC", label: "Building Inspections and online permit center", url: "https://www.columbusco.org/building-inspections" },
];

export default function BuyerResourcesPage() {
  return <>
    <PageHero eyebrow="Buyer resources" title="Start with the official source">
      Keep the county office, your lender, and Home Placer within reach while you plan your home and lot.
    </PageHero>
    <section className="container-x py-12" id="counties">
      <h2 className="font-display text-3xl font-semibold">County resources</h2>
      <p className="mt-3 max-w-3xl text-stone-muted">Choose the county where the lot is located. Ask the linked office which department handles your specific address and where to find the current forms.</p>
      <div className="mt-6 grid gap-5 sm:grid-cols-2">
        {countyResources.map(resource => <article key={resource.name} className="rounded-card border border-stone-line bg-stone-surface p-6">
          <h3 className="font-display text-xl font-semibold">{resource.name}</h3>
          <a href={resource.url} className="mt-3 inline-block font-semibold text-brand-700 underline">{resource.label} ↗</a>
        </article>)}
      </div>
      <h3 className="mt-8 font-display text-xl font-semibold">Questions to take to the county office</h3>
      <ul className="mt-3 list-disc space-y-2 pl-5 text-stone-muted">
        <li>Which office handles this address, including any city or town jurisdiction?</li>
        <li>Where can I find the current application and document checklist for this home and lot?</li>
        <li>Who should I contact about access, water, sewer or septic, and flood information?</li>
      </ul>
    </section>
    <section className="container-x border-t border-stone-line py-12" id="financing">
      <h2 className="font-display text-3xl font-semibold">Official financing information</h2>
      <p className="mt-3 max-w-3xl text-stone-muted">Read the program information directly, then ask your lender which options it offers for your proposed home and property.</p>
      <ul className="mt-5 space-y-3 font-semibold text-brand-700 underline">
        <li><a href="https://www.hud.gov/program_offices/housing/sfh/title/repair">HUD: manufactured-home financing — Title I ↗</a></li>
        <li><a href="https://www.rd.usda.gov/programs-services/single-family-housing-programs/single-family-housing-guaranteed-loan-program">USDA: Single Family Housing Guaranteed Loan Program ↗</a></li>
      </ul>
      <h3 className="mt-8 font-display text-xl font-semibold">Questions to take to your lender</h3>
      <ul className="mt-3 list-disc space-y-2 pl-5 text-stone-muted">
        <li>Which loan programs do you offer for this home and lot?</li>
        <li>What property, foundation, title, and borrower documents will you review?</li>
        <li>What does the written estimate include, and what costs remain outside it?</li>
      </ul>
    </section>
    <section className="container-x border-t border-stone-line py-12" id="learn">
      <h2 className="font-display text-3xl font-semibold">Understand your home options</h2>
      <p className="mt-3 max-w-3xl text-stone-muted">Find a useful guide or a plain-language explanation before choosing your home and lot.</p>
      <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {buyerLearningLinks.map((resource) => (
          <li key={resource.href}>
            <Link href={resource.href} className="block h-full rounded-card border border-stone-line bg-stone-surface p-5 transition hover:border-brand-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700">
              <h3 className="font-display text-lg font-semibold text-brand-800">{resource.label} <span aria-hidden="true">→</span></h3>
              <p className="mt-2 text-sm leading-relaxed text-stone-muted">{resource.description}</p>
            </Link>
          </li>
        ))}
      </ul>
      <p className="mt-6 max-w-3xl text-sm leading-relaxed text-stone-muted">
        Planning for single-level living near the coast? Our{" "}
        <Link href="/blog/affordable-retirement-homes-grand-strand-no-hoa" className="font-semibold text-brand-700 underline underline-offset-4">Grand Strand retirement-home guide</Link>{" "}
        is a starting point for comparing homes and lots. Confirm HOA or deed restrictions,
        access needs, and ongoing costs for the specific property before deciding.
      </p>
    </section>
    <section className="container-x border-t border-stone-line py-12">
      <h2 className="font-display text-2xl font-semibold">Bring your home and lot together</h2>
      <p className="mt-3 text-stone-muted">Share the model you like and the listing or lot you are considering with Home Placer.</p>
      <div className="mt-5 flex flex-wrap gap-5 font-semibold text-brand-700 underline">
        <Link href="/contact">Talk with Home Placer</Link>
        <Link href="/homes">Explore floor plans</Link>
        <Link href="/find-land">Find land</Link>
        <Link href="/warranty">Builder and 2–10 warranty details</Link>
      </div>
    </section>
  </>;
}
