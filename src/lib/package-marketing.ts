/** A live inventory price must never fall back to an outdated marketing floor. */
export function currentPackageFloorLabel(prices: readonly number[]): string | null {
  const availablePrices = prices.filter((price) => Number.isFinite(price) && price > 0);
  if (!availablePrices.length) return null;

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Math.min(...availablePrices));
}
