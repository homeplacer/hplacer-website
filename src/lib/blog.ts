import fs from "node:fs";
import path from "node:path";
import { marked } from "marked";

export interface Post {
  slug: string;
  title: string;
  description: string;
  date: string; // ISO yyyy-mm-dd
  readMinutes: number;
  tags: string[];
  bodyMarkdown: string;
}

const FILE = path.join(process.cwd(), "data", "blog-posts.json");

let cache: Post[] | null = null;

export function getAllPosts(): Post[] {
  if (!cache) {
    const posts = JSON.parse(fs.readFileSync(FILE, "utf8")) as Post[];
    cache = posts.sort((a, b) => b.date.localeCompare(a.date));
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
