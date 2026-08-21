/** Identifier and reference-number helpers. */

const ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz";

/**
 * Prefixed, sortable-ish identifier: `job_ltq3x9f2a4k1`. The leading
 * millisecond timestamp keeps rows created together adjacent in an index
 * without leaking a sequence the way an auto-increment id would.
 */
export function newId(prefix: string, now: Date = new Date()): string {
  const stamp = now.getTime().toString(36).padStart(9, "0");
  const random = crypto.getRandomValues(new Uint8Array(6));
  let suffix = "";
  for (const byte of random) suffix += ALPHABET[byte % ALPHABET.length];
  return `${prefix}_${stamp}${suffix}`;
}

/** ISO-8601 UTC, matching the `CURRENT_TIMESTAMP`-shaped columns in D1. */
export function nowIso(now: Date = new Date()): string {
  return now.toISOString().replace("T", " ").replace(/\.\d+Z$/, "");
}

export function todayIso(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/** `RT-2026-0143` — human-quotable on a phone call from the field. */
export function repairTicketNumber(sequence: number, now: Date = new Date()): string {
  return `RT-${now.getUTCFullYear()}-${String(sequence).padStart(4, "0")}`;
}

/**
 * Serial numbers and VINs arrive from data plates, dash tags, and typed input.
 * Canonicalise before comparing or storing so `2 1 4-A` and `214a` are one key.
 */
export function canonicalKey(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}
