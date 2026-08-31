import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { inbox } from "../src/domain/notifications.ts";
import { createHarness, type Harness } from "./harness.ts";

const JOB_TOKEN = "jobs-" + "j".repeat(48);
const WARRANTY_TOKEN = "warranty-" + "w".repeat(48);
const PATH = "/api/public/job-applications";

describe("public job application intake", () => {
  let harness: Harness;

  beforeEach(async () => {
    harness = await createHarness();
    harness.env.PORTAL_JOB_APPLICATION_TOKEN = JOB_TOKEN;
    harness.env.PORTAL_INTAKE_TOKEN = WARRANTY_TOKEN;
  });

  afterEach(() => harness.close());

  function submit(body: BodyInit, token = JOB_TOKEN, contentType?: string): Promise<Response> {
    const headers = new Headers({ Authorization: `Bearer ${token}` });
    if (contentType) headers.set("Content-Type", contentType);
    return harness.request(PATH, { method: "POST", headers, body });
  }

  it("fails closed and keeps the warranty token isolated", async () => {
    const withoutConfig = await harness.request(PATH, {
      method: "POST",
      headers: { Authorization: `Bearer ${JOB_TOKEN}`, "Content-Type": "application/json" },
      body: "{}",
      as: "ops@hplacer.com",
    });
    // Prove this assertion against a genuinely unconfigured environment.
    harness.env.PORTAL_JOB_APPLICATION_TOKEN = undefined;
    const unconfigured = await harness.request(PATH, {
      method: "POST",
      headers: { Authorization: `Bearer ${JOB_TOKEN}`, "Content-Type": "application/json" },
      body: "{}",
    });
    assert.equal(unconfigured.status, 503);

    harness.env.PORTAL_JOB_APPLICATION_TOKEN = JOB_TOKEN;
    const wrongIntegration = await submit("{}", WARRANTY_TOKEN, "application/json");
    assert.equal(wrongIntegration.status, 401);
    assert.notEqual(withoutConfig.status, 401, "the configured job token reaches validation");
  });

  it("stores a complete application and routes an admin notification", async () => {
    const response = await submit(JSON.stringify({
      position: "CDL Driver",
      name: "Taylor Morgan",
      email: "Taylor@example.com",
      phone: "843-555-0101",
      city_state: "Conway, SC",
      experience: "Five years hauling construction equipment.",
    }), JOB_TOKEN, "application/json");
    assert.equal(response.status, 201);
    const body = await response.json() as { received: boolean; reference: string };
    assert.equal(body.received, true);
    assert.match(body.reference, /^JA-\d{4}-\d{4}$/);

    const row = await harness.db.prepare(
      "SELECT position, applicant_name, email, phone, resume_key FROM job_applications WHERE reference = ?",
    ).bind(body.reference).first<Record<string, string | null>>();
    assert.deepEqual({ ...row }, {
      position: "CDL Driver",
      applicant_name: "Taylor Morgan",
      email: "taylor@example.com",
      phone: "843-555-0101",
      resume_key: null,
    });

    const admin = await harness.actor("ops@hplacer.com");
    assert.ok((await inbox(harness.db, admin.employeeId)).some((item) => item.category === "job_application"));
  });

  it("stores an allowed resume privately and rejects an unsafe file type", async () => {
    const form = new FormData();
    form.set("position", "Carpenter");
    form.set("name", "Jordan Lee");
    form.set("email", "jordan@example.com");
    form.set("phone", "8435550199");
    form.set("resume", new File(["resume"], "../Jordan Resume.pdf", { type: "application/pdf" }));

    const response = await submit(form);
    assert.equal(response.status, 201);
    const row = await harness.db.prepare(
      "SELECT resume_key, resume_file_name, resume_content_type, resume_byte_size FROM job_applications",
    ).first<{ resume_key: string; resume_file_name: string; resume_content_type: string; resume_byte_size: number }>();
    assert.match(row!.resume_key, /^job-applications\/\d{4}\/app_[a-z0-9]+\/Jordan-Resume\.pdf$/);
    assert.equal(row!.resume_file_name, "Jordan-Resume.pdf");
    assert.equal(row!.resume_content_type, "application/pdf");
    assert.equal(row!.resume_byte_size, 6);
    assert.ok(await harness.store.head(row!.resume_key));

    const unsafe = new FormData();
    unsafe.set("position", "Laborer");
    unsafe.set("name", "Casey Smith");
    unsafe.set("email", "casey@example.com");
    unsafe.set("phone", "8435550123");
    unsafe.set("resume", new File(["<script>"], "resume.html", { type: "text/html" }));
    assert.equal((await submit(unsafe)).status, 400);
  });

  it("rejects bots, incomplete applications, and read attempts", async () => {
    const bot = await submit(JSON.stringify({
      website: "https://spam.example",
      position: "Laborer",
      name: "Bot",
      email: "bot@example.com",
      phone: "8435550000",
    }), JOB_TOKEN, "application/json");
    assert.equal(bot.status, 400);

    const incomplete = await submit(JSON.stringify({ name: "Only A Name" }), JOB_TOKEN, "application/json");
    assert.equal(incomplete.status, 400);

    const read = await harness.request(PATH, { method: "GET" });
    assert.equal(read.status, 405);
  });

  it("lets only an administrator review an application and download its private resume", async () => {
    const application = new FormData();
    application.set("position", "Diesel technician");
    application.set("name", "Morgan Reyes");
    application.set("email", "morgan@example.com");
    application.set("phone", "8435550133");
    application.set("experience", "Heavy equipment field service.");
    application.set("resume", new File(["private resume"], "Morgan Resume.pdf", { type: "application/pdf" }));
    assert.equal((await submit(application)).status, 201);

    const row = await harness.db.prepare("SELECT id FROM job_applications WHERE email = 'morgan@example.com'").first<{ id: string }>();
    assert.ok(row);

    assert.equal((await harness.request("/admin/applications", { as: "dale@hplacer.com" })).status, 403);
    assert.equal((await harness.request("/admin/applications", { as: "greg@hplacer.com" })).status, 403);
    const list = await harness.request("/admin/applications", { as: "ops@hplacer.com" });
    assert.equal(list.status, 200);
    assert.match(await list.text(), /Morgan Reyes/);

    const detail = await harness.request(`/admin/applications/${row.id}`, { as: "ops@hplacer.com" });
    assert.equal(detail.status, 200);
    assert.match(await detail.text(), /Heavy equipment field service/);

    assert.equal((await harness.request(`/api/job-applications/${row.id}/resume`, { as: "dale@hplacer.com" })).status, 403);
    const resume = await harness.request(`/api/job-applications/${row.id}/resume`, { as: "ops@hplacer.com" });
    assert.equal(resume.status, 200);
    assert.equal(resume.headers.get("Content-Disposition"), 'attachment; filename="Morgan-Resume.pdf"');
    assert.equal(await resume.text(), "private resume");

    const saved = await harness.request(`/api/job-applications/${row.id}/status`, {
      as: "ops@hplacer.com",
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ status: "reviewing", review_notes: "Call after 3 PM." }),
    });
    assert.equal(saved.status, 303);
    const reviewed = await harness.db.prepare(
      "SELECT status, review_notes, reviewed_by, reviewed_at FROM job_applications WHERE id = ?",
    ).bind(row.id).first<{ status: string; review_notes: string; reviewed_by: string; reviewed_at: string }>();
    assert.deepEqual({
      status: reviewed?.status,
      review_notes: reviewed?.review_notes,
      reviewed_by: reviewed?.reviewed_by,
      hasReviewedAt: Boolean(reviewed?.reviewed_at),
    }, {
      status: "reviewing",
      review_notes: "Call after 3 PM.",
      reviewed_by: "emp_admin",
      hasReviewedAt: true,
    });
  });
});
