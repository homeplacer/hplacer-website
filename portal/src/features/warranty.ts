/** The staff side of warranty requests: the review queue and its decisions. */
import { assertCan } from "../auth/authz.ts";
import { listDocuments } from "../domain/documents.ts";
import { formatSiteAddress, listHomes, requireHome } from "../domain/homes.ts";
import {
  WARRANTY_STATUSES,
  closeWarrantyRequest,
  linkWarrantyRequest,
  listWarrantyRequests,
  parseCandidates,
  requireWarrantyRequest,
} from "../domain/warranty.ts";
import { badRequest } from "../platform/errors.ts";
import { optionalField, readFields, requiredField, type RequestContext } from "../api/context.ts";
import { flashFrom, json, redirect } from "../api/responses.ts";
import type { Router } from "../api/router.ts";
import { html, query } from "../ui/html.ts";
import { badge, empty, formatDate, kv, page, tabs } from "../ui/layout.ts";
import { documentList } from "./documents.ts";
import { wantsJson } from "./equipment.ts";

export function registerWarranty(router: Router): void {
  router.get("/warranty", renderQueue);
  router.get("/warranty/:id", renderDetail);
  router.post("/api/warranty/:id/link", linkRoute);
  router.post("/api/warranty/:id/close", closeRoute);

  router.get("/api/warranty", async (ctx) => {
    assertCan(ctx.actor, "warranty.review");
    return json({
      requests: await listWarrantyRequests(ctx.db, {
        status: ctx.url.searchParams.get("status") ?? undefined,
        needsReviewOnly: ctx.url.searchParams.get("review") === "1",
      }),
    });
  });
}
async function renderQueue(ctx: RequestContext): Promise<Response> {
  assertCan(ctx.actor, "warranty.review");
  const status = ctx.url.searchParams.get("status") ?? undefined;
  const requests = await listWarrantyRequests(ctx.db, { status });
  const needsReview = requests.filter((request) => request.status === "needs_review").length;

  const body = html`
    <h1>Warranty requests</h1>
    <p class="lede">Submitted from hplacer.com. A request that matched one home is already a repair ticket
      in the bill-back queue; the rest are here because matching them would have been a guess.</p>

    ${tabs([
      { href: "/warranty", label: `All${needsReview ? ` (${needsReview} to review)` : ""}`, current: !status },
      ...WARRANTY_STATUSES.map((value) => ({
        href: `/warranty${query({ status: value })}`,
        label: value.replace(/_/g, " "),
        current: status === value,
      })),
    ])}

    ${requests.length === 0
      ? empty("Nothing here.")
      : requests.map(
          (request) => html`<a class="card" href="/warranty/${request.id}">
            <div class="row">
              <h3>${request.reference} — ${request.issue_summary}</h3>
              ${badge(request.status, request.status === "ticketed" ? "ok" : request.status === "needs_review" ? "warn" : "")}
            </div>
            <div class="meta">${request.customer_name}
              ${request.customer_phone ? ` · ${request.customer_phone}` : ""}
              · ${formatDate(request.created_at)}
              ${request.serial_number ? ` · ${request.serial_number}` : ""}
              ${request.ticket_number ? ` · ${request.ticket_number}` : ""}
              ${request.photo_count > 0 ? ` · ${request.photo_count} photo(s)` : ""}</div>
            ${request.status === "needs_review" ? html`<div class="meta">${request.match_reason}</div>` : ""}
          </a>`,
        )}
  `;
  return page(body, { title: "Warranty", actor: ctx.actor, section: "/warranty", back: { href: "/", label: "Today" }, flash: flashFrom(ctx.url) });
}

async function renderDetail(ctx: RequestContext): Promise<Response> {
  assertCan(ctx.actor, "warranty.review");
  const request = await requireWarrantyRequest(ctx.db, ctx.params.id);
  const candidates = parseCandidates(request);
  const photos = await listDocuments(ctx.db, { warrantyRequestId: request.id });
  const open = request.status === "needs_review";
  // Only offered when there is a decision left to make.
  const homes = open ? await listHomes(ctx.db) : [];

  const body = html`
    <h1>${request.reference}</h1>
    <p class="lede">${request.issue_summary}</p>

    <div class="card">
      <div class="row">
        ${badge(request.status, request.status === "ticketed" ? "ok" : request.status === "needs_review" ? "warn" : "")}
        ${badge(request.match_confidence, request.match_confidence === "confident" ? "ok" : "warn")}
      </div>
      ${kv([
        ["Homeowner", request.customer_name],
        ["Phone", request.customer_phone],
        ["Email", request.customer_email],
        ["Prefers", request.preferred_contact],
        ["Best time", request.best_time],
        ["Received", formatDate(request.created_at)],
      ])}
      ${request.issue_detail ? html`<p>${request.issue_detail}</p>` : ""}
    </div>

    <h2>What they told us</h2>
    <div class="card">
      ${kv([
        ["Serial number", request.reported_serial],
        ["Address", [request.reported_address, request.reported_city, request.reported_state, request.reported_postal_code].filter(Boolean).join(", ")],
      ])}
    </div>

    <h2>Matching</h2>
    <div class="card">
      ${kv([
        ["Result", `${request.match_confidence} (${request.match_method.replace(/_/g, " ")})`],
        ["Why", request.match_reason],
        ["Home", request.serial_number ? html`<a href="/homes/${request.home_id}">${request.serial_number}</a>` : "not linked"],
        ["Ticket", request.ticket_number ? html`<a href="/repairs/${request.repair_ticket_id}">${request.ticket_number}</a>` : "none yet"],
      ])}
    </div>

    ${candidates.length > 0
      ? html`<h2>Homes considered</h2>
          ${candidates.map(
            (candidate) => html`<div class="card">
              <div class="row"><h3>${candidate.serial_number}</h3>
                ${candidate.signals.map((signal) => badge(signal))}</div>
              <div class="meta">${candidate.site_address ?? "no site address"}${candidate.customer_name ? ` · ${candidate.customer_name}` : ""}</div>
              <div class="btn-row">
                <a class="btn secondary" href="/homes/${candidate.home_id}">Open home</a>
                ${open
                  ? html`<form method="post" action="/api/warranty/${request.id}/link">
                      <input type="hidden" name="home_id" value="${candidate.home_id}">
                      <input type="hidden" name="note" value="Picked from the candidates intake found">
                      <button type="submit">Link to this home</button>
                    </form>`
                  : ""}
              </div>
            </div>`,
          )}`
      : ""}

    <h2>Photos from the homeowner</h2>
    ${documentList(photos)}

    ${open
      ? html`
        <h2>Decide</h2>
        <form class="card" method="post" action="/api/warranty/${request.id}/link">
          <label for="home_id">Link to a home — this opens the repair ticket and sends it to the bill-back queue</label>
          <select id="home_id" name="home_id" required>
            <option value="">Choose a home</option>
            ${homes.map(
              (home) => html`<option value="${home.id}">${home.serial_number}${formatSiteAddress(home) ? ` — ${formatSiteAddress(home)}` : ""}</option>`,
            )}
          </select>
          <label for="link_note">Note</label>
          <input id="link_note" name="note" placeholder="How you confirmed it">
          <div class="btn-row"><button type="submit">Link and open a ticket</button></div>
        </form>

        <form class="card" method="post" action="/api/warranty/${request.id}/close">
          <label for="close_status">Or close it</label>
          <select id="close_status" name="status">
            <option value="dismissed">Not our home / not a warranty issue</option>
            <option value="duplicate">Duplicate of another request</option>
          </select>
          <label for="close_note">Reason (required)</label>
          <input id="close_note" name="note" required>
          <div class="btn-row"><button class="danger" type="submit">Close request</button></div>
        </form>`
      : html`<div class="card">${kv([
          ["Reviewed by", request.reviewed_by_name],
          ["Reviewed", request.reviewed_at ? formatDate(request.reviewed_at) : null],
          ["Notes", request.review_notes],
        ])}</div>`}
  `;

  return page(body, {
    title: request.reference,
    actor: ctx.actor,
    section: "/warranty",
    back: { href: "/warranty", label: "Warranty" },
    flash: flashFrom(ctx.url),
  });
}

async function linkRoute(ctx: RequestContext): Promise<Response> {
  assertCan(ctx.actor, "warranty.review");
  const fields = await readFields(ctx.request);
  const homeId = requiredField(fields, "home_id", "Home");
  await requireHome(ctx.db, homeId);
  const result = await linkWarrantyRequest(ctx.db, ctx.actor, ctx.params.id, homeId, optionalField(fields, "note"));
  return wantsJson(ctx) ? json(result) : redirect(`/warranty/${ctx.params.id}?ok=ticket_created`);
}

async function closeRoute(ctx: RequestContext): Promise<Response> {
  assertCan(ctx.actor, "warranty.review");
  const fields = await readFields(ctx.request);
  const status = requiredField(fields, "status", "Status");
  if (status !== "dismissed" && status !== "duplicate") throw badRequest("Close it as dismissed or duplicate");
  await closeWarrantyRequest(ctx.db, ctx.actor, ctx.params.id, status, requiredField(fields, "note", "Reason"));
  return wantsJson(ctx) ? json({ ok: true }) : redirect(`/warranty/${ctx.params.id}?ok=saved`);
}
