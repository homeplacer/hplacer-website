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

export type BlogTopic =
  | "Buying & pricing"
  | "Financing"
  | "Land & locations"
  | "Home comparisons";

export const blogTopics: Array<{
  name: BlogTopic;
  description: string;
}> = [
  {
    name: "Buying & pricing",
    description: "Costs, timelines, warranties, and the decisions that shape a complete package.",
  },
  {
    name: "Financing",
    description: "Down payments, loan paths, credit questions, and what to ask before you apply.",
  },
  {
    name: "Land & locations",
    description: "Lots, utilities, zoning, septic, and the local areas we serve.",
  },
  {
    name: "Home comparisons",
    description: "Brands, floor plans, construction, and choosing the right home for your land.",
  },
];

const financingTags = new Set([
  "financing",
  "fha loan",
  "va loan",
  "conventional loan",
  "usda",
  "zero-down",
  "credit",
  "manufactured home financing",
  "down payment",
  "property taxes",
  "insurance",
]);

const landTags = new Set([
  "land",
  "land buying",
  "zoning",
  "septic",
  "wells",
  "site prep",
  "conway",
  "loris",
  "longs",
  "aynor",
  "grand strand",
  "family-land",
  "heirs-property",
]);

const comparisonTags = new Set([
  "clayton homes",
  "cavco",
  "champion homes",
  "single-wide",
  "double-wide",
  "modular homes",
  "mobile homes",
  "hud code",
  "home lifespan",
  "energy efficient",
  "new vs used",
]);

export function getBlogTopic(post: Pick<Post, "tags">): BlogTopic {
  const tags = new Set(post.tags.map((tag) => tag.toLowerCase()));
  if ([...tags].some((tag) => financingTags.has(tag))) return "Financing";
  if ([...tags].some((tag) => landTags.has(tag))) return "Land & locations";
  if ([...tags].some((tag) => comparisonTags.has(tag))) return "Home comparisons";
  return "Buying & pricing";
}

// Statically imported so posts bundle into the server build (no runtime fs on
// the Cloudflare Workers runtime).
let cache: Post[] | null = null;

// Scheduled publishing: a post with a FUTURE `date` stays hidden until that day
// arrives. Evaluated at BUILD time (today = the deploy date), so a scheduled
// redeploy surfaces newly-due posts. Lets us queue a content calendar and drip
// it out at a steady cadence instead of dumping everything at once.
const TODAY = new Date().toISOString().slice(0, 10);

// The public package floor is a live business fact, not an editorial estimate.
// Older first-party posts were drafted when it was described as "low $200s";
// normalize that wording at the content boundary so every published article
// stays truthful after the confirmed $179,999 package became available.
function normalizeCurrentPackagePrice(text: string): string {
  return text
    .replaceAll("from the low $200s", "from $179,999")
    .replaceAll("in the low $200s", "at $179,999")
    .replaceAll("low-to-mid $200s", "$179,999 and up")
    .replaceAll("low $200s", "$179,999");
}

// All posts incl. future-dated queue entries. Tooling only — never user-facing.
export function getScheduledPosts(): Post[] {
  if (!cache) {
    const posts = postsJson as unknown as Post[];
    cache = posts
      .map((post) => ({
        ...post,
        description: normalizeCurrentPackagePrice(post.description),
        bodyMarkdown: normalizeCurrentPackagePrice(post.bodyMarkdown),
      }))
      .sort((a, b) => b.date.localeCompare(a.date));
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

export function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}
