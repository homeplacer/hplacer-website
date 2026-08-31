/** Admin-only review screens for applications submitted through Careers. */
import { assertCan } from "../auth/authz.ts";
import {
  JOB_APPLICATION_STATUSES,
  listJobApplications,
  readJobApplicationResume,
  requireJobApplication,
  updateJobApplicationReview,
} from "../domain/job-applications.ts";
import { optionalField, readFields, requiredField, type RequestContext } from "../api/context.ts";
import { flashFrom, json, redirect } from "../api/responses.ts";
import type { Router } from "../api/router.ts";
import { html, raw } from "../ui/html.ts";
import { badge, empty, formatDate, kv, page, securityHeaders } from "../ui/layout.ts";
import { adminTabs } from "./admin.ts";

export function registerCareersReview(router: Router): void {
  router.get("/admin/applications", renderApplications);
  router.get("/admin/applications/:id", renderApplication);
  router.post("/api/job-applications/:id/status", updateApplicationRoute);
  router.get("/api/job-applications/:id/resume", resumeRoute);
}

async function renderApplications(ctx: RequestContext): Promise<Response> {
  assertCan(ctx.actor, "career.review");
  const status = ctx.url.searchParams.get("status");
  const applications = await listJobApplications(ctx.db, { status });
  const body = html`
    <h1>Career applications</h1>
    ${adminTabs("applications")}
    <p class="lede">Private applications from hplacer.com. Applicant details and resumes are available only to administrators.</p>

    <form method="get" action="/admin/applications">
      <label for="status">Status</label>
      <select id="status" name="status">
        <option value="">All applications</option>
        ${JOB_APPLICATION_STATUSES.map(
          (value) => html`<option value="${value}" ${raw(status === value ? "selected" : "")}>${value.replace(/_/g, " ")}</option>`,
        )}
      </select>
      <div class="btn-row"><button class="secondary" type="submit">Filter</button></div>
    </form>

    ${applications.length === 0
      ? empty("No applications match that status.")
      : applications.map(
          (application) => html`<a class="card" href="/admin/applications/${application.id}">
            <div class="row"><h3>${application.applicant_name}</h3>
              ${badge(application.status, application.status === "received" ? "warn" : application.status === "hired" ? "ok" : "")}</div>
            <p>${application.position}</p>
            <div class="meta">${application.reference} · received ${formatDate(application.created_at)}${application.resume_key ? " · resume attached" : ""}</div>
          </a>`,
        )}
  `;
  return page(body, {
    title: "Career applications",
    actor: ctx.actor,
    section: "/admin",
    back: { href: "/admin", label: "Admin" },
    flash: flashFrom(ctx.url),
  });
}

async function renderApplication(ctx: RequestContext): Promise<Response> {
  assertCan(ctx.actor, "career.review");
  const application = await requireJobApplication(ctx.db, ctx.params.id);
  const body = html`
    <h1>${application.applicant_name}</h1>
    <p class="lede">${application.position} · ${application.reference}</p>
    <div class="card">
      <div class="row">${badge(application.status, application.status === "received" ? "warn" : application.status === "hired" ? "ok" : "")}</div>
      ${kv([
        ["Email", application.email],
        ["Phone", application.phone],
        ["City / state", application.city_state],
        ["Available", application.available_date],
        ["Submitted", formatDate(application.created_at)],
        ["Experience", application.experience],
        ["Licenses / credentials", application.credentials],
        ["References", application.references_text],
        ["Last reviewed by", application.reviewed_by_name],
        ["Last reviewed", formatDate(application.reviewed_at)],
      ])}
      ${application.resume_key
        ? html`<div class="btn-row"><a class="btn secondary" href="/api/job-applications/${application.id}/resume">Download resume</a></div>`
        : html`<p class="meta">No resume was attached.</p>`}
    </div>

    <h2>Review</h2>
    <form class="card" method="post" action="/api/job-applications/${application.id}/status">
      <label for="status">Status</label>
      <select id="status" name="status">
        ${JOB_APPLICATION_STATUSES.map(
          (value) => html`<option value="${value}" ${raw(application.status === value ? "selected" : "")}>${value.replace(/_/g, " ")}</option>`,
        )}
      </select>
      <label for="review_notes">Private review notes</label>
      <textarea id="review_notes" name="review_notes">${application.review_notes ?? ""}</textarea>
      <div class="btn-row"><button type="submit">Save review</button></div>
    </form>
  `;
  return page(body, {
    title: "Application",
    actor: ctx.actor,
    section: "/admin",
    back: { href: "/admin/applications", label: "Applications" },
    flash: flashFrom(ctx.url),
  });
}

async function updateApplicationRoute(ctx: RequestContext): Promise<Response> {
  assertCan(ctx.actor, "career.review");
  const fields = await readFields(ctx.request);
  await updateJobApplicationReview(
    ctx.db,
    ctx.params.id,
    requiredField(fields, "status", "Status"),
    optionalField(fields, "review_notes"),
    ctx.actor.employeeId,
  );
  if ((ctx.request.headers.get("Accept") ?? "").includes("application/json")) return json({ ok: true });
  return redirect(`/admin/applications/${ctx.params.id}?ok=saved`);
}

async function resumeRoute(ctx: RequestContext): Promise<Response> {
  assertCan(ctx.actor, "career.review");
  const { application, bytes } = await readJobApplicationResume(ctx.db, ctx.store, ctx.params.id);
  const fileName = (application.resume_file_name ?? "resume").replace(/["\\/]/g, "");
  return new Response(bytes, {
    headers: securityHeaders({
      "Content-Type": application.resume_content_type ?? "application/octet-stream",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "private, no-store",
    }),
  });
}
