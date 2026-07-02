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

// Defense-in-depth: blog HTML comes from first-party markdown (committed JSON),
// but strip anything that could execute if a post ever carries raw HTML — scripts,
// embeds, inline event handlers, and javascript:/data:text/html URIs. A CSP
// backstops this. workerd has no DOM, so this is a regex strip, not DOMPurify;
// if untrusted authors are ever added, move to a proper sanitizer.
function sanitizeHtml(html: string): string {
  return html
    .replace(/<(script|style|iframe|object|embed|link|meta|base)\b[^>]*>[\s\S]*?<\/\1>/gi, "")
    .replace(/<(script|style|iframe|object|embed|link|meta|base)\b[^>]*\/?>/gi, "")
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/\s(href|src)\s*=\s*("|')?\s*(?:javascript|vbscript|data:text\/html)[^"'>\s]*/gi, ' $1="#"');
}

export function renderMarkdown(md: string): string {
  return sanitizeHtml(marked.parse(md, { async: false }) as string);
}

export function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}
