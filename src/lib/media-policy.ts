// Remote media is intentionally constrained to providers present in the
// checked-in catalog. New ingest origins should be reviewed before they are
// allowed by CSP or embedded in a customer-facing page.
export const catalogImageOrigins = [
  "https://api.claytonhomes.com",
  "https://prd-champion-homes.s3.amazonaws.com",
  "https://res.cloudinary.com",
  "https://d132mt2yijm03y.cloudfront.net",
  "https://cdn2.cavco.com",
  "https://s7d9.scene7.com",
  "https://www.cavcohomes.com",
] as const;

export const virtualTourOrigins = [
  "https://momento360.com",
  "https://my.matterport.com",
] as const;

const virtualTourOriginSet = new Set<string>(virtualTourOrigins);

export function trustedVirtualTourUrl(raw: string | undefined): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw.replaceAll("&#038;", "&"));
    return virtualTourOriginSet.has(url.origin) ? url.toString() : null;
  } catch {
    return null;
  }
}
