import { pageMetadata } from "@/lib/metadata";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHero } from "@/components/page-hero";
import { getAllPosts, formatDate } from "@/lib/blog";
import { ArrowIcon } from "@/components/icons";
import { BlogCollection } from "@/components/blog/blog-collection";
import { HomeInquiryDialog } from "@/components/home-inquiry-dialog";

export const metadata: Metadata = pageMetadata({
  title: "Blog — Buying a Manufactured Home in SC",
  description:
    "Straight talk on buying a new manufactured home on land in Horry County, SC — pricing, financing, brands, and the land-home package process.",
  alternates: { canonical: "/blog" },
});

export default function BlogPage() {
  const posts = getAllPosts();
  const [featured, ...rest] = posts;

  return (
    <>
      <PageHero eyebrow="The Home Placer buyer library" title="Clear answers before you choose a home or lot">
        Straight talk on new manufactured homes on land — local costs, financing,
        land readiness, and what happens between choosing a plan and getting the keys.
      </PageHero>

      <section className="container-x pt-12 sm:pt-16">
        {featured && (
          <div className="grid overflow-hidden rounded-[1.5rem] border border-stone-line bg-stone-surface lg:grid-cols-[1.3fr_0.7fr]">
            <Link
              href={`/blog/${featured.slug}`}
              className="group block p-7 transition hover:bg-brand-50 sm:p-9"
            >
              <p className="text-xs font-semibold uppercase tracking-wider text-brand-600">
                Start here · {formatDate(featured.date)} · {featured.readMinutes} min read
              </p>
              <h2 className="mt-3 max-w-3xl font-display text-3xl font-semibold leading-tight text-stone-ink group-hover:text-brand-800 sm:text-4xl">
                {featured.title}
              </h2>
              <p className="mt-4 max-w-2xl text-stone-muted">{featured.description}</p>
              <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-brand-700">
                Read this guide <ArrowIcon className="size-4" />
              </span>
            </Link>
            <aside className="border-t border-stone-line bg-brand-950 p-7 text-white lg:border-l lg:border-t-0 sm:p-9">
              <p className="text-sm font-semibold uppercase tracking-wider text-accent-300">Need a local answer?</p>
              <h2 className="mt-2 font-display text-2xl font-semibold">Talk through your land-home plan with us.</h2>
              <p className="mt-3 text-sm leading-relaxed text-stone-100/80">
                Tell us your town, timeline, and the kind of home you have in mind. We&apos;ll help you sort the next step.
              </p>
              <HomeInquiryDialog
                homeName="a Home Placer land-home package"
                label="Ask a local question"
                showArrow={false}
                className="mt-5 inline-flex items-center justify-center rounded-full bg-accent-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-accent-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-brand-950"
              />
            </aside>
          </div>
        )}
      </section>
      <BlogCollection posts={rest} />
    </>
  );
}
