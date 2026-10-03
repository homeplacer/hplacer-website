"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { ArrowIcon } from "@/components/icons";
import {
  blogTopics,
  formatDate,
  getBlogTopic,
  type BlogTopic,
  type PostSummary,
} from "@/lib/blog-summary";

export function BlogCollection({ posts }: { posts: PostSummary[] }) {
  const [selectedTopic, setSelectedTopic] = useState<BlogTopic | "All guides">("All guides");
  const headingRef = useRef<HTMLHeadingElement>(null);
  const visiblePosts = useMemo(
    () =>
      selectedTopic === "All guides"
        ? posts
        : posts.filter((post) => getBlogTopic(post) === selectedTopic),
    [posts, selectedTopic],
  );

  return (
    <section className="container-x py-14 sm:py-16" aria-labelledby="blog-guides-heading">
      <div className="rounded-[1.5rem] border border-stone-line bg-stone-surface p-6 sm:p-8">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-wider text-brand-600">Pick a starting point</p>
          <h2 className="mt-2 font-display text-3xl font-semibold text-stone-ink">Answers for the question in front of you</h2>
          <p className="mt-3 text-stone-muted">
            Choose a topic to skip the scrolling and get straight to the guides most useful for your next decision.
          </p>
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" role="group" aria-label="Guide topics">
          {blogTopics.map((topic) => {
            const count = posts.filter((post) => getBlogTopic(post) === topic.name).length;
            const selected = selectedTopic === topic.name;
            return (
              <button
                key={topic.name}
                type="button"
                onClick={() => setSelectedTopic(topic.name)}
                aria-pressed={selected}
                aria-controls="blog-guides-grid"
                className={`rounded-xl border p-4 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 ${selected ? "border-brand-700 bg-brand-700 text-white shadow-sm" : "border-stone-line bg-white text-stone-ink hover:border-brand-300 hover:bg-brand-50"}`}
              >
                <span className={`text-xs font-semibold uppercase tracking-wider ${selected ? "text-white/70" : "text-brand-600"}`}>
                  {count} guides
                </span>
                <span className="mt-1 block font-display text-xl font-semibold">{topic.name}</span>
                <span className={`mt-2 block text-sm leading-relaxed ${selected ? "text-white/80" : "text-stone-muted"}`}>
                  {topic.description}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-12 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-brand-600">Buyer library</p>
          <h2 ref={headingRef} id="blog-guides-heading" tabIndex={-1} className="mt-2 font-display text-3xl font-semibold text-stone-ink">
            {selectedTopic}
          </h2>
          <p className="mt-2 text-sm text-stone-muted" role="status">
            {visiblePosts.length} {visiblePosts.length === 1 ? "guide" : "guides"}
          </p>
        </div>
        {selectedTopic !== "All guides" && (
          <button
            type="button"
            onClick={() => {
              setSelectedTopic("All guides");
              headingRef.current?.focus({ preventScroll: true });
            }}
            className="text-sm font-semibold text-brand-700 underline-offset-4 hover:text-brand-900 hover:underline"
          >
            Show all {posts.length} guides
          </button>
        )}
      </div>

      <div id="blog-guides-grid" className="mt-7 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {visiblePosts.map((post) => {
          const topic = getBlogTopic(post);
          return (
            <Link
              key={post.slug}
              href={`/blog/${post.slug}`}
              className="group flex min-h-64 flex-col rounded-card border border-stone-line bg-stone-bg p-6 transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2"
            >
              <div className="flex items-center justify-between gap-3 text-xs font-semibold uppercase tracking-wider">
                <span className="text-brand-600">{topic}</span>
                <span className="shrink-0 text-stone-muted">{post.readMinutes} min read</span>
              </div>
              <h3 className="mt-3 font-display text-xl font-semibold leading-snug text-stone-ink group-hover:text-brand-800">
                {post.title}
              </h3>
              <p className="mt-3 flex-1 text-sm leading-relaxed text-stone-muted">{post.description}</p>
              <div className="mt-5 flex items-center justify-between gap-3 text-sm font-semibold text-brand-700">
                <span>{formatDate(post.date)}</span>
                <span className="inline-flex items-center gap-1.5">Read guide <ArrowIcon className="size-3.5" /></span>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
