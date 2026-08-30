import { NextResponse } from "next/server";

export const runtime = "edge";

const MAX_RESUME_BYTES = 10 * 1024 * 1024;
const ACCEPTED_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);
const REQUIRED = ["name", "phone", "email", "location", "position", "experience", "consent"] as const;

function text(value: FormDataEntryValue | null, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export async function POST(request: Request) {
  const length = Number(request.headers.get("content-length") || "0");
  if (length > MAX_RESUME_BYTES + 40_000) return NextResponse.json({ error: "Resume is too large. The maximum file size is 10 MB." }, { status: 413 });
  let form: FormData;
  try { form = await request.formData(); } catch { return NextResponse.json({ error: "Invalid application form." }, { status: 400 }); }
  if (text(form.get("company"), 200)) return NextResponse.json({ ok: true }); // honeypot
  for (const key of REQUIRED) if (!text(form.get(key), key === "experience" ? 5_000 : 300)) return NextResponse.json({ error: "Please complete all required fields." }, { status: 422 });
  const email = text(form.get("email"), 300);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: "Please enter a valid email address." }, { status: 422 });
  const phone = text(form.get("phone"), 40);
  if (phone.replace(/\D/g, "").length < 7) return NextResponse.json({ error: "Please enter a valid phone number." }, { status: 422 });
  const resume = form.get("resume");
  if (resume instanceof File && resume.size > 0 && (resume.size > MAX_RESUME_BYTES || !ACCEPTED_TYPES.has(resume.type))) return NextResponse.json({ error: "Resume must be a PDF, DOC, or DOCX file no larger than 10 MB." }, { status: 422 });
  const endpoint = process.env.CAREERS_INTAKE_URL;
  const token = process.env.CAREERS_INTAKE_TOKEN;
  if (!endpoint || !token) {
    console.error("[hplacer] careers intake is not configured");
    return NextResponse.json({ error: "Applications are not ready yet. Please call Home Placer to apply." }, { status: 503 });
  }
  const forward = new FormData();
  for (const [key, value] of form.entries()) if (key !== "company" && (typeof value !== "string" || key !== "consent" || value === "yes")) forward.append(key, value);
  try {
    const response = await fetch(endpoint, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: forward, signal: AbortSignal.timeout(12_000) });
    if (!response.ok) { console.error(`[hplacer] careers intake rejected: ${response.status}`); return NextResponse.json({ error: "We could not submit your application. Please try again." }, { status: 502 }); }
  } catch (error) { console.error("[hplacer] careers intake failed", error); return NextResponse.json({ error: "We could not submit your application. Please try again." }, { status: 502 }); }
  return NextResponse.json({ ok: true });
}
