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

  // Google Analytics 4 Measurement ID (GA4 property under carolina@hplacer.com).
  gaId: "G-0T71PWYQSQ",

  // CCAR Paragon "Collaboration Center" share link of Home Placer's homes.
  // Swap to an active-inventory collab link when one is available; a true
  // on-page listing feed needs a CCAR IDX/RESO data feed.
  mlsCollabUrl: "https://zsvc.paragon.ice.com/s/goto/KZzKDmEi-e_",

  // Real Google Business Profile (CID 3461988553332431879).
  gbp: {
    url: "https://maps.google.com/?cid=3461988553332431879",
    rating: 5.0,
    reviewCount: 7,
  },
  sameAs: ["https://maps.google.com/?cid=3461988553332431879"],

  // Sister company — Joe's Grand Strand real estate team (KW). We send buyers who
  // need to find LAND (or any existing home) to their live MLS search so we keep
  // them in-house instead of losing them to Zillow. The Ylopo search captures the
  // lead on the other side; UTMs tag the referral so attribution is clean.
  forturro: {
    name: "The Forturro Group",
    url: "https://forturro.com",
    searchUrl:
      "https://search.forturro.com/?utm_source=hplacer&utm_medium=referral&utm_campaign=cross-site",
    // Deep-linked, land-only, Horry County (Ylopo property-type = land).
    landSearchUrl:
      "https://search.forturro.com/search/map?s[orderBy]=sourceCreationDate%2Cdesc&s[page]=1&s[locations][0][county]=Horry&s[locations][0][state]=SC&s[propertyTypes][0]=land&utm_source=hplacer&utm_medium=referral&utm_campaign=land-search",
    // Home Placer's own available-inventory page, hosted on Forturro. No
    // tracking params yet (2026-07-13 — add later if attribution is needed).
    availableHomesUrl: "https://forturro.com/home-placer",
  },

  // Cities where Home Placer places homes on land.
  // A representative spread across the four-county service area (Horry +
  // Georgetown SC, Brunswick + Columbus NC) for the footer / homepage. The full
  // list of 27 town pages lives in lib/locations.
  locations: [
    { slug: "myrtle-beach", name: "Myrtle Beach" },
    { slug: "conway", name: "Conway" },
    { slug: "north-myrtle-beach", name: "North Myrtle Beach" },
    { slug: "georgetown", name: "Georgetown" },
    { slug: "pawleys-island", name: "Pawleys Island" },
    { slug: "leland", name: "Leland" },
    { slug: "shallotte", name: "Shallotte" },
    { slug: "southport", name: "Southport" },
    { slug: "calabash", name: "Calabash" },
    { slug: "whiteville", name: "Whiteville" },
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
  { href: "/recently-placed", label: "Recently Placed" },
  { href: "/financing", label: "Financing" },
  { href: "/warranty", label: "Warranty" },
  { href: "/about", label: "About" },
  { href: "/team", label: "Team" },
  { href: "/contact", label: "Contact" },
] as const;

export const resourceLinks = [
  { href: "/gallery", label: "Photo Gallery" },
  { href: "/process", label: "How It Works" },
  { href: "/warranty", label: "Warranty" },
  { href: "/faq", label: "FAQ" },
  { href: "/blog", label: "Blog" },
  { href: "/team", label: "Meet the Team" },
  { href: "/glossary", label: "Glossary" },
  { href: "/manufactured-vs-site-built", label: "Manufactured vs. Site-Built" },
  { href: "/modular-vs-manufactured-homes", label: "Modular vs. Manufactured" },
  { href: "/mobile-home-vs-manufactured-home", label: "Mobile vs. Manufactured" },
  { href: "/manufactured-home-drywall-vs-wall-strips", label: "Drywall vs. Wall Strips" },
  { href: "/locations", label: "Where We Build" },
] as const;

// For existing homeowners.
export const homeownerLinks = [
  { href: "/service-request", label: "Request Service" },
] as const;

// Social accounts. `live: true` ones render in the footer and feed the SEO
// schema (sameAs). Flip a flag to true the moment that account goes live.
// Instagram @homeplacer is the real, branded brand account (verified live).
export const socialLinks = [
  {
    key: "instagram",
    label: "Instagram",
    handle: "@homeplacer",
    url: "https://www.instagram.com/homeplacer",
    live: true,
  },
  {
    key: "tiktok",
    label: "TikTok",
    handle: "@homeplacer",
    url: "https://www.tiktok.com/@homeplacer",
    live: false,
  },
  {
    key: "facebook",
    label: "Facebook",
    handle: "Home Placer",
    url: "https://www.facebook.com/homeplacer",
    live: false,
  },
] as const;

// Live social URLs, for JSON-LD sameAs (search engines verifying the brand).
export const liveSocialUrls = socialLinks.filter((s) => s.live).map((s) => s.url);
