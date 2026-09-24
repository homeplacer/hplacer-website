import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { canonicalTrackingUrl, parseVendorMail, safeAttachmentType } from "../src/integrations/gmail-parsing.ts";

describe("vendor mail parsing", () => {
  it("extracts a labeled order number and constructs a canonical UPS link", () => {
    const result = parseVendorMail(
      "Order confirmation # PO-48392 shipped",
      "Your UPS tracking number is 1Z999AA10123456784. Track at https://attacker.invalid/redirect",
    );
    assert.deepEqual(result, {
      kind: "shipment",
      orderNumber: "PO-48392",
      carrier: "UPS",
      trackingNumber: "1Z999AA10123456784",
      trackingUrl: "https://www.ups.com/track?tracknum=1Z999AA10123456784",
    });
    assert.equal(result.trackingUrl?.includes("attacker"), false);
  });

  it("does not make tracking links from unsupported carriers or malformed numbers", () => {
    const unknown = parseVendorMail("Your package shipped", "Track with Vendor X: ZX-44 at https://vendor.example/track/ZX-44");
    assert.equal(unknown.carrier, null);
    assert.equal(unknown.trackingUrl, null);
    assert.equal(canonicalTrackingUrl("FedEx", "not-a-number"), null);
  });

  it("accepts only known receipt document type and extension pairs", () => {
    assert.deepEqual(safeAttachmentType("application/pdf", "invoice.PDF"), { contentType: "application/pdf", extension: "pdf" });
    assert.equal(safeAttachmentType("text/html", "receipt.html"), null);
    assert.equal(safeAttachmentType("application/pdf", "invoice.exe"), null);
  });
});
