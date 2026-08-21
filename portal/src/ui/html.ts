/**
 * A very small HTML layer.
 *
 * Everything interpolated into `html` is escaped unless it is already a
 * `SafeHtml` value, so a caption typed by a crew member cannot become markup.
 * The portal renders on the server and posts plain forms — there is no client
 * framework and no client-side templating to keep in sync.
 */

export interface SafeHtml {
  readonly __safeHtml: string;
}

export function escapeHtml(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function raw(value: string): SafeHtml {
  return { __safeHtml: value };
}

function isSafe(value: unknown): value is SafeHtml {
  return typeof value === "object" && value !== null && "__safeHtml" in value;
}

function render(value: unknown): string {
  if (value === null || value === undefined || value === false) return "";
  if (isSafe(value)) return value.__safeHtml;
  if (Array.isArray(value)) return value.map(render).join("");
  return escapeHtml(value);
}

export function html(strings: TemplateStringsArray, ...values: unknown[]): SafeHtml {
  let out = strings[0];
  for (let i = 0; i < values.length; i += 1) out += render(values[i]) + strings[i + 1];
  return raw(out);
}

export function toString(value: SafeHtml): string {
  return value.__safeHtml;
}

/** `?a=1&b=2`, skipping empty values. */
export function query(params: Record<string, string | number | null | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined || value === "") continue;
    search.set(key, String(value));
  }
  const encoded = search.toString();
  return encoded ? `?${encoded}` : "";
}
