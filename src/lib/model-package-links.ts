// A filtered archive is useful only when a published record exists. Callers
// pass getPackages(), not raw source records or the live MLS availability feed.
export function modelPackageHref(
  modelSlug: string,
  publishedRecords: readonly { modelSlug: string }[],
): string | null {
  return publishedRecords.some((record) => record.modelSlug === modelSlug)
    ? `/packages?model=${encodeURIComponent(modelSlug)}`
    : null;
}
