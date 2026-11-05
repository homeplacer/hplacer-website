import type { PostSummary } from "./blog-summary";

// Search and social titles are concise editorial labels, not replacements for
// the authored article headlines. Keep the full headline in the page and schema.
// Titles leave room for the root layout's " · Home Placer" suffix.
export const blogMetadataTitles: Readonly<Record<string, string>> = Object.freeze({
  "manufactured-home-land-package-cost-horry-county": "Horry County Land-and-Home Package Costs",
  "fha-va-conventional-financing-manufactured-homes-sc": "FHA, VA & Conventional Home Loans in SC",
  "clayton-cavco-champion-brand-comparison": "Clayton, Cavco & Champion Home Comparison",
  "manufactured-modular-mobile-home-difference": "Manufactured vs. Modular vs. Mobile Homes",
  "buying-land-for-manufactured-home-grand-strand": "Buying Land for a Home on the Grand Strand",
  "do-manufactured-homes-hold-value": "Do Manufactured Homes Hold Their Value?",
  "usda-zero-down-manufactured-home-rural-horry-county": "USDA Loans for Horry County Homes on Land",
  "new-home-warranty-coverage-explained": "New Home Warranty Coverage Explained",
  "single-wide-vs-double-wide-manufactured-home": "Single-Wide vs. Double-Wide Homes",
  "manufactured-home-on-land-timeline-horry-county": "Home-on-Land Timeline in Horry County",
  "buying-manufactured-home-credit-not-perfect": "Buying a Manufactured Home with Credit Issues",
  "where-to-place-your-home-conway-loris-longs-aynor": "Land for Homes: Conway, Loris, Longs & Aynor",
  "owned-land-vs-leased-land-manufactured-home": "Owned vs. Leased Land for Manufactured Homes",
  "manufactured-home-real-property-vs-personal-property-sc": "Manufactured Homes: Personal vs. Real Property",
  "new-construction-homes-under-250k-myrtle-beach": "New Homes Under $250K near Myrtle Beach",
  "manufactured-home-hurricane-wind-zone-2-sc": "Manufactured Homes & Hurricane Wind Zones",
  "horry-county-manufactured-home-zoning-setbacks-septic": "Horry County Home Zoning, Setbacks & Septic",
  "manufactured-home-on-family-land-conway-aynor": "Manufactured Homes on Family Land in SC",
  "manufactured-home-insurance-cost-grand-strand-sc": "Manufactured Home Insurance Costs in SC",
  "do-manufactured-homes-on-permanent-foundations-appreciate": "Manufactured Homes: Foundations & Appreciation",
  "biggest-mistakes-buying-a-manufactured-home": "Manufactured Home Buying Mistakes to Avoid",
  "why-you-might-not-want-manufactured-home-sc": "Disadvantages of Manufactured Homes in SC",
  "affordable-retirement-homes-grand-strand-no-hoa": "Grand Strand Retirement Homes & HOA Choices",
  "real-sc-land-home-package-case-study": "Recent SC Land-and-Home Package Examples",
  "manufactured-home-site-prep-horry-county": "Horry County Site Prep for Manufactured Homes",
  "septic-perc-test-well-rural-land-sc": "Septic, Perc Tests & Wells in Horry County",
  "manufactured-home-down-payment-requirements": "Down Payments for Manufactured Homes on Land",
  "manufactured-home-property-taxes-south-carolina": "SC Manufactured Home Property Taxes",
  "new-vs-used-manufactured-home-on-land": "New vs. Used Manufactured Homes on Land",
  "how-long-do-new-manufactured-homes-last": "How Long Do Manufactured Homes Last?",
  "build-equity-manufactured-home-owned-land": "Can a Manufactured Home Build Equity?",
  "energy-efficient-new-manufactured-homes": "Energy-Efficient New Manufactured Homes",
  "buying-a-manufactured-home-in-conway-sc": "Buying a Manufactured Home in Conway, SC",
  "manufactured-homes-loris-longs-affordable-inland-sc": "Manufactured Homes in Loris & Longs, SC",
  "questions-to-ask-before-buying-manufactured-home": "Manufactured Home Buyer Questions & Checklist",
  "move-in-ready-vs-build-to-order-manufactured-home": "Move-In Ready vs. Build-to-Order Homes",
  "do-i-need-real-estate-agent-manufactured-home-land-package-sc": "Do Land-and-Home Buyers Need an Agent in SC?",
});

export function blogMetadataTitle(post: Pick<PostSummary, "slug" | "title">): string {
  // A future article still gets its authored title until its concise label is
  // added. Tests require every catalog entry to have an explicit label.
  return Object.hasOwn(blogMetadataTitles, post.slug)
    ? blogMetadataTitles[post.slug]
    : post.title;
}
