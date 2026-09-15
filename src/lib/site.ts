import identity from "../../data/business-identity.json";
// Single source of truth for business facts. Pulled from the real
// Home Placer profile (Zillow builder feed + Google Business Profile).

export const site = {
  name: identity.publicName,
  legalName: identity.legalName,
  domain: "hplacer.com",
  url: identity.url,
  tagline: "New homes, on land, from $184,999.",
  blurb:
    "Horry County's licensed land + home dealer. We pair brand-new Clayton, Cavco, and Champion manufactured homes with land across the Grand Strand — one package, one team, no HOA.",

  phoneDisplay: "(843) 849-HOME",
  phoneDial: identity.phone,
  phoneSpoken: "843-849-4663",
  email: identity.email,

  // Existing homeowners — warranty / service line (separate from sales).
  warrantyPhoneDisplay: "(843) 484-9844",
  warrantyPhoneDial: "+18434849844",

  address: identity.address,
  geo: identity.geo,
  hours: identity.hoursLabel,
  openingHours: identity.verifiedOpeningHours,

  // Google Analytics 4 Measurement ID (GA4 property under carolina@hplacer.com).
  gaId: "G-0T71PWYQSQ",

  // CCAR Paragon "Collaboration Center" share link of Home Placer's homes.
  // Swap to an active-inventory collab link when one is available; a true
  // on-page listing feed needs a CCAR IDX/RESO data feed.
  mlsCollabUrl: "https://zsvc.paragon.ice.com/s/goto/KZzKDmEi-e_",

  // Real Google Business Profile (CID 3461988553332431879).
  gbp: {
    url: identity.profiles.google,
    rating: 5.0,
    reviewCount: 8,
  },
  sameAs: [identity.profiles.google],

  // Sister company — Home Placer hands buyers who still need land to the new
  // Forturro website. Keep this to the primary Forturro domain: no legacy
  // search-domain handoff is used anywhere on the public site.
  forturro: {
    name: "The Forturro Group",
    url: "https://forturro.com",
    searchUrl: "/find-land",
    landSearchUrl: "/find-land",
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

  // Current all-in land-home package floor: 105 Pepe Court, Conway, SC.
  // Listing availability and the final scope remain subject to confirmation.
  priceFrom: 184999,

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
      title: "Builder + 2–10 warranties",
      body: "Home Placer provides a one-year builder warranty for defects. The separate 2–10 Home Buyers Warranty provides two years of mechanical coverage and ten years of structural coverage through the 2–10 company. A 30-day walk-through is also provided.",
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
  { href: "/careers", label: "Career Opportunities" },
  { href: "/contact", label: "Contact" },
] as const;

export const resourceLinks = [
  { href: "/packages", label: "Package Records" },
  { href: "/guides", label: "Land-readiness Checklists" },
  { href: "/stories", label: "Project Experience" },
  { href: "/buyer-resources", label: "Official Buyer Resources" },
  { href: "/gallery", label: "Photo Gallery" },
  { href: "/process", label: "How It Works" },
  { href: "/warranty", label: "Warranty" },
  { href: "/faq", label: "FAQ" },
  { href: "/blog", label: "Blog" },
  { href: "/team", label: "Meet the Team" },
  { href: "/careers", label: "Career Opportunities" },
  { href: "/glossary", label: "Glossary" },
  { href: "/manufactured-vs-site-built", label: "Manufactured vs. Site-Built" },
  { href: "/modular-vs-manufactured-homes", label: "Modular vs. Manufactured" },
  {
    href: "/mobile-home-vs-manufactured-home",
    label: "Mobile vs. Manufactured",
  },
  {
    href: "/manufactured-home-drywall-vs-wall-strips",
    label: "Drywall vs. Wall Strips",
  },
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
    url: identity.profiles.instagram,
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
export const liveSocialUrls = socialLinks
  .filter((s) => s.live)
  .map((s) => s.url);
