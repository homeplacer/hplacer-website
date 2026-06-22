// Home Placer team — from the company org chart.
// "Laborer/Labor" roles are presented as "Site Work" (Joe's call).
// Ashley Love (CFO) is intentionally not listed on the public site.
// Add a `photo` path (in public/team/) to replace the initials avatar.
export interface TeamMember {
  name: string;
  title: string;
  blurb?: string;
  email?: string;
  photo?: string;
}

export interface TeamGroup {
  label: string;
  members: TeamMember[];
}

export const teamGroups: TeamGroup[] = [
  {
    label: "Leadership",
    members: [
      {
        name: "Joe Scaturro",
        title: "Owner & Founder",
        blurb:
          "Founded Home Placer to make a brand-new home on your own land genuinely affordable in Horry County — handled start to finish, the honest way.",
      },
      {
        name: "Tara Dufour",
        title: "Operations Manager",
        blurb: "Keeps every project — and every customer — moving from first call to move-in day.",
      },
    ],
  },
  {
    label: "Project Management",
    members: [
      {
        name: "Brett Chester",
        title: "Project Manager",
        blurb: "Runs each build on the ground — land prep, the set, and the finish work.",
      },
    ],
  },
  {
    label: "Field Leads",
    members: [
      { name: "Greg Distefano", title: "Head of Site Work" },
      { name: "Brandon Angelo", title: "Lead Mechanic & Maintenance" },
      { name: "Wade Pratt", title: "Lead Site Work" },
    ],
  },
  {
    label: "Carpentry",
    members: [
      { name: "Scott Choma", title: "Carpenter" },
      { name: "Sam Cliffton", title: "Carpenter" },
      { name: "Kadin Prestly", title: "Carpenter" },
    ],
  },
  {
    label: "Site Work",
    members: [
      { name: "Hunter Martin", title: "Site Work" },
      { name: "Devin Prestly", title: "Site Work" },
      { name: "Jonah Stiffler", title: "Site Work" },
    ],
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
