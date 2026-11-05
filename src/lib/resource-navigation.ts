// Deliberate destinations, not array slices: inserting a resource elsewhere
// must not silently remove a buyer's way into the blog or project archive.
export const footerResourceHrefs = [
  "/packages",
  "/guides",
  "/stories",
  "/buyer-resources",
  "/gallery",
  "/process",
  "/warranty",
  "/faq",
  "/blog",
] as const;

export const buyerLearningLinks = [
  {
    href: "/blog",
    label: "Home-buying blog",
    description: "Practical guides to pricing, financing, land, and choosing a home.",
  },
  {
    href: "/glossary",
    label: "Home-buying glossary",
    description: "Plain-language definitions for the terms you will encounter.",
  },
  {
    href: "/manufactured-vs-site-built",
    label: "Manufactured vs. site-built",
    description: "Compare how the homes are built and what to confirm for your project.",
  },
  {
    href: "/modular-vs-manufactured-homes",
    label: "Modular vs. manufactured",
    description: "Understand the different building standards and planning considerations.",
  },
  {
    href: "/mobile-home-vs-manufactured-home",
    label: "Mobile vs. manufactured",
    description: "Learn what these names mean when comparing homes.",
  },
] as const;
