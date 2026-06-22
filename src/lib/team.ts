// Home Placer team. DRAFT — names/roles/photos to be confirmed by Joe.
// Add a `photo` path (in public/team/) to replace the initials avatar.
export interface TeamMember {
  name: string;
  role: string;
  blurb?: string;
  email?: string;
  photo?: string;
}

export const team: TeamMember[] = [
  {
    name: "Joe Scaturro",
    role: "Owner & Broker",
    blurb:
      "Founded Home Placer to make a brand-new home on your own land genuinely affordable in Horry County — handled start to finish, the honest way.",
  },
  {
    name: "Carolina",
    role: "Sales Specialist",
    blurb: "Helps buyers match a home, a lot, and a payment that actually works — no pressure.",
    email: "Carolina@hplacer.com",
  },
  {
    name: "Tara",
    role: "Client Care Coordinator",
    blurb: "Keeps your purchase moving — paperwork, scheduling, and answers when you need them.",
  },
  {
    name: "Brett",
    role: "Service & Warranty",
    blurb: "Handles setup, the 30-day walk-through, and anything you need after you move in.",
  },
];

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}
