// Client-safe article card data and topic helpers. Full article bodies and
// scheduled-post data stay in the server-side blog loader.
export interface PostSummary {
  slug: string;
  title: string;
  description: string;
  date: string;
  readMinutes: number;
  tags: string[];
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

export function getBlogTopic(post: Pick<PostSummary, "tags">): BlogTopic {
  const tags = new Set(post.tags.map((tag) => tag.toLowerCase()));
  if ([...tags].some((tag) => financingTags.has(tag))) return "Financing";
  if ([...tags].some((tag) => landTags.has(tag))) return "Land & locations";
  if ([...tags].some((tag) => comparisonTags.has(tag))) return "Home comparisons";
  return "Buying & pricing";
}

export function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}
