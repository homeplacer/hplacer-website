import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { listInsuranceCards, notifyInsuranceExpirations, recordInsuranceCard } from "../src/domain/insurance.ts";
import { inbox } from "../src/domain/notifications.ts";
import { createHarness, type Harness } from "./harness.ts";

describe("vehicle insurance cards", () => {
  let harness: Harness;

  beforeEach(async () => {
    harness = await createHarness();
  });

  afterEach(() => harness.close());

  function insuranceForm(expiresOn: string, fileText = "insurance card"): FormData {
    const form = new FormData();
    form.set("provider", "State Farm");
    form.set("policy_number", "POLICY-123");
    form.set("effective_on", "2026-07-30");
    form.set("expires_on", expiresOn);
    form.set("file", new File([fileText], "insurance card.pdf", { type: "application/pdf" }));
    return form;
  }

  it("stores a replacement card privately and exposes it to signed-in employees", async () => {
    const denied = await harness.request("/api/equipment/PK-01/insurance", {
      as: "dale@hplacer.com",
      method: "POST",
      body: insuranceForm("2027-01-30"),
    });
    assert.equal(denied.status, 403);

    const created = await harness.request("/api/equipment/PK-01/insurance", {
      as: "greg@hplacer.com",
      method: "POST",
      body: insuranceForm("2027-01-30"),
    });
    assert.equal(created.status, 303);
    assert.equal(created.headers.get("Location"), "/equipment/PK-01?ok=insurance_saved");

    const [card] = await listInsuranceCards(harness.db, "ast_pk1");
    assert.equal(card.provider, "State Farm");
    assert.equal(card.policy_number, "POLICY-123");
    assert.equal(card.effective_on, "2026-07-30");
    assert.equal(card.expires_on, "2027-01-30");
    assert.equal(card.status, "current");
    assert.ok(card.document_id);

    const detail = await harness.request("/equipment/PK-01", { as: "dale@hplacer.com" });
    assert.equal(detail.status, 200);
    const html = await detail.text();
    assert.match(html, /Insurance cards/);
    assert.match(html, /2027-01-30/);

    const download = await harness.request(`/api/documents/${card.document_id}/content`, { as: "dale@hplacer.com" });
    assert.equal(download.status, 200);
    assert.equal(download.headers.get("Content-Type"), "application/pdf");
    assert.equal(await download.text(), "insurance card");

    const replacement = await harness.request("/api/equipment/PK-01/insurance", {
      as: "greg@hplacer.com",
      method: "POST",
      body: insuranceForm("2027-07-30", "replacement card"),
    });
    assert.equal(replacement.status, 303);
    const cards = await listInsuranceCards(harness.db, "ast_pk1");
    assert.equal(cards.filter((item) => item.status === "current").length, 1);
    assert.equal(cards.find((item) => item.status === "current")?.expires_on, "2027-07-30");
    assert.equal(cards.find((item) => item.status === "superseded")?.expires_on, "2027-01-30");
  });

  it("rejects invalid policy dates before storing a file", async () => {
    const response = await harness.request("/api/equipment/PK-01/insurance", {
      as: "greg@hplacer.com",
      method: "POST",
      body: insuranceForm("2026-02-30"),
    });
    assert.equal(response.status, 400);
    assert.equal(harness.store.size, 0);
  });

  it("alerts at 30 days, 7 days, and expiration without duplicating a milestone", async () => {
    await recordInsuranceCard(harness.db, harness.store, {
      assetId: "ast_pk1",
      provider: "State Farm",
      policyNumber: "POLICY-123",
      effectiveOn: "2026-07-30",
      expiresOn: "2026-09-20",
      fileName: "card.pdf",
      contentType: "application/pdf",
      bytes: new TextEncoder().encode("card").buffer,
      createdBy: "emp_greg",
    });

    assert.ok((await notifyInsuranceExpirations(harness.db, new Date("2026-08-31T12:00:00Z"))) > 0);
    assert.equal(await notifyInsuranceExpirations(harness.db, new Date("2026-09-01T12:00:00Z")), 0);
    assert.ok((await notifyInsuranceExpirations(harness.db, new Date("2026-09-15T12:00:00Z"))) > 0);
    assert.ok((await notifyInsuranceExpirations(harness.db, new Date("2026-09-21T12:00:00Z"))) > 0);

    const admin = await harness.actor("ops@hplacer.com");
    const notices = (await inbox(harness.db, admin.employeeId)).filter((item) => item.category === "insurance_expiring");
    assert.equal(notices.length, 3);
    assert.ok(notices.some((item) => item.title.includes("expired")));
  });
});
