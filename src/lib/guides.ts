import data from "../../data/land-readiness-guides.json";
export const guides = data.guides;
export function getGuide(slug: string) {
  return guides.find((g) => g.slug === slug);
}
