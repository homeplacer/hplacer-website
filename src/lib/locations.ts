// Local copy for the city landing pages. Keep it specific and honest — these
// pages exist to rank for "manufactured homes in <city> SC" and to show buyers
// we actually place homes there.

export interface LocationInfo {
  slug: string;
  name: string;
  county: string;
  zip?: string;
  headline: string;
  intro: string;
  paragraphs: string[];
  highlights: string[];
}

export const locations: LocationInfo[] = [
  {
    slug: "myrtle-beach",
    name: "Myrtle Beach",
    county: "Horry County",
    zip: "29577",
    headline: "New manufactured homes on land in Myrtle Beach, SC",
    intro:
      "Myrtle Beach is the heart of the Grand Strand — and you don't have to rent forever to live near it. Home Placer puts brand-new manufactured homes on land in and around Myrtle Beach, from the low $200s.",
    paragraphs: [
      "Beachside living usually comes with a beachside price tag. Our land-home packages change that: a new Clayton, Cavco, or Champion home set on its own lot, with no HOA and one simple price.",
      "We handle the whole thing — finding or using your land, permits, delivery, foundation, and utility hookups — so you get a move-in-ready home a short drive from the ocean without the coastal markup.",
    ],
    highlights: ["Minutes from the Grand Strand", "No HOA — own your land", "Packages from the low $200s"],
  },
  {
    slug: "conway",
    name: "Conway",
    county: "Horry County",
    zip: "29526",
    headline: "New manufactured homes on land in Conway, SC",
    intro:
      "Conway — the historic riverfront seat of Horry County — offers more land for your money just inland from the coast. Home Placer pairs new homes with lots across the Conway area.",
    paragraphs: [
      "If you want a bigger yard, mature trees, and a small-town feel while staying close to Myrtle Beach jobs and beaches, Conway is hard to beat. Scattered lots here mean your home isn't boxed into a subdivision.",
      "From single-section homes to spacious four-bedroom double-wides, we'll match you to a model, a Conway-area lot, and a payment that works — then set it up move-in ready.",
    ],
    highlights: ["More land, inland value", "Close to Coastal Carolina University", "Riverfront small-town charm"],
  },
  {
    slug: "loris",
    name: "Loris",
    county: "Horry County",
    zip: "29569",
    headline: "New manufactured homes on land in Loris, SC",
    intro:
      "Loris is small-town South Carolina at its best — quiet, friendly, and affordable. It's one of the best places on the Grand Strand to own a new home on real acreage.",
    paragraphs: [
      "Land goes further in Loris, which makes it ideal for a land-home package. Spread out, plant a garden, park the boat — all without an HOA telling you no.",
      "Home Placer carries homes that fit Loris life, from efficient single-wides to roomy family floor plans, and we handle the setup from permit to keys.",
    ],
    highlights: ["Affordable acreage", "Rural quiet, no HOA", "Easy reach to the coast and NC line"],
  },
  {
    slug: "longs",
    name: "Longs",
    county: "Horry County",
    zip: "29568",
    headline: "New manufactured homes on land in Longs, SC",
    intro:
      "Longs sits in fast-growing north Horry County, close to the North Carolina line and an easy drive to North Myrtle Beach. It's a smart spot to put down roots in a new home on land.",
    paragraphs: [
      "Buyers love Longs for its mix of newer growth and breathing room. You get newer infrastructure and quick beach access while still finding lots with space.",
      "We'll place a brand-new Clayton, Cavco, or Champion home on a Longs-area lot — bundled, set, and ready — so you skip the rent cycle and start building equity.",
    ],
    highlights: ["Growing north Horry community", "Minutes to North Myrtle Beach", "Room to spread out"],
  },
  {
    slug: "aynor",
    name: "Aynor",
    county: "Horry County",
    zip: "29511",
    headline: "New manufactured homes on land in Aynor, SC",
    intro:
      "Aynor is proud farm-country in western Horry County — wide-open land, friendly neighbors, and home of the Aynor Hoe-Down. If you want acreage and a true rural setting, this is your spot.",
    paragraphs: [
      "Aynor's larger lots make the land-home package shine: a new home, your own land, and no association fees, all for one price you can actually plan around.",
      "Whether you're bringing family land or buying a lot, Home Placer handles the permits, delivery, and setup, and gets you into a new home built for Carolina living.",
    ],
    highlights: ["True country acreage", "Tight-knit community", "Bring your own land or use ours"],
  },
];

export const cityGeo: Record<string, { lat: number; lng: number }> = {
  "myrtle-beach": { lat: 33.6891, lng: -78.8867 },
  conway: { lat: 33.836, lng: -79.0478 },
  loris: { lat: 34.0563, lng: -78.8903 },
  longs: { lat: 33.9174, lng: -78.7336 },
  aynor: { lat: 33.9985, lng: -79.1989 },
};

export function getLocation(slug: string): LocationInfo | undefined {
  return locations.find((l) => l.slug === slug);
}
