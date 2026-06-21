import { NextResponse } from "next/server";

// Unified lead intake for every form on the site (contact, financing apply,
// email subscribe). Validates, then DELIVERS via whatever is configured —
// nothing is required, so the form works in dev and "self-arms" at go-live when
// env vars are set:
//   FUB_API_KEY            → creates an event/person in Follow Up Boss
//   RESEND_API_KEY         → emails the team (LEADS_TO, default leads@hplacer.com)
// Always logs server-side as a fallback record.

type LeadType = "contact" | "financing" | "subscribe";

interface LeadBody {
  type?: LeadType;
  name?: string;
  phone?: string;
  email?: string;
  home?: string;
  hasLand?: string;
  message?: string;
}

const clean = (v?: string) => v?.trim() || null;

function splitName(name: string | null): { first: string; last: string } {
  if (!name) return { first: "", last: "" };
  const parts = name.split(/\s+/);
  return { first: parts[0], last: parts.slice(1).join(" ") };
}

async function deliverToFub(lead: {
  type: LeadType;
  name: string | null;
  phone: string | null;
  email: string | null;
  home: string | null;
  hasLand: string | null;
  message: string | null;
}) {
  const key = process.env.FUB_API_KEY;
  if (!key) return { ok: false, skipped: "no FUB_API_KEY" };

  const { first, last } = splitName(lead.name);
  const typeLabel =
    lead.type === "financing"
      ? "Financing Inquiry"
      : lead.type === "subscribe"
        ? "Registration"
        : "General Inquiry";
  const messageParts = [
    lead.message,
    lead.home ? `Interested in: ${lead.home}` : null,
    lead.hasLand ? `Has land: ${lead.hasLand}` : null,
  ].filter(Boolean);

  const body = {
    source: "hplacer.com",
    system: "Home Placer Website",
    type: typeLabel,
    message: messageParts.join(" · ") || `${typeLabel} from hplacer.com`,
    person: {
      firstName: first || "Website",
      lastName: last || "Lead",
      emails: lead.email ? [{ value: lead.email }] : [],
      phones: lead.phone ? [{ value: lead.phone }] : [],
      tags: ["hplacer.com", lead.type],
    },
  };

  const res = await fetch("https://api.followupboss.com/v1/events", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${key}:`).toString("base64")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  return { ok: res.ok, status: res.status };
}

async function deliverByEmail(lead: Record<string, string | null>, type: LeadType) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { ok: false, skipped: "no RESEND_API_KEY" };

  const to = process.env.LEADS_TO || "leads@hplacer.com";
  const from = process.env.LEADS_FROM || "Home Placer <leads@hplacer.com>";
  const rows = Object.entries(lead)
    .filter(([, v]) => v)
    .map(([k, v]) => `<tr><td style="padding:4px 12px 4px 0;color:#6f6a62">${k}</td><td><strong>${v}</strong></td></tr>`)
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
  return { ok: res.ok, status: res.status };
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
    phone: clean(body.phone),
    email: clean(body.email),
    home: clean(body.home),
    hasLand: clean(body.hasLand),
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
    if (r.status === "rejected") console.error(`[hplacer] lead delivery ${i} failed:`, r.reason);
  });

  return NextResponse.json({ ok: true });
}
