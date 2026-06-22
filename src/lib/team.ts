// Home Placer team — from the company org chart.
// "Laborer/Labor" roles are presented as "Site Work" (Joe's call).
// Ashley Love (CFO) is intentionally not listed on the public site.
// Photos in public/team/ (uniform 4:5 crop). People without a photo show initials.
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

// Whole-crew shot outside the office (1801 N Oak St).
export const groupPhoto = "/team/team-group.jpg";

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
      { name: "Greg Distefano", title: "Head of Site Work", photo: "/team/greg-distefano.jpg" },
      { name: "Wade Pratt", title: "Head of Service", photo: "/team/wade-pratt.jpg" },
      { name: "Andrew Lemieux", title: "Head of Transport", photo: "/team/andrew-lemieux.jpg" },
      { name: "Brandon Angelo", title: "Lead Mechanic & Maintenance", photo: "/team/brandon-angelo.jpg" },
    ],
  },
  {
    label: "Carpentry",
    members: [
      { name: "Scott Choma", title: "Carpenter", photo: "/team/scott-choma.jpg" },
      { name: "Sam Cliffton", title: "Carpenter" },
      { name: "Kadin Prestly", title: "Carpenter", photo: "/team/kadin-prestly.jpg" },
    ],
  },
  {
    label: "Site Work",
    members: [
      { name: "Hunter Martin", title: "Site Work", photo: "/team/hunter-martin.jpg" },
      { name: "Devin Prestly", title: "Site Work", photo: "/team/devin-prestly.jpg" },
      { name: "Jonah Stiffler", title: "Site Work", photo: "/team/jonah-stiffler.jpg" },
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
