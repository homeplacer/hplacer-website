import { marked } from "marked";
import postsJson from "../../data/blog-posts.json";
import { getBlogTopic, type PostSummary } from "./blog-summary";
export { blogTopics, getBlogTopic, formatDate, type BlogTopic } from "./blog-summary";

export interface Post extends PostSummary {
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
    // Editorial history is not live inventory. Preserve the authored sale
    // examples; articles point to current listings/estimates for today's prices.
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

export function getRelatedPosts(post: Post, limit = 2): Post[] {
  const postTags = new Set(post.tags.map((tag) => tag.toLowerCase()));
  const topic = getBlogTopic(post);

  return getAllPosts()
    .filter((candidate) => candidate.slug !== post.slug)
    .map((candidate) => {
      const sharedTags = candidate.tags.filter((tag) => postTags.has(tag.toLowerCase())).length;
      const sharedTopic = getBlogTopic(candidate) === topic ? 1 : 0;
      return { candidate, score: sharedTags * 2 + sharedTopic };
    })
    .sort((a, b) => b.score - a.score || b.candidate.date.localeCompare(a.candidate.date))
    .slice(0, limit)
    .map(({ candidate }) => candidate);
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
