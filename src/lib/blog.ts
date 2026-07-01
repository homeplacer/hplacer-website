import { marked } from "marked";
import postsJson from "../../data/blog-posts.json";

export interface Post {
  slug: string;
  title: string;
  description: string;
  date: string; // ISO yyyy-mm-dd
  readMinutes: number;
  tags: string[];
  bodyMarkdown: string;
}

// Statically imported so posts bundle into the server build (no runtime fs on
// the Cloudflare Workers runtime).
let cache: Post[] | null = null;

// Scheduled publishing: a post with a FUTURE `date` stays hidden until that day
// arrives. Evaluated at BUILD time (today = the deploy date), so a scheduled
// redeploy surfaces newly-due posts. Lets us queue a content calendar and drip
// it out at a steady cadence instead of dumping everything at once.
const TODAY = new Date().toISOString().slice(0, 10);

// All posts incl. future-dated queue entries. Tooling only — never user-facing.
export function getScheduledPosts(): Post[] {
  if (!cache) {
    const posts = postsJson as unknown as Post[];
    cache = [...posts].sort((a, b) => b.date.localeCompare(a.date));
  }
  return cache;
}

export function getAllPosts(): Post[] {
  return getScheduledPosts().filter((p) => p.date <= TODAY);
}

export function getPost(slug: string): Post | undefined {
  // Only resolve published posts — a queued (future) post 404s until its date.
  return getAllPosts().find((p) => p.slug === slug);
}

export function renderMarkdown(md: string): string {
  return marked.parse(md, { async: false }) as string;
}

export function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}
