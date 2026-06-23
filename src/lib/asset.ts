// Prefix local asset paths with the deploy base path (set only for the
// GitHub Pages static export via NEXT_PUBLIC_BASE_PATH). Leaves remote URLs
// and already-prefixed paths untouched. No-op on Vercel/dev (base = "").
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export function asset(p?: string | null): string {
  if (!p) return "";
  if (/^(https?:)?\/\//.test(p) || p.startsWith("data:")) return p;
  if (BASE_PATH && p.startsWith(BASE_PATH + "/")) return p;
  return BASE_PATH + p;
}
