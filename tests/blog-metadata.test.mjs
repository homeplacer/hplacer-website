import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const posts = JSON.parse(readFileSync("data/blog-posts.json", "utf8"));
const source = readFileSync("src/lib/blog-metadata.ts", "utf8");
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
});
const { blogMetadataTitles, blogMetadataTitle } = await import(
  `data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`
);

test("every authored blog article has one distinct, concise metadata title", () => {
  assert.equal(posts.length, 37);
  assert.deepEqual(Object.keys(blogMetadataTitles).sort(), posts.map((post) => post.slug).sort());
  assert.equal(new Set(Object.values(blogMetadataTitles)).size, posts.length);
  for (const post of posts) {
    const title = blogMetadataTitle(post);
    assert.equal(title, blogMetadataTitles[post.slug]);
    assert.ok(title.trim().length > 0, post.slug);
    assert.ok(`${title} · Home Placer`.length <= 60, `${post.slug}: ${title}`);
    assert.doesNotMatch(title, /Home Placer|\.\.\.|…/, post.slug);
  }
  const layout = readFileSync("src/app/layout.tsx", "utf8");
  assert.match(layout, /template: `%s · \$\{site\.name\}`/);
});

test("metadata titles do not rewrite article records or use blanket financing claims", () => {
  const original = structuredClone(posts);
  for (const post of posts) blogMetadataTitle(post);
  assert.deepEqual(posts, original);
  assert.ok(Object.isFrozen(blogMetadataTitles));
  assert.equal(blogMetadataTitle({ slug: "future-guide", title: "Future article headline" }), "Future article headline");
  assert.equal(blogMetadataTitle({ slug: "constructor", title: "Another future headline" }), "Another future headline");
  assert.equal(blogMetadataTitle(posts.find((post) => post.slug === "usda-zero-down-manufactured-home-rural-horry-county")), "USDA Loans for Horry County Homes on Land");
  assert.doesNotMatch(Object.values(blogMetadataTitles).join("\n"), /guaranteed|approved|\$0[- ]down|no HOA/i);
});

test("blog pages use concise search/social metadata but retain full visible and schema headlines", () => {
  const page = readFileSync("src/app/blog/[slug]/page.tsx", "utf8");
  assert.match(page, /const seoTitle = blogMetadataTitle\(post\)/);
  assert.equal(page.match(/title: seoTitle/g)?.length, 2);
  assert.match(page, /description: post\.description/);
  assert.match(page, /canonical: `\/blog\/\$\{slug\}`/);
  assert.match(page, /<h1\b[^>]*>\s*\{post\.title\}\s*<\/h1>/);
  assert.match(page, /articleLd\(post\)/);
  assert.match(page, /name: post\.title, path: `\/blog\/\$\{post\.slug\}`/);
  assert.match(page, /renderMarkdown\(post\.bodyMarkdown\)/);
});
