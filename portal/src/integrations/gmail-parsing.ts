/** Small, conservative parsers for vendor mail. Never trust URLs supplied by email. */

export type VendorMailKind = "order" | "receipt" | "shipment" | "unknown";
export type CarrierName = "UPS" | "FedEx" | "USPS" | "DHL";

export interface ParsedVendorMail {
  kind: VendorMailKind;
  orderNumber: string | null;
  carrier: CarrierName | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
}

const CARRIERS: { name: CarrierName; test: RegExp; tracking: RegExp; url: (number: string) => string }[] = [
  {
    name: "UPS",
    test: /\bUPS\b|ups\.com/i,
    tracking: /\b1Z[0-9A-Z]{16}\b/i,
    url: (number) => `https://www.ups.com/track?tracknum=${encodeURIComponent(number)}`,
  },
  {
    name: "FedEx",
    test: /Fed\s*Ex|fedex\.com/i,
    tracking: /\b(?:\d{12}|\d{15}|\d{20}|\d{22})\b/,
    url: (number) => `https://www.fedex.com/fedextrack/?trknbr=${encodeURIComponent(number)}`,
  },
  {
    name: "USPS",
    test: /USPS|United States Postal Service|usps\.com/i,
    tracking: /\b(?:9[2345]\d{18,22}|[A-Z]{2}\d{9}US)\b/i,
    url: (number) => `https://tools.usps.com/go/TrackConfirmAction?tLabels=${encodeURIComponent(number)}`,
  },
  {
    name: "DHL",
    test: /\bDHL\b|dhl\.com/i,
    tracking: /\b(?:JD\d{18}|\d{10,11})\b/i,
    url: (number) => `https://www.dhl.com/global-en/home/tracking.html?tracking-id=${encodeURIComponent(number)}`,
  },
];

export function parseVendorMail(subject: string, text: string): ParsedVendorMail {
  const source = `${subject}\n${text}`.slice(0, 120_000);
  const lower = source.toLowerCase();
  const kind: VendorMailKind =
    /\b(shipped|shipment|out for delivery|tracking update|tracking number|has shipped)\b/i.test(source)
      ? "shipment"
      : /\b(invoice|receipt|paid|payment received)\b/i.test(source)
        ? "receipt"
        : /\b(order confirmation|order confirmed|order placed|purchase order|order #|order number)\b/i.test(source)
          ? "order"
          : "unknown";

  const orderMatch = source.match(/\b(?:order\s+confirmation|purchase order|order|invoice|confirmation)\s*(?:number|no\.?|#|:)?\s*([A-Z0-9][A-Z0-9-]{3,29})\b/i);
  const orderNumber = orderMatch?.[1] ? normalizeOrderNumber(orderMatch[1]) : null;

  for (const carrier of CARRIERS) {
    if (!carrier.test.test(lower)) continue;
    const trackingNumber = source.match(carrier.tracking)?.[0]?.toUpperCase() ?? null;
    if (trackingNumber) {
      return { kind, orderNumber, carrier: carrier.name, trackingNumber, trackingUrl: carrier.url(trackingNumber) };
    }
    // Carrier is known, but an absent or malformed number never creates a URL.
    return { kind, orderNumber, carrier: carrier.name, trackingNumber: null, trackingUrl: null };
  }
  return { kind, orderNumber, carrier: null, trackingNumber: null, trackingUrl: null };
}

export function normalizeOrderNumber(value: string): string | null {
  const normalized = value.trim().toUpperCase().replace(/\s+/g, "");
  return /^[A-Z0-9][A-Z0-9-]{3,29}$/.test(normalized) ? normalized : null;
}

export function canonicalTrackingUrl(carrier: CarrierName, value: string): string | null {
  const trimmed = value.trim().toUpperCase().replace(/[\s-]/g, "");
  const definition = CARRIERS.find((candidate) => candidate.name === carrier);
  if (!definition || !definition.tracking.test(trimmed)) return null;
  return definition.url(trimmed);
}

export interface SafeAttachmentType {
  contentType: "application/pdf" | "image/jpeg" | "image/png" | "image/heic";
  extension: "pdf" | "jpg" | "png" | "heic";
}

export function safeAttachmentType(contentType: string, filename: string): SafeAttachmentType | null {
  const type = contentType.split(";")[0]?.trim().toLowerCase();
  const extension = filename.toLowerCase().split(".").pop();
  const known: Record<string, SafeAttachmentType> = {
    "application/pdf:pdf": { contentType: "application/pdf", extension: "pdf" },
    "image/jpeg:jpg": { contentType: "image/jpeg", extension: "jpg" },
    "image/jpeg:jpeg": { contentType: "image/jpeg", extension: "jpg" },
    "image/png:png": { contentType: "image/png", extension: "png" },
    "image/heic:heic": { contentType: "image/heic", extension: "heic" },
  };
  return known[`${type}:${extension}`] ?? null;
}
