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

export function getAllPosts(): Post[] {
  if (!cache) {
    const posts = postsJson as unknown as Post[];
    cache = [...posts].sort((a, b) => b.date.localeCompare(a.date));
  }
  return cache;
}

export function getPost(slug: string): Post | undefined {
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
