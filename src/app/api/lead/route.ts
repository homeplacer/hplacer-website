import { NextResponse } from "next/server";

// Unified lead intake for every form on the site (contact, financing apply,
// email subscribe, service/warranty). Validates, then DELIVERS via whatever is
// configured — nothing is required, so the form works in dev and "self-arms" at
// go-live when env vars are set:
//   FUB_API_KEY                → creates an event/person in Follow Up Boss
//   RESEND_API_KEY             → emails the team (LEADS_TO, default leads@hplacer.com)
//   FUB_WARRANTY_USER_ID       → owner for NEW service leads (default 39 = Brett)
//   FUB_WARRANTY_COLLABORATORS → CSV of collaborator ids (default 1,35,46 = Joe,Tara,Wade)
// Always logs server-side as a fallback record. Same-origin form posts → no CORS.
//
// RESILIENCE (R6): every FUB/Resend call retries transient failures (429/5xx/
// network) with backoff; warranty routing ids are validated against FUB so a
// stale FUB_WARRANTY_USER_ID can't silently swallow assignments; and if neither
// channel captures a lead we emit a single greppable "CRITICAL LEAD_NOT_DELIVERED"
// marker with the full payload. (Durable KV/Queue outbox = follow-up; needs a
// Worker binding.)
//
// FUB /v1/events auto-merges a person by email OR phone (201 = new person,
// 200 = matched an existing person). We normalize the phone to E.164 to maximize
// that match rate and always send both email + phone when present.
//
// SERVICE/WARRANTY ROUTING is deliberately SAFE (standing rule: never
// reassign/steal a lead that already has a relationship owner or sits in a
// protected stage). Every service request stamps source/tags/message so it lands
// on the person's timeline no matter who owns them. We ONLY set an owner +
// collaborators when the person was NEWLY created (201) — a brand-new contact
// with no owner to step on. For an existing contact (200) we touch nothing on the
// person; a FUB Lead Flow rule keyed on source "Home Placer Warranty" handles the
// team notification without any hardcoded reassignment.

type LeadType = "contact" | "financing" | "subscribe" | "service";

// First-touch attribution forwarded by the browser (see src/lib/attribution.ts).
// All optional — older clients / blocked storage simply omit it.
interface Attribution {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  gclid?: string;
  fbclid?: string;
  referrer?: string;
  landing_page?: string;
  captured_at?: string;
}

interface LeadBody {
  type?: LeadType;
  name?: string;
  phone?: string;
  email?: string;
  home?: string;
  hasLand?: string;
  address?: string;
  message?: string;
  attribution?: Attribution;
  // Honeypot decoy (see src/components/honeypot.tsx). Real users never fill it;
  // a non-empty value means a bot, and the submission is dropped.
  company?: string;
}

// Trim, drop empties, and cap length so an oversized field can't flood logs or
// the FUB/Resend payload. Default cap suits short fields; message overrides it.
const clean = (v?: string, max = 500) => {
  const t = v?.trim();
  return t ? t.slice(0, max) : null;
};

// Escape user input before interpolating it into the notification email's HTML.
const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

// Human-readable order for the attribution block appended to the FUB message.
const ATTR_LABELS: [keyof Attribution, string][] = [
  ["utm_source", "Source"],
  ["utm_medium", "Medium"],
  ["utm_campaign", "Campaign"],
  ["utm_content", "Content"],
  ["utm_term", "Term"],
  ["gclid", "Google Click ID"],
  ["fbclid", "Facebook Click ID"],
  ["referrer", "Referrer"],
  ["landing_page", "Landing page"],
];

// Render a clearly-delimited, human-readable attribution block for the FUB
// timeline. Returns "" when there's nothing worth showing (e.g. direct visit
// with no UTMs/referrer) so we never add noise.
function formatAttributionBlock(a?: Attribution): string {
  if (!a) return "";
  const lines = ATTR_LABELS.map(([k, label]) =>
    a[k] ? `${label}: ${a[k]}` : null,
  ).filter(Boolean);
  if (!lines.length) return "";
  return `\n\n— Attribution (first touch) —\n${lines.join("\n")}`;
}

function splitName(name: string | null): { first: string; last: string } {
  if (!name) return { first: "", last: "" };
  const parts = name.split(/\s+/);
  return { first: parts[0], last: parts.slice(1).join(" ") };
}

// Normalize to E.164 to maximize FUB's email/phone auto-merge match rate.
// US-centric: 10 digits → +1XXXXXXXXXX; 11 digits starting with 1 → +1...;
// already-international (leading +) is kept; an unrecognized shape is returned as
// bare digits rather than dropped, so a real number is never silently lost.
function normalizePhone(raw: string | null): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  const hadPlus = trimmed.startsWith("+");
  const d = trimmed.replace(/\D/g, "");
  if (!d) return null;
  if (hadPlus) return `+${d}`;
  if (d.length === 10) return `+1${d}`;
  if (d.length === 11 && d.startsWith("1")) return `+${d}`;
  return d;
}

const warrantyUserId = (): number => {
  const v = parseInt(process.env.FUB_WARRANTY_USER_ID || "39", 10);
  return Number.isFinite(v) ? v : 39;
};

const warrantyCollaborators = (): number[] =>
  (process.env.FUB_WARRANTY_COLLABORATORS || "1,35,46")
    .split(",")
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => Number.isFinite(n));

function fubAuthHeader(key: string): string {
  return `Basic ${Buffer.from(`${key}:`).toString("base64")}`;
}

// --- Resilience (R6) -------------------------------------------------------
// A transient FUB/Resend hiccup (network blip, 429 rate-limit, 5xx) must not
// drop a lead. Retry those a few times with exponential backoff + jitter; treat
// 4xx (bad request / auth) as permanent and return immediately. Never throws on
// a normal HTTP error response — only rethrows the last *network* error after
// exhausting attempts, so callers keep their existing status-based handling.
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchWithRetry(
  url: string,
  init: RequestInit,
  label: string,
  attempts = 3,
): Promise<Response> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, init);
      // Success, a permanent (non-retryable) error, or the last try → return.
      if (res.ok || !RETRYABLE_STATUS.has(res.status) || i === attempts - 1) {
        return res;
      }
      console.warn(`[hplacer] ${label} ${res.status} — retry ${i + 1}/${attempts - 1}`);
    } catch (e) {
      lastErr = e;
      if (i === attempts - 1) throw e;
      console.warn(`[hplacer] ${label} network error — retry ${i + 1}/${attempts - 1}:`, e);
    }
    await sleep(250 * 2 ** i + Math.floor(Math.random() * 100));
  }
  // Unreachable (the loop returns or throws on the last attempt) — satisfies TS.
  throw lastErr ?? new Error(`[hplacer] ${label} exhausted retries`);
}

// Validate warranty-routing ids against FUB so a stale/typo'd FUB_WARRANTY_USER_ID
// (or collaborator id) can't silently swallow assignments (R6). Cached per-isolate
// with a short TTL — the ids change ~never, so this is one GET per id per ~10 min.
const USER_VALID_TTL_MS = 10 * 60 * 1000;
const userValidCache = new Map<number, { ok: boolean; at: number }>();

async function isValidFubUser(id: number, authHeader: string): Promise<boolean> {
  const now = Date.now();
  const cached = userValidCache.get(id);
  if (cached && now - cached.at < USER_VALID_TTL_MS) return cached.ok;
  try {
    const res = await fetchWithRetry(
      `https://api.followupboss.com/v1/users/${id}`,
      { headers: { Authorization: authHeader } },
      `FUB validate user ${id}`,
    );
    const ok = res.ok;
    userValidCache.set(id, { ok, at: now });
    if (!ok) {
      console.error(
        `[hplacer] CRITICAL FUB_WARRANTY config: user id ${id} not valid (${res.status}). ` +
          `Fix the secret — warranty leads are still captured but won't auto-assign to this id.`,
      );
    }
    return ok;
  } catch (e) {
    // Couldn't reach FUB to validate — don't block routing on the validator.
    // Assume valid and let the actual assign/task call log if it then fails.
    console.warn(`[hplacer] could not validate FUB user ${id} (assuming ok):`, e);
    return true;
  }
}

async function deliverToFub(lead: {
  type: LeadType;
  name: string | null;
  phone: string | null; // already normalized
  email: string | null;
  home: string | null;
  hasLand: string | null;
  address: string | null;
  message: string | null;
  attribution?: Attribution;
}): Promise<{ ok: boolean; skipped?: string; status?: number }> {
  const key = process.env.FUB_API_KEY;
  if (!key) return { ok: false, skipped: "no FUB_API_KEY" };

  const isService = lead.type === "service";
  const { first, last } = splitName(lead.name);

  const typeLabel =
    lead.type === "financing"
      ? "Financing Inquiry"
      : lead.type === "subscribe"
        ? "Registration"
        : isService
          ? "Service Request"
          : "General Inquiry";

  const messageParts = [
    lead.message,
    lead.home ? `Interested in: ${lead.home}` : null,
    lead.hasLand ? `Has land: ${lead.hasLand}` : null,
    lead.address ? `Home address: ${lead.address}` : null,
  ].filter(Boolean);

  // Service requests route to the warranty program; everything else is a normal
  // website lead. Tags/source on the EVENT attach to the person regardless of
  // who owns them — this never steals a lead.
  const source = isService ? "Home Placer Warranty" : "hplacer.com";
  const tags = isService
    ? ["hplacer.com", "Service Request", "Warranty"]
    : ["hplacer.com", lead.type];

  // Attribution: append a visible block to the message (always shows on the
  // person's timeline) AND set the native FUB event fields where they map, so
  // Joe can see where the lead came from straight on the record.
  const a = lead.attribution;
  const baseMessage = messageParts.join(" · ") || `${typeLabel} from hplacer.com`;
  const message = baseMessage + formatAttributionBlock(a);

  const eventBody: Record<string, unknown> = {
    source,
    system: "Home Placer Website",
    type: typeLabel,
    message,
    person: {
      firstName: first || "Website",
      lastName: last || (isService ? "Service" : "Lead"),
      emails: lead.email ? [{ value: lead.email }] : [],
      phones: lead.phone ? [{ value: lead.phone }] : [],
      tags,
    },
  };

  // Native FUB event attribution fields (best-effort; FUB ignores blanks).
  // pageUrl = the first landing URL (carries the UTMs); referrer = external
  // source; campaign = utm_campaign. The message block above is the guaranteed
  // fallback if FUB drops any of these.
  if (a?.landing_page) eventBody.pageUrl = a.landing_page;
  if (a?.referrer) eventBody.referrer = a.referrer;
  if (a?.utm_campaign) eventBody.campaign = a.utm_campaign;

  const authHeader = fubAuthHeader(key);

  const eventRes = await fetchWithRetry(
    "https://api.followupboss.com/v1/events",
    {
      method: "POST",
      headers: { Authorization: authHeader, "Content-Type": "application/json" },
      body: JSON.stringify(eventBody),
    },
    `FUB /events ${lead.type}`,
  );

  if (!eventRes.ok) {
    const errBody = await eventRes.text().catch(() => "<unreadable>");
    console.error(
      `[hplacer] FUB /events ${eventRes.status} for ${lead.type} lead:`,
      errBody.slice(0, 500),
    );
    return { ok: false, status: eventRes.status };
  }

  // 201 = a brand-new person was created; 200 = matched an existing person.
  const created = eventRes.status === 201;

  // SAFE warranty routing (service requests only). Neither step ever steals a
  // lead from an existing relationship owner:
  //   1. If the contact is brand NEW (201), assign it to the warranty owner +
  //      collaborators. An EXISTING contact (200) is never reassigned.
  //   2. ALWAYS open a task for the warranty owner so the team actively follows
  //      up on every service request — including existing homeowners already
  //      owned by their sales agent (the common case). A task notifies + tracks
  //      without touching ownership or stage.
  // Any failure here is logged and never fails the user's submission.
  if (isService) {
    try {
      // FUB /events returns the matched/created PERSON object directly, with the
      // id at the TOP level (not nested under a "person" key).
      const evt = (await eventRes
        .clone()
        .json()
        .catch(() => null)) as { id?: number } | null;
      const personId = evt?.id;
      if (personId) {
        // Validate the configured warranty ids before using them (R6): a stale
        // owner id would otherwise 400 the assign and be dropped silently, and a
        // task assigned to a bad id would fail too. Owner must be valid to assign;
        // collaborators are filtered to the valid subset.
        const ownerId = warrantyUserId();
        const collabIds = warrantyCollaborators();
        // Validate owner + collaborators in ONE parallel batch — was sequential
        // (up to 4 serial FUB GETs on a cold isolate before routing could fire).
        const [ownerOk, ...collabOk] = await Promise.all([
          isValidFubUser(ownerId, authHeader),
          ...collabIds.map((id) => isValidFubUser(id, authHeader)),
        ]);
        const validCollaborators = collabIds.filter((_, i) => collabOk[i]);

        if (created && ownerOk) {
          const assignRes = await fetchWithRetry(
            `https://api.followupboss.com/v1/people/${personId}`,
            {
              method: "PUT",
              headers: { Authorization: authHeader, "Content-Type": "application/json" },
              body: JSON.stringify({
                assignedUserId: ownerId,
                collaborators: validCollaborators.map((id) => ({ id })),
              }),
            },
            `FUB warranty assign person ${personId}`,
          );
          if (!assignRes.ok) {
            const errBody = await assignRes.text().catch(() => "<unreadable>");
            console.error(
              `[hplacer] FUB warranty assign PUT ${assignRes.status} for person ${personId}:`,
              errBody.slice(0, 500),
            );
          }
        } else if (created && !ownerOk) {
          console.error(
            `[hplacer] warranty assign SKIPPED for new person ${personId}: ` +
              `warranty owner id ${ownerId} is not a valid FUB user. Task created unassigned.`,
          );
        }

        // Task for the warranty team — fires for NEW and EXISTING contacts.
        // FUB /tasks rejects a 'description' field; the text must live in 'name'.
        // Assign to the warranty owner only when it's a valid id; otherwise leave
        // the task unassigned so it still lands (FUB routes to the person's owner)
        // instead of the whole POST 400-ing on a bad assignedUserId.
        const issue = (
          [lead.message, lead.address ? `Address: ${lead.address}` : null]
            .filter(Boolean)
            .join(" — ") || "Service request"
        ).slice(0, 240);
        const taskBody: Record<string, unknown> = {
          personId,
          name: `Warranty/service request (hplacer.com): ${issue}`,
          dueDate: new Date().toISOString().slice(0, 10),
        };
        if (ownerOk) taskBody.assignedUserId = ownerId;
        const taskRes = await fetchWithRetry(
          "https://api.followupboss.com/v1/tasks",
          {
            method: "POST",
            headers: { Authorization: authHeader, "Content-Type": "application/json" },
            body: JSON.stringify(taskBody),
          },
          `FUB warranty task person ${personId}`,
        );
        if (!taskRes.ok) {
          const errBody = await taskRes.text().catch(() => "<unreadable>");
          console.error(
            `[hplacer] FUB warranty task POST ${taskRes.status} for person ${personId}:`,
            errBody.slice(0, 500),
          );
        } else {
          console.log(
            `[hplacer] warranty task → ${ownerOk ? `user ${ownerId}` : "unassigned (invalid owner id)"} ` +
              `for person ${personId}${created && ownerOk ? " (new contact, also assigned)" : ""}`,
          );
        }
      } else {
        // The event still created/merged the person (lead captured), but without an
        // id we can't assign an owner or open the follow-up task — surface it so a
        // FUB response-shape change doesn't silently drop warranty routing.
        console.error(
          "[hplacer] warranty: FUB /events returned no personId — assign + task skipped " +
            "(lead still captured, but no owner/collaborators/follow-up task).",
        );
      }
    } catch (e) {
      console.error("[hplacer] warranty routing step errored:", e);
    }
  }

  return { ok: true, status: eventRes.status };
}

async function deliverByEmail(
  lead: Record<string, string | null>,
  type: LeadType,
): Promise<{ ok: boolean; skipped?: string; status?: number }> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { ok: false, skipped: "no RESEND_API_KEY" };

  const isService = type === "service";
  const to =
    (isService && process.env.WARRANTY_LEADS_TO) ||
    process.env.LEADS_TO ||
    "leads@hplacer.com";
  const from = process.env.LEADS_FROM || "Home Placer <leads@hplacer.com>";
  const rows = Object.entries(lead)
    .filter(([, v]) => v)
    .map(
      ([k, v]) =>
        `<tr><td style="padding:4px 12px 4px 0;color:#6f6a62">${escapeHtml(k)}</td><td><strong>${escapeHtml(String(v))}</strong></td></tr>`,
    )
    .join("");

  const res = await fetchWithRetry(
    "https://api.resend.com/emails",
    {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to,
        subject: `New ${type} lead — hplacer.com`,
        html: `<h2>New ${type} lead</h2><table>${rows}</table>`,
      }),
    },
    `Resend ${type}`,
  );
  if (!res.ok) {
    const errBody = await res.text().catch(() => "<unreadable>");
    console.error(`[hplacer] Resend ${res.status} for ${type} lead:`, errBody.slice(0, 500));
    return { ok: false, status: res.status };
  }
  return { ok: true, status: res.status };
}

export async function POST(req: Request) {
  // Reject oversized bodies early — a lead is a handful of short fields, so a
  // multi-MB POST is abuse (log-flood / cheap DoS on the Worker).
  const contentLength = Number(req.headers.get("content-length") || 0);
  if (contentLength > 32_768) {
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  }

  let body: LeadBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Honeypot: the hidden "company" field is invisible to real users, so any value
  // is a bot. Drop it silently — return a normal 200 so the bot gets no signal —
  // without delivering to FUB/Resend or logging a lead.
  if (typeof body.company === "string" && body.company.trim()) {
    console.log("[hplacer] lead dropped: honeypot tripped");
    return NextResponse.json({ ok: true });
  }

  const type: LeadType = body.type ?? "contact";

  // Sanitize forwarded attribution: known keys only, trimmed, length-capped.
  const rawAttr = body.attribution ?? {};
  const ATTR_KEYS: (keyof Attribution)[] = [
    "utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term",
    "gclid", "fbclid", "referrer", "landing_page", "captured_at",
  ];
  const attribution: Attribution = {};
  for (const k of ATTR_KEYS) {
    const v = rawAttr[k];
    if (typeof v === "string" && v.trim()) attribution[k] = v.trim().slice(0, 500);
  }

  const lead = {
    type,
    name: clean(body.name),
    phone: normalizePhone(clean(body.phone)),
    email: clean(body.email),
    home: clean(body.home),
    hasLand: clean(body.hasLand),
    address: clean(body.address),
    message: clean(body.message, 5000),
    attribution,
  };

  if (type === "subscribe") {
    if (!lead.email) return NextResponse.json({ error: "Email is required" }, { status: 422 });
  } else if (!lead.name || !lead.phone) {
    return NextResponse.json({ error: "Name and phone are required" }, { status: 422 });
  }

  console.log(`[hplacer] lead (${type}):`, { ...lead, at: new Date().toISOString() });

  // Email gets the scalar fields plus flattened attribution (its row renderer
  // expects a flat string map, not the nested attribution object).
  const emailLead: Record<string, string | null> = {
    name: lead.name,
    phone: lead.phone,
    email: lead.email,
    home: lead.home,
    hasLand: lead.hasLand,
    address: lead.address,
    message: lead.message,
    ...attribution,
  };

  // Fire delivery providers in parallel; never fail the user submission if a
  // provider errors — delivery has its own retries, and the log is the safety net.
  const [fubSettled, emailSettled] = await Promise.allSettled([
    deliverToFub(lead),
    deliverByEmail(emailLead, type),
  ]);

  const toResult = (
    s: PromiseSettledResult<{ ok: boolean; skipped?: string; status?: number }>,
  ): { ok: boolean; skipped?: string; status?: number; error?: string } =>
    s.status === "fulfilled" ? s.value : { ok: false, error: String(s.reason) };

  const fub = toResult(fubSettled);
  const email = toResult(emailSettled);

  if (!fub.ok && !fub.skipped) console.error(`[hplacer] FUB delivery non-ok:`, fub);
  if (!email.ok && !email.skipped) console.error(`[hplacer] email delivery non-ok:`, email);

  // Guaranteed no-silent-loss (R6): if NEITHER channel durably captured the lead,
  // emit ONE greppable, alert-ready marker carrying the full payload so it can be
  // recovered/replayed. (A durable KV/Queue outbox is the follow-up hardening —
  // it needs a Worker binding; see HANDOFF.) A "skipped" channel (no key set) is
  // not a failure, but it also didn't capture the lead — so a skipped FUB + failed
  // email, or vice-versa, still trips this.
  if (!fub.ok && !email.ok) {
    console.error(
      "[hplacer] CRITICAL LEAD_NOT_DELIVERED",
      JSON.stringify({ lead, fub, email, at: new Date().toISOString() }),
    );
  }

  return NextResponse.json({ ok: true });
}
