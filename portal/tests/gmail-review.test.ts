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
      const reviewHtml = await reviewPage.text();
      assert.match(reviewHtml, /PO-48392/);
      assert.match(reviewHtml, /\/api\/inventory\/vendor-email\/vem_mail1\/attachments\/vea_mail1/);
      const attachmentUrl = '/api/inventory/vendor-email/vem_mail1/attachments/vea_mail1';
      assert.equal((await harness.request(attachmentUrl, { as: 'dale@hplacer.com' })).status, 403);
      assert.equal((await harness.request('/api/inventory/vendor-email/other/attachments/vea_mail1')).status, 404);
      const download = await harness.request(attachmentUrl);
      assert.equal(download.status, 200);
      assert.equal(download.headers.get('Cache-Control'), 'private, no-store');
      assert.equal(download.headers.get('X-Content-Type-Options'), 'nosniff');
      assert.match(download.headers.get('Content-Disposition') ?? '', /^attachment;/);
      assert.equal(await download.text(), '%PDF invoice');

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
      const requestPage = await harness.request('/inventory/requests', { as: 'dale@hplacer.com' });
      assert.match(await requestPage.text(), new RegExp(`/api/documents/${document?.id}/content`));
      assert.equal((await harness.request(`/api/documents/${document?.id}/content`, { as: 'dale@hplacer.com' })).status, 200);
      assert.equal((await harness.request(attachmentUrl)).status, 404);
      const event = await harness.db.prepare("SELECT status, reviewed_by FROM vendor_email_events WHERE id = 'vem_mail1'").first<{ status: string; reviewed_by: string }>();
      assert.deepEqual(event && { ...event }, { status: "linked", reviewed_by: "emp_admin" });
      const notification = await harness.db.prepare("SELECT category, related_id FROM notifications WHERE employee_id = 'emp_dale'").first<{ category: string; related_id: string }>();
      assert.deepEqual(notification && { ...notification }, { category: "parts_tracking", related_id: "mrq_mail1" });
    } finally { harness.close(); }
  });
});

async function seedReview(harness: Awaited<ReturnType<typeof createHarness>>) {
  await harness.db.prepare(`INSERT INTO material_requests
    (id, status, requested_by, requested_quantity, description, created_at, updated_at)
    VALUES ('mrq_race', 'approved', 'emp_dale', 1, 'Filter', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`).run();
  await harness.db.prepare(`INSERT INTO vendor_email_events
    (id, gmail_message_id, sender, subject, event_kind, status)
    VALUES ('vem_race', 'gmail-race', 'vendor@example.com', 'Receipt', 'receipt', 'needs_review')`).run();
  await harness.store.put('vendor-email/race.pdf', new TextEncoder().encode('%PDF invoice'));
  await harness.db.prepare(`INSERT INTO vendor_email_attachments
    (id, event_id, gmail_attachment_id, storage_key, file_name, content_type, byte_size, checksum_sha256)
    VALUES ('vea_race', 'vem_race', 'a', 'vendor-email/race.pdf', 'receipt.pdf', 'application/pdf', 12, 'checksum')`).run();
}

describe('vendor email review transaction', () => {
  for (const closedStatus of ['received', 'cancelled']) {
    it(`does not reopen a request concurrently marked ${closedStatus}`, async () => {
      const h = await createHarness();
      try {
        await seedReview(h);
        const originalHead = h.store.head.bind(h.store);
        h.store.head = async (key) => {
          await h.db.prepare('UPDATE material_requests SET status = ? WHERE id = ?').bind(closedStatus, 'mrq_race').run();
          return originalHead(key);
        };
        const response = await h.request('/api/inventory/vendor-email/vem_race/review', {
          ...form({ action: 'approve', material_request_id: 'mrq_race' }),
        });
        assert.equal(response.status, 409);
        assert.equal((await h.db.prepare("SELECT status FROM material_requests WHERE id = 'mrq_race'").first<{status: string}>())?.status, closedStatus);
        assert.equal((await h.db.prepare("SELECT status FROM vendor_email_events WHERE id = 'vem_race'").first<{status: string}>())?.status, 'needs_review');
        assert.equal((await h.db.prepare("SELECT count(*) AS n FROM documents WHERE material_request_id = 'mrq_race'").first<{n: number}>())?.n, 0);
        assert.equal((await h.db.prepare("SELECT count(*) AS n FROM notifications WHERE related_id = 'mrq_race'").first<{n: number}>())?.n, 0);
      } finally { h.close(); }
    });
  }

  it('rolls back the link when notification delivery fails and supports retry', async () => {
    const h = await createHarness();
    try {
      await seedReview(h);
      await h.db.exec(`CREATE TRIGGER fail_parts_notice BEFORE INSERT ON notifications
        WHEN NEW.category = 'parts_tracking' BEGIN SELECT RAISE(ABORT, 'simulated storage failure'); END;`);
      const submit = () => h.request('/api/inventory/vendor-email/vem_race/review', {
        ...form({ action: 'approve', material_request_id: 'mrq_race' }),
      });
      assert.equal((await submit()).status, 500);
      assert.equal((await h.db.prepare("SELECT status FROM vendor_email_events WHERE id = 'vem_race'").first<{status: string}>())?.status, 'needs_review');
      assert.equal((await h.db.prepare("SELECT status FROM material_requests WHERE id = 'mrq_race'").first<{status: string}>())?.status, 'approved');
      assert.equal((await h.db.prepare("SELECT count(*) AS n FROM documents WHERE material_request_id = 'mrq_race'").first<{n: number}>())?.n, 0);
      await h.db.exec('DROP TRIGGER fail_parts_notice');
      assert.equal((await submit()).status, 303);
      assert.equal((await h.db.prepare("SELECT count(*) AS n FROM notifications WHERE related_id = 'mrq_race'").first<{n: number}>())?.n, 1);
    } finally { h.close(); }
  });
});


describe('vendor email import health', () => {
  it('warns authorized reviewers when importing failed even with an empty review queue', async () => {
    const h = await createHarness();
    try {
      await h.db.prepare("INSERT INTO portal_integration_state (state_key, state_value) VALUES ('gmail_last_error', 'secret-like-value-never-show')").run();
      const html = await (await h.request('/inventory/vendor-email')).text();
      assert.match(html, /Some vendor emails could not be imported/);
      assert.doesNotMatch(html, /secret-like-value-never-show/);
      assert.equal((await h.request('/inventory/vendor-email', { as: 'dale@hplacer.com' })).status, 403);
      await h.db.prepare('DELETE FROM portal_integration_state').run();
      await seedReview(h);
      await h.db.prepare("UPDATE vendor_email_events SET status = 'failed'").run();
      assert.match(await (await h.request('/inventory/vendor-email')).text(), /1 email\(s\) need another import attempt/);
    } finally { h.close(); }
  });
});
