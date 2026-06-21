// Turns the blog-writing workflow output into data/blog-posts.json.
import fs from "node:fs";

const SRC =
  process.argv[2] ||
  "/private/tmp/claude-501/-Users-spencer/8faff905-2d22-4296-8f1e-4ff656f03134/tasks/wjrbzr95b.output";

const raw = JSON.parse(fs.readFileSync(SRC, "utf8"));
const posts = raw.result?.posts || raw.posts || [];

// Space publish dates weekly (newest first) so the blog reads as established.
const dates = ["2026-06-21", "2026-06-14", "2026-06-07", "2026-05-31", "2026-05-24", "2026-05-17", "2026-05-10", "2026-05-03"];

const out = posts.map((p, i) => ({
  slug: p.slug,
  title: p.title,
  description: p.description,
  date: dates[i] || "2026-05-01",
  readMinutes: p.readMinutes || 5,
  tags: p.tags || [],
  bodyMarkdown: p.bodyMarkdown,
}));

fs.writeFileSync("data/blog-posts.json", JSON.stringify(out, null, 2));
console.log(`wrote data/blog-posts.json — ${out.length} posts`);
