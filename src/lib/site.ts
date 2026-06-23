// Single source of truth for business facts. Pulled from the real
// Home Placer profile (Zillow builder feed + Google Business Profile).

export const site = {
  name: "Home Placer",
  legalName: "Home Placer LLC",
  domain: "hplacer.com",
  url: "https://hplacer.com",
  tagline: "New homes, on land, from the low $200s.",
  blurb:
    "Horry County's licensed land + home dealer. We pair brand-new Clayton, Cavco, and Champion manufactured homes with land across the Grand Strand — one package, one team, no HOA.",

  phoneDisplay: "(843) 849-HOME",
  phoneDial: "+18438494663",
  phoneSpoken: "843-849-4663",
  email: "Carolina@hplacer.com",

  // Existing homeowners — warranty / service line (separate from sales).
  warrantyPhoneDisplay: "(843) 484-9844",
  warrantyPhoneDial: "+18434849844",

  address: {
    street: "1801 N Oak St",
    city: "Myrtle Beach",
    state: "SC",
    zip: "29577",
  },
  geo: { lat: 33.702366, lng: -78.877032 },
  hours: "By appointment",

  // Real Google Business Profile (CID 3461988553332431879).
  gbp: {
    url: "https://maps.google.com/?cid=3461988553332431879",
    rating: 5.0,
    reviewCount: 6,
  },
  sameAs: ["https://maps.google.com/?cid=3461988553332431879"],

  // Cities where Home Placer places homes on land.
  locations: [
    { slug: "myrtle-beach", name: "Myrtle Beach" },
    { slug: "conway", name: "Conway" },
    { slug: "loris", name: "Loris" },
    { slug: "longs", name: "Longs" },
    { slug: "aynor", name: "Aynor" },
  ],

  priceFrom: 219000,

  valueProps: [
    {
      title: "No HOA",
      body: "Own your land outright. No monthly association fees, no rules board.",
    },
    {
      title: "Land + home, bundled",
      body: "One package, one price, one closing — the home and the lot it sits on.",
    },
    {
      title: "1-year warranty",
      body: "A limited one-year warranty plus a 30-day walk-through after you move in.",
    },
    {
      title: "Licensed SC dealer",
      body: "A licensed Horry County dealer — not a broker passing you down the line.",
    },
  ],
} as const;

export const navLinks = [
  { href: "/homes", label: "Homes" },
  { href: "/brands", label: "Brands" },
  { href: "/land-packages", label: "Land Packages" },
  { href: "/gallery", label: "Our Work" },
  { href: "/financing", label: "Financing" },
  { href: "/warranty", label: "Warranty" },
  { href: "/about", label: "About" },
  { href: "/team", label: "Team" },
  { href: "/contact", label: "Contact" },
] as const;

export const resourceLinks = [
  { href: "/process", label: "How It Works" },
  { href: "/warranty", label: "Warranty" },
  { href: "/faq", label: "FAQ" },
  { href: "/blog", label: "Blog" },
  { href: "/team", label: "Meet the Team" },
  { href: "/glossary", label: "Glossary" },
  { href: "/manufactured-vs-site-built", label: "Manufactured vs. Site-Built" },
  { href: "/locations", label: "Where We Build" },
] as const;

// For existing homeowners.
export const homeownerLinks = [
  { href: "/service-request", label: "Request Service" },
] as const;
