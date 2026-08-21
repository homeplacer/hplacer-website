import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import { handleRequest } from "../src/app.ts";
import { listDocuments } from "../src/domain/documents.ts";
import { inbox } from "../src/domain/notifications.ts";
import { billingQueue, getRepair } from "../src/domain/repairs.ts";
import { recentAudit } from "../src/domain/audit.ts";
import {
  closeWarrantyRequest,
  intakeWarrantyRequest,
  linkWarrantyRequest,
  listWarrantyRequests,
  parseCandidates,
  requireWarrantyRequest,
  warrantyReviewCount,
} from "../src/domain/warranty.ts";
import { timingSafeEqual } from "../src/features/public-intake.ts";
import { createHarness, form, identityFor, jsonBody, type Harness } from "./harness.ts";

const BASE = {
  customerName: "Dana Whitfield",
  customerPhone: "(828) 555-0142",
  issueSummary: "Front door will not latch",
  issueDetail: "It swelled after the rain and now catches on the strike plate.",
};

describe("warranty intake", () => {
  let harness: Harness;
  beforeEach(async () => {
    harness = await createHarness();
  });

  it("opens a ticket in the bill-back queue on a confident match", async () => {
    const result = await intakeWarrantyRequest(harness.db, { ...BASE, serialNumber: "CAV2026NC114772A" });

    assert.equal(result.confidence, "confident");
    assert.equal(result.method, "serial");
    assert.equal(result.needsReview, false);
    assert.match(result.reference, /^WR-\d{4}-\d{4}$/);
    assert.ok(result.repairTicketId);

    const ticket = await getRepair(harness.db, result.repairTicketId as string);
    assert.equal(ticket?.home_id, result.homeId);
    assert.equal(ticket?.bill_back_status, "review_needed");
    assert.equal(ticket?.responsible_party_type, "manufacturer");
    assert.equal(ticket?.title, BASE.issueSummary);
    assert.match(ticket?.description ?? "", /Dana Whitfield/);
    assert.match(ticket?.description ?? "", /828\) 555-0142/);

    const queue = await billingQueue(harness.db);
    assert.ok(queue.some((row) => row.id === result.repairTicketId), "it lands in Tara's queue");

    const request = await requireWarrantyRequest(harness.db, result.requestId);
    assert.equal(request.status, "ticketed");
  });

  it("matches on address when the homeowner has no serial number", async () => {
    const result = await intakeWarrantyRequest(harness.db, {
      ...BASE,
      customerName: "Ray Pruitt",
      customerPhone: "8285550198",
      address: "12 Bend Road",
      city: "Vilas",
      state: "NC",
      postalCode: "28692",
    });
    assert.equal(result.confidence, "confident");
    assert.ok(result.repairTicketId);
  });

  it("leaves an ambiguous request unlinked rather than guessing", async () => {
    const result = await intakeWarrantyRequest(harness.db, {
      ...BASE,
      customerName: "Somebody Else",
      customerPhone: "8285550000",
      address: "184 Mill Creek Rd",
      city: "Boone",
      postalCode: "28607",
    });

    assert.equal(result.needsReview, true);
    assert.equal(result.homeId, null);
    assert.equal(result.repairTicketId, null, "no ticket is opened on a guess");
    assert.match(result.reason, /subdivision/);

    const request = await requireWarrantyRequest(harness.db, result.requestId);
    assert.equal(request.status, "needs_review");
    assert.ok(parseCandidates(request).length >= 2, "the reviewer sees what intake saw");
    assert.equal(await warrantyReviewCount(harness.db), 1);
  });

  it("leaves an unknown home unlinked", async () => {
    const result = await intakeWarrantyRequest(harness.db, {
      ...BASE,
      customerName: "Nobody Weknow",
      customerPhone: "8285559999",
      address: "999 Nowhere Rd",
      postalCode: "99999",
    });
    assert.equal(result.needsReview, true);
    assert.equal(result.confidence, "none");
  });

  it("refuses a request with no way to reach the customer", async () => {
    await assert.rejects(
      intakeWarrantyRequest(harness.db, { customerName: "A", issueSummary: "B" }),
      /phone number or an email/,
    );
  });

  it("refuses a malformed phone number and a malformed email", async () => {
    await assert.rejects(intakeWarrantyRequest(harness.db, { ...BASE, customerPhone: "555-0142" }), /10-digit/);
    await assert.rejects(
      intakeWarrantyRequest(harness.db, { ...BASE, customerPhone: null, customerEmail: "not-an-email" }),
      /email does not look right/,
    );
  });

  it("notifies the categories' recipients, supervisors and billing alike", async () => {
    const result = await intakeWarrantyRequest(harness.db, { ...BASE, serialNumber: "CAV2026NC114772A" });
    for (const email of ["brandon@hplacer.com", "tara@hplacer.com"]) {
      const actor = await harness.actor(email);
      const notices = await inbox(harness.db, actor.employeeId);
      assert.ok(
        notices.some((notice) => notice.category === "warranty_request" && notice.related_id === result.requestId),
        `${email} should hear about it`,
      );
    }
  });

  it("marks an unmatched request urgent and a matched one merely a warning", async () => {
    const matched = await intakeWarrantyRequest(harness.db, { ...BASE, serialNumber: "CAV2026NC114772A" });
    const unmatched = await intakeWarrantyRequest(harness.db, {
      ...BASE,
      customerName: "Nobody Weknow",
      customerPhone: "8285559999",
      address: "999 Nowhere Rd",
    });
    const brandon = await harness.actor("brandon@hplacer.com");
    const notices = await inbox(harness.db, brandon.employeeId);
    assert.equal(notices.find((notice) => notice.related_id === matched.requestId)?.severity, "warning");
    assert.equal(notices.find((notice) => notice.related_id === unmatched.requestId)?.severity, "urgent");
  });

  it("numbers references densely within the year", async () => {
    const now = new Date("2026-08-21T12:00:00Z");
    const first = await intakeWarrantyRequest(harness.db, { ...BASE, serialNumber: "CAV2026NC114772A" }, now);
    const second = await intakeWarrantyRequest(harness.db, { ...BASE, customerPhone: "8285550198" }, now);
    assert.equal(first.reference, "WR-2026-0001");
    assert.equal(second.reference, "WR-2026-0002");
  });
});

describe("warranty review", () => {
  let harness: Harness;
  beforeEach(async () => {
    harness = await createHarness();
  });

  async function unmatchedRequest(harnessRef: Harness) {
    return intakeWarrantyRequest(harnessRef.db, {
      ...BASE,
      customerName: "Somebody Else",
      customerPhone: "8285550000",
      address: "184 Mill Creek Rd",
      city: "Boone",
      postalCode: "28607",
    });
  }

  it("opens the ticket a person decides on", async () => {
    const intake = await unmatchedRequest(harness);
    const tara = await harness.actor("tara@hplacer.com");

    const linked = await linkWarrantyRequest(harness.db, tara, intake.requestId, "hom_a1", "Confirmed by phone");
    assert.match(linked.ticketNumber, /^RT-\d{4}-\d{4}$/);

    const request = await requireWarrantyRequest(harness.db, intake.requestId);
    assert.equal(request.status, "ticketed");
    assert.equal(request.home_id, "hom_a1");
    assert.equal(request.match_method, "manual");
    assert.equal(request.reviewed_by, tara.employeeId);
    assert.equal(request.review_notes, "Confirmed by phone");

    const ticket = await getRepair(harness.db, linked.repairTicketId);
    assert.equal(ticket?.bill_back_status, "review_needed");
    assert.match(ticket?.description ?? "", /Linked by Tara: Confirmed by phone/);
  });

  it("will not link the same request twice", async () => {
    const intake = await unmatchedRequest(harness);
    const tara = await harness.actor("tara@hplacer.com");
    await linkWarrantyRequest(harness.db, tara, intake.requestId, "hom_a1");
    await assert.rejects(linkWarrantyRequest(harness.db, tara, intake.requestId, "hom_a2"), /already has ticket/);
  });

  it("closes a request with a reason, and insists on one", async () => {
    const intake = await unmatchedRequest(harness);
    const tara = await harness.actor("tara@hplacer.com");
    await assert.rejects(closeWarrantyRequest(harness.db, tara, intake.requestId, "dismissed", "  "), /Say why/);

    await closeWarrantyRequest(harness.db, tara, intake.requestId, "dismissed", "Not one of ours — bought used.");
    const request = await requireWarrantyRequest(harness.db, intake.requestId);
    assert.equal(request.status, "dismissed");
    assert.equal(await warrantyReviewCount(harness.db), 0);
  });

  it("will not close a request that already became a ticket", async () => {
    const intake = await intakeWarrantyRequest(harness.db, { ...BASE, serialNumber: "CAV2026NC114772A" });
    const tara = await harness.actor("tara@hplacer.com");
    await assert.rejects(
      closeWarrantyRequest(harness.db, tara, intake.requestId, "duplicate", "dupe"),
      /already has a ticket/,
    );
  });

  it("shows the request on the home it was linked to", async () => {
    const intake = await intakeWarrantyRequest(harness.db, { ...BASE, serialNumber: "CAV2026NC114772A" });
    const forHome = await listWarrantyRequests(harness.db, { homeId: intake.homeId as string });
    assert.equal(forHome.length, 1);
    assert.equal(forHome[0].reference, intake.reference);
  });
});

describe("public intake endpoint", () => {
  let harness: Harness;
  const TOKEN = "test-intake-token-000000000000000";

  before(async () => {
    harness = await createHarness();
    harness.env.PORTAL_INTAKE_TOKEN = TOKEN;
  });
  after(() => harness.close());

  const post = (body: BodyInit, headers: Record<string, string>) =>
    handleRequest(new Request("https://portal.hplacer.com/api/public/warranty-requests", { method: "POST", headers, body }), harness.env);

  it("compares tokens without leaking length", () => {
    assert.ok(timingSafeEqual("abc", "abc"));
    assert.ok(!timingSafeEqual("abc", "abd"));
    assert.ok(!timingSafeEqual("abc", "abcd"));
    assert.ok(!timingSafeEqual("", "x"));
  });

  it("refuses a request with no token", async () => {
    const response = await post(JSON.stringify({}), { "Content-Type": "application/json" });
    assert.equal(response.status, 401);
  });

  it("refuses a request with the wrong token", async () => {
    const response = await post(JSON.stringify({}), {
      "Content-Type": "application/json",
      Authorization: "Bearer not-the-token",
    });
    assert.equal(response.status, 401);
    const audit = await recentAudit(harness.db, 3);
    assert.equal(audit[0].outcome, "denied");
    assert.equal(audit[0].actor_email, "public:warranty-intake");
  });

  it("fails closed when no token is configured", async () => {
    const response = await handleRequest(
      new Request("https://portal.hplacer.com/api/public/warranty-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${TOKEN}` },
        body: "{}",
      }),
      { ...harness.env, PORTAL_INTAKE_TOKEN: undefined },
    );
    assert.equal(response.status, 503);
  });

  it("accepts a request and returns only a reference", async () => {
    const response = await post(
      JSON.stringify({
        customer_name: "Dana Whitfield",
        customer_phone: "828-555-0142",
        serial_number: "CAV2026NC114772A",
        issue_summary: "Front door will not latch",
        issue_detail: "Catches on the strike plate.",
      }),
      { "Content-Type": "application/json", Authorization: `Bearer ${TOKEN}` },
    );
    assert.equal(response.status, 201);
    const body = (await response.json()) as Record<string, unknown>;
    // No home id, no serial, no confidence — an unauthenticated caller must not
    // be able to use this endpoint to find out what we know.
    assert.deepEqual(Object.keys(body).sort(), ["photos", "received", "reference"]);
    assert.match(body.reference as string, /^WR-\d{4}-\d{4}$/);
  });

  it("stores homeowner photos against the request and moves them onto the ticket", async () => {
    const body = new FormData();
    body.set("customer_name", "Ray Pruitt");
    body.set("customer_phone", "8285550198");
    body.set("issue_summary", "Skirting panel blew off");
    body.set("serial_number", "CLT2025TN881204Z");
    body.append("photos", new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], "damage.png", { type: "image/png" }));
    body.append("photos", new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1])], "wide.png", { type: "image/png" }));

    const response = await post(body, { Authorization: `Bearer ${TOKEN}` });
    assert.equal(response.status, 201);
    assert.equal(((await response.json()) as { photos: number }).photos, 2);

    const request = await requireWarrantyRequest(harness.db, "WR-2026-0002");
    assert.ok(request.repair_ticket_id);
    const onTicket = await listDocuments(harness.db, { repairTicketId: request.repair_ticket_id as string });
    assert.equal(onTicket.length, 2);
    assert.equal(onTicket[0].uploaded_by_name, null, "a homeowner is not an employee");
  });

  it("drops a photo it cannot accept without losing the request", async () => {
    const body = new FormData();
    body.set("customer_name", "Nobody Weknow");
    body.set("customer_phone", "8285559999");
    body.set("issue_summary", "Something is wrong");
    body.append("photos", new File(["<svg/>"], "payload.svg", { type: "image/svg+xml" }));

    const response = await post(body, { Authorization: `Bearer ${TOKEN}` });
    assert.equal(response.status, 201);
    assert.equal(((await response.json()) as { photos: number }).photos, 0);
  });

  it("rejects a submission that is missing what it needs", async () => {
    const response = await post(JSON.stringify({ customer_name: "A" }), {
      "Content-Type": "application/json",
      Authorization: `Bearer ${TOKEN}`,
    });
    assert.equal(response.status, 400);
  });

  it("answers 405 for anything but POST and never exposes portal data", async () => {
    const response = await handleRequest(
      new Request("https://portal.hplacer.com/api/public/warranty-requests", { method: "GET" }),
      harness.env,
    );
    assert.equal(response.status, 405);
  });

  it("does not open a door to the rest of the portal", async () => {
    const response = await handleRequest(
      new Request("https://portal.hplacer.com/api/homes", {
        headers: { Authorization: `Bearer ${TOKEN}`, Accept: "application/json" },
      }),
      { ...harness.env, PORTAL_ENVIRONMENT: "production", ACCESS_TEAM_DOMAIN: "homeplacer", ACCESS_AUD: "aud" },
    );
    assert.equal(response.status, 401, "the intake token is not an identity");
  });
});

describe("warranty queue through HTTP", () => {
  let harness: Harness;
  before(async () => {
    harness = await createHarness();
    harness.env.PORTAL_INTAKE_TOKEN = "t".repeat(32);
    await intakeWarrantyRequest(harness.db, {
      ...BASE,
      customerName: "Somebody Else",
      customerPhone: "8285550000",
      address: "184 Mill Creek Rd",
      city: "Boone",
      postalCode: "28607",
    });
  });
  after(() => harness.close());

  it("is visible to supervisors and billing, not to field crew", async () => {
    assert.equal((await harness.request("/warranty", { as: "greg@hplacer.com" })).status, 200);
    assert.equal((await harness.request("/warranty", { as: "tara@hplacer.com" })).status, 200);
    assert.equal((await harness.request("/warranty", { as: "dale@hplacer.com" })).status, 403);
  });

  it("shows the reviewer what intake considered", async () => {
    const [request] = await listWarrantyRequests(harness.db, { needsReviewOnly: true });
    const page = await (await harness.request(`/warranty/${request.id}`, { as: "greg@hplacer.com" })).text();
    assert.match(page, /Homes considered/);
    assert.match(page, /CAV2026NC114772A/);
    assert.match(page, /CLT2026TN903318X/);
    assert.match(page, /Needs a person/);
  });

  it("links from the queue and opens the ticket", async () => {
    const [request] = await listWarrantyRequests(harness.db, { needsReviewOnly: true });
    const response = await harness.request(`/api/warranty/${request.id}/link`, {
      as: "tara@hplacer.com",
      ...form({ home_id: "hom_a1", note: "Confirmed the lot number by phone" }),
    });
    assert.equal(response.status, 303);

    const after = await requireWarrantyRequest(harness.db, request.id);
    assert.equal(after.status, "ticketed");
    assert.ok(after.repair_ticket_id);
  });

  it("refuses a link from someone who cannot review", async () => {
    const intake = await intakeWarrantyRequest(harness.db, {
      ...BASE,
      customerName: "Another Person",
      customerPhone: "8285551111",
      address: "184 Mill Creek Rd",
      city: "Boone",
      postalCode: "28607",
    });
    const response = await handleRequest(
      new Request(`https://localhost:8788/api/warranty/${intake.requestId}/link`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ home_id: "hom_a1" }),
      }),
      harness.env,
      { identity: identityFor("dale@hplacer.com") },
    );
    assert.equal(response.status, 403);
  });

  it("exposes the queue as JSON to staff who may see it", async () => {
    const { requests } = await harness.json<{ requests: unknown[] }>("/api/warranty", { as: "tara@hplacer.com" });
    assert.ok(requests.length >= 1);
    const denied = await harness.request("/api/warranty", { as: "dale@hplacer.com" });
    assert.equal(denied.status, 403);
  });
});

describe("harness sanity", () => {
  it("keeps jsonBody usable for warranty posts", () => {
    const init = jsonBody({ home_id: "x" });
    assert.equal(init.method, "POST");
  });
});
