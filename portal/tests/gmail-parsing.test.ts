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
  it("rejects tracking substrings and ordinary order prose as identifiers", () => {
    assert.equal(canonicalTrackingUrl("UPS", "prefix/1Z999AA10123456784/suffix"), null);
    assert.equal(parseVendorMail("Your order shipped", "Order confirmation is attached").orderNumber, null);
    assert.equal(parseVendorMail("Order number: ABC123", "").orderNumber, "ABC123");
  });

  it("does not confuse carrier contact numbers or multiple packages with a tracking match", () => {
    assert.equal(parseVendorMail("DHL shipment", "Call 8001234567").trackingNumber, null);
    assert.equal(parseVendorMail("FedEx shipment", "Invoice 123456789012; tracking number: 123456789015").trackingNumber, "123456789015");
    assert.equal(parseVendorMail("UPS shipment", "1Z999AA10123456784 and 1Z999AA10123456785").trackingNumber, null);
  });

});

describe("conservative shipment matching regressions", () => {
  it("leaves multiple labeled orders unmatched rather than picking the first", () => {
    assert.equal(parseVendorMail("Consolidated receipt", "Order # PO-1001 and order # PO-1002").orderNumber, null);
    assert.equal(parseVendorMail("Order # PO-1001", "Order number: po-1001").orderNumber, "PO-1001");
  });
  it("does not extract a valid numeric substring from a malformed tracking identifier", () => {
    for (const suffix of ["-extra", "/extra", "_extra"]) assert.equal(parseVendorMail("FedEx shipment", `Tracking number: 123456789012${suffix}`).trackingNumber, null);
  });
  it("leaves multiple numeric packages unmatched, including a shared tracking label", () => {
    for (const body of ["Tracking number: 123456789012; Tracking number: 123456789015", "Tracking numbers: 123456789012, 123456789015", "Tracking number: 123456789012, 123456789015"]) {
      assert.equal(parseVendorMail("FedEx shipment", body).trackingNumber, null);
    }
  });
  it("deduplicates repeated identifiers and refuses overlapping carrier formats", () => {
    assert.equal(parseVendorMail("FedEx shipped", "Tracking: 123456789012\nTracking: 123456789012").trackingNumber, "123456789012");
    assert.equal(parseVendorMail("FedEx USPS shipment", "Tracking: 9400111899223856928499").trackingNumber, null);
  });
});

describe("identifier boundary regression review", () => {
  it("does not truncate unsupported order identifiers into another valid order", () => {
    for (const value of ["PO-1001/2", "PO-1001_extra", `${"A".repeat(29)}-SUFFIX`]) {
      assert.equal(parseVendorMail("Receipt", `Order number: ${value}`).orderNumber, null);
    }
  });
  it("rejects malformed UPS identifier suffixes as well as numeric carrier suffixes", () => {
    for (const suffix of ["-extra", "/extra", "_extra"]) {
      assert.equal(parseVendorMail("UPS shipped", `Tracking: 1Z999AA10123456784${suffix}`).trackingNumber, null);
    }
  });
});

describe("review of labels and repeated shipment summaries", () => {
  it("does not interpret the start of notification as an order-number label", () => {
    assert.equal(parseVendorMail("Order notification", "Your receipt is attached").orderNumber, null);
    assert.equal(parseVendorMail("Order no. PO-1001", "").orderNumber, "PO-1001");
  });
  it("does not choose a snippet's single tracking ID when the body lists multiple packages", () => {
    const result = parseVendorMail("FedEx shipment", "Tracking: 123456789012\nTracking number: 123456789012, 123456789015");
    assert.equal(result.trackingNumber, null);
  });
  it("recognizes a repeated single tracking ID in a list without treating it as multiple packages", () => {
    assert.equal(parseVendorMail("FedEx shipment", "Tracking: 123456789012, 123456789012").trackingNumber, "123456789012");
  });
});

describe("plural and alphanumeric package lists", () => {
  it("counts plural tracking labels even when the snippet mentions only one package", () => {
    assert.equal(parseVendorMail("FedEx shipment", "Tracking: 123456789012\nTracking numbers: 123456789012, 123456789015").trackingNumber, null);
  });
  it("counts alphanumeric packages and treats uppercase list separators consistently", () => {
    assert.equal(parseVendorMail("DHL shipment", "Tracking number: JD123456789012345678, JD123456789012345679").trackingNumber, null);
    assert.equal(parseVendorMail("FedEx shipment", "Tracking: 123456789012 AND 123456789012").trackingNumber, "123456789012");
  });
});
