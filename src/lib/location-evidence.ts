import data from "../../data/location-evidence.json";
export function locationEvidence(slug: string) {
  return (
    data as Record<
      string,
      {
        market: string;
        publicProjectCount: number;
        source: string;
        sourceCheckedAt: string;
        guide: string;
      }
    >
  )[slug];
}
