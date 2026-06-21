import type { Metadata } from "next";
import Link from "next/link";
import { PageHero } from "@/components/page-hero";
import { getAllPosts, formatDate } from "@/lib/blog";
import { ArrowIcon } from "@/components/icons";

export const metadata: Metadata = {
  title: "Blog — Buying a Manufactured Home in SC",
  description:
    "Straight talk on buying a new manufactured home on land in Horry County, SC — pricing, financing, brands, and the land-home package process.",
};

export default function BlogPage() {
  const posts = getAllPosts();
  const [featured, ...rest] = posts;

  return (
    <>
      <PageHero eyebrow="The Home Placer blog" title="Home buying, minus the runaround">
        Honest guides to buying a brand-new home on land in Horry County — pricing,
        financing, brands, and what to expect along the way.
      </PageHero>

      <section className="container-x py-12">
        {featured && (
          <Link
            href={`/blog/${featured.slug}`}
            className="group block rounded-card border border-stone-line bg-stone-surface p-8 transition hover:border-brand-300"
          >
            <p className="text-xs font-semibold uppercase tracking-wider text-brand-600">
              Latest · {formatDate(featured.date)} · {featured.readMinutes} min read
            </p>
            <h2 className="mt-3 max-w-3xl font-display text-3xl font-semibold text-stone-ink group-hover:text-brand-800">
              {featured.title}
            </h2>
            <p className="mt-3 max-w-2xl text-stone-muted">{featured.description}</p>
            <span className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-brand-700">
              Read the post <ArrowIcon className="size-4" />
            </span>
          </Link>
        )}

        <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {rest.map((p) => (
            <Link
              key={p.slug}
              href={`/blog/${p.slug}`}
              className="group flex flex-col rounded-card border border-stone-line bg-stone-bg p-6 transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md"
            >
              <p className="text-xs font-semibold uppercase tracking-wider text-stone-muted">
                {formatDate(p.date)} · {p.readMinutes} min
              </p>
              <h3 className="mt-2 font-display text-xl font-semibold text-stone-ink group-hover:text-brand-800">
                {p.title}
              </h3>
              <p className="mt-2 flex-1 text-sm text-stone-muted">{p.description}</p>
              <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700">
                Read more <ArrowIcon className="size-3.5" />
              </span>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
