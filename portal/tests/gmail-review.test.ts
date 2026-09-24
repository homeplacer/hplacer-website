import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createHarness, form } from "./harness.ts";

describe("vendor email review", () => {
  it("keeps the queue restricted and lets billing link a reviewed shipment", async () => {
    const harness = await createHarness();
    try {
      await harness.db.prepare(
        `INSERT INTO material_requests (id, status, requested_by, requested_quantity, description, created_at, updated_at)
         VALUES ('mrq_mail1', 'approved', 'emp_dale', 1, '333G engine oil filter', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      ).run();
      await harness.db.prepare(
        `INSERT INTO vendor_email_events (id, gmail_message_id, sender, subject, message_date, event_kind,
           vendor_order_number, carrier_name, tracking_number, tracking_url, status)
         VALUES ('vem_mail1', 'gmail-mail1', 'Vendor <ship@example.com>', 'Order PO-48392 shipped', CURRENT_TIMESTAMP,
           'shipment', 'PO-48392', 'UPS', '1Z999AA10123456784', 'https://www.ups.com/track?tracknum=1Z999AA10123456784', 'needs_review')`,
      ).run();
      const bytes = new TextEncoder().encode("%PDF invoice");
      const checksum = "a".repeat(64);
      const storageKey = "vendor-email/vem_mail1/fixture.pdf";
      await harness.store.put(storageKey, bytes, { httpMetadata: { contentType: "application/pdf" } });
      await harness.db.prepare(
        `INSERT INTO vendor_email_attachments (id, event_id, gmail_attachment_id, storage_key, file_name,
           content_type, byte_size, checksum_sha256)
         VALUES ('vea_mail1', 'vem_mail1', 'attachment-1', ?, 'Vendor attachment.pdf', 'application/pdf', ?, ?)`,
      ).bind(storageKey, bytes.length, checksum).run();

      const employeePage = await harness.request("/inventory/vendor-email", { as: "dale@hplacer.com" });
      assert.equal(employeePage.status, 403);
      const reviewPage = await harness.request("/inventory/vendor-email", { as: "ops@hplacer.com" });
      assert.equal(reviewPage.status, 200);
      assert.match(await reviewPage.text(), /PO-48392/);

      const linked = await harness.request("/api/inventory/vendor-email/vem_mail1/review", {
        as: "ops@hplacer.com",
        ...form({ action: "approve", material_request_id: "mrq_mail1" }),
      });
      assert.equal(linked.status, 303);

      const request = await harness.db.prepare("SELECT * FROM material_requests WHERE id = 'mrq_mail1'").first<Record<string, unknown>>();
      assert.equal(request?.status, "ordered");
      assert.equal(request?.vendor_order_number, "PO-48392");
      assert.equal(request?.carrier_name, "UPS");
      assert.equal(request?.tracking_url, "https://www.ups.com/track?tracknum=1Z999AA10123456784");
      const document = await harness.db.prepare("SELECT * FROM documents WHERE material_request_id = 'mrq_mail1'").first<Record<string, unknown>>();
      assert.equal(document?.storage_key, storageKey);
      assert.equal(document?.storage_provider, "r2");
      assert.equal(document?.uploaded_by, "emp_admin");
      const event = await harness.db.prepare("SELECT status, reviewed_by FROM vendor_email_events WHERE id = 'vem_mail1'").first<{ status: string; reviewed_by: string }>();
      assert.deepEqual(event && { ...event }, { status: "linked", reviewed_by: "emp_admin" });
      const notification = await harness.db.prepare("SELECT category, related_id FROM notifications WHERE employee_id = 'emp_dale'").first<{ category: string; related_id: string }>();
      assert.deepEqual(notification && { ...notification }, { category: "parts_tracking", related_id: "mrq_mail1" });
    } finally { harness.close(); }
  });
});
