// Real Google reviews for Home Placer (Google Business Profile, CID
// 3461988553332431879 — 5.0★, 7 reviews). Verbatim text, attributed.
// These are surfaced on the homepage and fed into the LocalBusiness JSON-LD.
// Only add reviews that are genuinely on the GBP — never invent testimonials.

export interface Review {
  author: string;
  text: string;
  rating: number; // out of 5
  source: "Google";
}

export const reviews: Review[] = [
  {
    author: "Terry Yannick",
    text: "Had an incredible experience with Home Placer. They were super knowledgeable about real estate in Myrtle Beach. They helped me find a home for my family in the perfect neighborhood. No stress. Can't ask for better.",
    rating: 5,
    source: "Google",
  },
  {
    author: "Chris Garavito",
    text: "Fantastic customer service, will go over and above for his clients. First class all the way!",
    rating: 5,
    source: "Google",
  },
  {
    author: "Jordan Richardson",
    text: "Great people. Highly recommend.",
    rating: 5,
    source: "Google",
  },
];
