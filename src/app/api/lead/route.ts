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

interface LeadBody {
  type?: LeadType;
  name?: string;
  phone?: string;
  email?: string;
  home?: string;
  hasLand?: string;
  address?: string;
  message?: string;
}

const clean = (v?: string) => v?.trim() || null;

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

async function deliverToFub(lead: {
  type: LeadType;
  name: string | null;
  phone: string | null; // already normalized
  email: string | null;
  home: string | null;
  hasLand: string | null;
  address: string | null;
  message: string | null;
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

  const eventBody = {
    source,
    system: "Home Placer Website",
    type: typeLabel,
    message: messageParts.join(" · ") || `${typeLabel} from hplacer.com`,
    person: {
      firstName: first || "Website",
      lastName: last || (isService ? "Service" : "Lead"),
      emails: lead.email ? [{ value: lead.email }] : [],
      phones: lead.phone ? [{ value: lead.phone }] : [],
      tags,
    },
  };

  const authHeader = fubAuthHeader(key);

  const eventRes = await fetch("https://api.followupboss.com/v1/events", {
    method: "POST",
    headers: { Authorization: authHeader, "Content-Type": "application/json" },
    body: JSON.stringify(eventBody),
  });

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
      const evt = (await eventRes
        .clone()
        .json()
        .catch(() => null)) as { person?: { id?: number } } | null;
      const personId = evt?.person?.id;
      if (personId) {
        if (created) {
          const assignRes = await fetch(
            `https://api.followupboss.com/v1/people/${personId}`,
            {
              method: "PUT",
              headers: { Authorization: authHeader, "Content-Type": "application/json" },
              body: JSON.stringify({
                assignedUserId: warrantyUserId(),
                collaborators: warrantyCollaborators().map((id) => ({ id })),
              }),
            },
          );
          if (!assignRes.ok) {
            const errBody = await assignRes.text().catch(() => "<unreadable>");
            console.error(
              `[hplacer] FUB warranty assign PUT ${assignRes.status} for person ${personId}:`,
              errBody.slice(0, 500),
            );
          }
        }

        // Task for the warranty team — fires for NEW and EXISTING contacts.
        // FUB /tasks rejects a 'description' field; the text must live in 'name'.
        const issue = (
          [lead.message, lead.address ? `Address: ${lead.address}` : null]
            .filter(Boolean)
            .join(" — ") || "Service request"
        ).slice(0, 240);
        const taskRes = await fetch("https://api.followupboss.com/v1/tasks", {
          method: "POST",
          headers: { Authorization: authHeader, "Content-Type": "application/json" },
          body: JSON.stringify({
            personId,
            name: `Warranty/service request (hplacer.com): ${issue}`,
            assignedUserId: warrantyUserId(),
            dueDate: new Date().toISOString().slice(0, 10),
          }),
        });
        if (!taskRes.ok) {
          const errBody = await taskRes.text().catch(() => "<unreadable>");
          console.error(
            `[hplacer] FUB warranty task POST ${taskRes.status} for person ${personId}:`,
            errBody.slice(0, 500),
          );
        } else {
          console.log(
            `[hplacer] warranty task → user ${warrantyUserId()} for person ${personId}${created ? " (new contact, also assigned)" : ""}`,
          );
        }
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
        `<tr><td style="padding:4px 12px 4px 0;color:#6f6a62">${k}</td><td><strong>${v}</strong></td></tr>`,
    )
    .join("");

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to,
      subject: `New ${type} lead — hplacer.com`,
      html: `<h2>New ${type} lead</h2><table>${rows}</table>`,
    }),
  });
  if (!res.ok) {
    const errBody = await res.text().catch(() => "<unreadable>");
    console.error(`[hplacer] Resend ${res.status} for ${type} lead:`, errBody.slice(0, 500));
    return { ok: false, status: res.status };
  }
  return { ok: true, status: res.status };
}

export async function POST(req: Request) {
  let body: LeadBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const type: LeadType = body.type ?? "contact";
  const lead = {
    type,
    name: clean(body.name),
    phone: normalizePhone(clean(body.phone)),
    email: clean(body.email),
    home: clean(body.home),
    hasLand: clean(body.hasLand),
    address: clean(body.address),
    message: clean(body.message),
  };

  if (type === "subscribe") {
    if (!lead.email) return NextResponse.json({ error: "Email is required" }, { status: 422 });
  } else if (!lead.name || !lead.phone) {
    return NextResponse.json({ error: "Name and phone are required" }, { status: 422 });
  }

  console.log(`[hplacer] lead (${type}):`, { ...lead, at: new Date().toISOString() });

  // Fire delivery providers in parallel; never fail the user submission if a
  // provider errors — the server log is the safety net.
  const results = await Promise.allSettled([deliverToFub(lead), deliverByEmail(lead, type)]);
  results.forEach((r, i) => {
    if (r.status === "rejected") {
      console.error(`[hplacer] lead delivery ${i} failed:`, r.reason);
    } else if (!r.value.ok && !r.value.skipped) {
      console.error(`[hplacer] lead delivery ${i} non-ok:`, r.value);
    }
  });

  return NextResponse.json({ ok: true });
}
