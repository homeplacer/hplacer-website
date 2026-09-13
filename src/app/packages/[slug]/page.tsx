import Link from "next/link";
import { notFound } from "next/navigation";
import { getPackage, packageOffer } from "@/lib/packages";
import { getHome } from "@/lib/homes";
import { pageMetadata } from "@/lib/metadata";
import { PageHero } from "@/components/page-hero";
import { ContactForm } from "@/components/contact-form";
import { JsonLd, breadcrumbLd } from "@/lib/jsonld";
// Availability is evaluated on every request; a static cache must never keep an expired offer live.
export const dynamic = "force-dynamic";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const p = getPackage((await params).slug);
  if (!p)
    return {
      title: "Package not available",
      robots: { index: false, follow: true },
    };
  return pageMetadata({
    title: p.title + " — " + p.status.replaceAll("_", " "),
    description:
      p.priceDisclosure +
      " Explore this " +
      p.market +
      " home-and-land record and ask about a new project.",
    alternates: { canonical: `/packages/${p.id}` },
  });
}
export default async function PackagePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const p = getPackage((await params).slug);
  if (!p) notFound();
  const home = getHome(p.modelSlug);
  const offer = packageOffer(p);
  return (
    <>
      <PageHero eyebrow={p.status.replaceAll("_", " ")} title={p.title}>
        {p.priceDisclosure}
      </PageHero>
      <section className="container-x grid gap-12 py-12 lg:grid-cols-2">
        <div>
          {p.publicPhotos.map((photo) => (
            <div key={photo} className="mb-5 overflow-hidden rounded-card">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo}
                alt={p.title}
                width={1200}
                height={900}
                loading="lazy"
                className="aspect-[4/3] w-full object-cover"
              />
            </div>
          ))}
          <h2 className="font-display text-2xl font-semibold">
            The recorded project
          </h2>
          <dl className="my-6 grid grid-cols-2 gap-4">
            <dt>Location</dt>
            <dd>{p.market}</dd>
            <dt>Model</dt>
            <dd>
              <Link href={`/homes/${p.modelSlug}`} className="underline">
                {home?.name}
              </Link>
            </dd>
            {p.lotAcres !== null && (
              <>
                <dt>Recorded lot size</dt>
                <dd>{p.lotAcres} acres</dd>
              </>
            )}
            <dt>Status</dt>
            <dd>{p.status.replaceAll("_", " ")}</dd>
          </dl>
          {offer && (
            <p className="font-semibold">
              Verified package price: ${p.packagePrice?.toLocaleString()}
            </p>
          )}
          <h3 className="font-semibold">What the record supports</h3>
          <ul className="my-3 list-disc space-y-2 pl-5">
            {p.included.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
          <h3 className="mt-6 font-semibold">
            Scope to confirm for a new project
          </h3>
          <ul className="my-3 list-disc space-y-2 pl-5">
            {p.excludedOrVariable.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
          <p className="mt-6 text-sm text-stone-muted">
            {p.status === "sold"
              ? "Historical archive checked"
              : "Availability verified"}
            : {p.lastVerifiedAt.slice(0, 10)}.{" "}
            {p.status === "sold"
              ? "This is not an offer to sell this property. A new home, lot, scope, and price require separate confirmation."
              : "Availability must be reconfirmed before making plans."}
          </p>
          <p className="mt-8">
            <Link href="/packages" className="underline">
              All package records
            </Link>{" "}
            ·{" "}
            <Link href="/guides" className="underline">
              Land-readiness checklists
            </Link>
          </p>
        </div>
        <div
          id="package-inquiry"
          className="rounded-card border border-stone-line p-6"
        >
          <h2 className="mb-4 font-display text-2xl font-semibold">
            {p.status === "sold"
              ? "Ask about a similar project"
              : "Ask about this package"}
          </h2>
          <ContactForm defaultHome={home?.name} packageId={p.id} />
        </div>
      </section>
      <JsonLd
        data={breadcrumbLd([
          { name: "Home", path: "/" },
          { name: "Packages", path: "/packages" },
          { name: p.title, path: `/packages/${p.id}` },
        ])}
      />
      <JsonLd
        data={
          offer
            ? {
                "@context": "https://schema.org",
                "@type": "Product",
                name: p.title,
                description: p.priceDisclosure,
                url: `https://hplacer.com/packages/${p.id}`,
                offers: offer,
                ...(p.publicPhotos.length
                  ? {
                      image: p.publicPhotos.map(
                        (x) => `https://hplacer.com${x}`,
                      ),
                    }
                  : {}),
              }
            : {
                "@context": "https://schema.org",
                "@type": "WebPage",
                name: p.title,
                description: p.priceDisclosure,
                url: `https://hplacer.com/packages/${p.id}`,
                about: { "@type": "Place", name: p.market },
              }
        }
      />
    </>
  );
}
