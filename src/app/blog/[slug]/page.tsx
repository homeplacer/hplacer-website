import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getAllPosts, getPost, renderMarkdown, formatDate } from "@/lib/blog";
import { JsonLd, articleLd, breadcrumbLd } from "@/lib/jsonld";
import { PhoneIcon, ArrowIcon } from "@/components/icons";
import { site } from "@/lib/site";

export function generateStaticParams() {
  return getAllPosts().map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) return { title: "Post not found" };
  return {
    title: post.title,
    description: post.description,
    alternates: { canonical: `/blog/${slug}` },
    openGraph: {
      type: "article",
      url: `/blog/${slug}`,
      title: post.title,
      description: post.description,
    },
  };
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) notFound();

  const html = renderMarkdown(post.bodyMarkdown);
  const more = getAllPosts().filter((p) => p.slug !== post.slug).slice(0, 2);

  return (
    <>
      <JsonLd data={articleLd(post)} />
      <JsonLd
        data={breadcrumbLd([
          { name: "Home", path: "/" },
          { name: "Blog", path: "/blog" },
          { name: post.title, path: `/blog/${post.slug}` },
        ])}
      />
      <article className="container-x max-w-3xl py-12">
        <div className="text-sm text-stone-muted">
          <Link href="/blog" className="hover:text-brand-700">
            ← Blog
          </Link>
        </div>

        <p className="mt-6 text-xs font-semibold uppercase tracking-wider text-brand-600">
          {formatDate(post.date)} · {post.readMinutes} min read
        </p>
        <h1 className="mt-3 font-display text-4xl font-semibold leading-tight text-stone-ink sm:text-5xl">
          {post.title}
        </h1>
        <p className="mt-4 text-lg text-stone-muted">{post.description}</p>

        <div
          className="prose-content mt-8"
          dangerouslySetInnerHTML={{ __html: html }}
        />

        {post.tags.length > 0 && (
          <div className="mt-10 flex flex-wrap gap-2 border-t border-stone-line pt-6">
            {post.tags.map((t) => (
              <span
                key={t}
                className="rounded-full bg-stone-surface px-3 py-1 text-xs font-medium text-stone-muted"
              >
                {t}
              </span>
            ))}
          </div>
        )}

        {/* CTA */}
        <div className="topo mt-12 overflow-hidden rounded-3xl bg-brand-900 p-8 text-white">
          <h2 className="font-display text-2xl font-semibold">Ready to talk it through?</h2>
          <p className="mt-2 text-stone-100/80">
            We&apos;ll give you a straight answer on homes, land, and financing — no pressure.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 rounded-full bg-accent-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-accent-600"
            >
              Get started <ArrowIcon className="size-4" />
            </Link>
            <a
              href={`tel:${site.phoneDial}`}
              className="inline-flex items-center gap-2 rounded-full bg-white/10 px-5 py-2.5 text-sm font-semibold text-white ring-1 ring-white/20 transition hover:bg-white/15"
            >
              <PhoneIcon className="size-4" /> {site.phoneDisplay}
            </a>
          </div>
        </div>
      </article>

      {more.length > 0 && (
        <section className="container-x max-w-3xl pb-16">
          <h2 className="font-display text-xl font-semibold text-stone-ink">Keep reading</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {more.map((p) => (
              <Link
                key={p.slug}
                href={`/blog/${p.slug}`}
                className="rounded-card border border-stone-line bg-stone-bg p-5 transition hover:border-brand-300"
              >
                <h3 className="font-display text-lg font-semibold text-stone-ink">{p.title}</h3>
                <p className="mt-1.5 line-clamp-2 text-sm text-stone-muted">{p.description}</p>
              </Link>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
