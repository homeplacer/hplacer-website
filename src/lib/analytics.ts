// Client-side GA4 event helper. No-ops safely when gtag isn't present (GA off,
// blocked by an ad blocker, or during SSR) so callers never need to guard.

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

export function track(event: string, params?: Record<string, unknown>): void {
  if (typeof window !== "undefined" && typeof window.gtag === "function") {
    window.gtag("event", event, params ?? {});
  }
}
