import type { Metadata } from "next";
import Link from "next/link";
import { PageHero } from "@/components/page-hero";
import { galleryByCategory } from "@/lib/gallery";
import { site } from "@/lib/site";
import { CheckIcon, ArrowIcon, PhoneIcon } from "@/components/icons";

export const metadata: Metadata = {
  title: "Our Work — Homes & Land Development",
  description:
    "Real manufactured homes Home Placer has placed on land across Horry County, SC, plus our site and land development work — from raw lots to finished communities.",
  alternates: { canonical: "/gallery" },
};

function Masonry({ items }: { items: { src: string; alt: string }[] }) {
  return (
    <div className="columns-1 gap-4 sm:columns-2 lg:columns-3 [&>*]:mb-4">
      {items.map((img) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={img.src}
          src={img.src}
          alt={img.alt}
          loading="lazy"
          className="w-full rounded-card border border-stone-line object-cover shadow-sm"
        />
      ))}
    </div>
  );
}

export default function GalleryPage() {
  const homes = galleryByCategory("homes");
  const dev = galleryByCategory("development");

  return (
    <>
      <PageHero eyebrow="Our work" title="Homes placed. Land developed.">
        Home Placer doesn&apos;t just sell homes — we develop the land and set the home. These
        are real Home Placer projects across Horry County: brand-new manufactured homes on
        their lots, and the site and land development that gets them there.
      </PageHero>

      {/* Site development emphasis */}
      <section className="border-b border-stone-line bg-stone-surface">
        <div className="container-x grid gap-6 py-10 sm:grid-cols-3">
          {[
            { t: "We develop the land", d: "Clearing, grading, roads, and lots — we turn raw acreage into buildable home sites." },
            { t: "We set the home", d: "Delivery, foundation, tie-downs, skirting, and utility hookups — handled start to finish." },
            { t: "You get a finished home", d: "Move-in ready on its own lot, with a rock-vinyl skirted, warrantied home." },
          ].map((s) => (
            <div key={s.t} className="flex items-start gap-3">
              <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-brand-100 text-brand-700">
                <CheckIcon className="size-4" strokeWidth={2.5} />
              </span>
              <div>
                <h2 className="font-display text-lg font-semibold text-stone-ink">{s.t}</h2>
                <p className="mt-1 text-sm text-stone-muted">{s.d}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {homes.length > 0 && (
        <section className="container-x py-14">
          <h2 className="font-display text-3xl font-semibold text-stone-ink">Homes we&apos;ve placed</h2>
          <p className="mt-2 max-w-2xl text-stone-muted">
            Brand-new manufactured homes set on land across the Grand Strand — some freshly
            delivered, some finished with rock-vinyl skirting and ready to move in.
          </p>
          <div className="mt-8">
            <Masonry items={homes} />
          </div>
        </section>
      )}

      {dev.length > 0 && (
        <section className="bg-stone-surface py-14">
          <div className="container-x">
            <h2 className="font-display text-3xl font-semibold text-stone-ink">Land &amp; site development</h2>
            <p className="mt-2 max-w-2xl text-stone-muted">
              From cleared lots to finished neighborhoods — the development work behind every
              Home Placer community.
            </p>
            <div className="mt-8">
              <Masonry items={dev} />
            </div>
          </div>
        </section>
      )}

      <section className="container-x py-16">
        <div className="topo overflow-hidden rounded-3xl bg-brand-900 px-8 py-12 text-center text-white">
          <h2 className="font-display text-3xl font-semibold">Have land — or want us to find it?</h2>
          <p className="mx-auto mt-3 max-w-xl text-stone-100/80">
            Whether you bring a lot or use ours, we develop the site and set your new home. Let&apos;s
            talk about your project.
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 rounded-full bg-accent-500 px-6 py-3 text-base font-semibold text-white transition hover:bg-accent-600"
            >
              Start your project <ArrowIcon className="size-4" />
            </Link>
            <a
              href={`tel:${site.phoneDial}`}
              className="inline-flex items-center gap-2 rounded-full bg-white/10 px-6 py-3 text-base font-semibold text-white ring-1 ring-white/20 transition hover:bg-white/15"
            >
              <PhoneIcon className="size-4" /> {site.phoneDisplay}
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
