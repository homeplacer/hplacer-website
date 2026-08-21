/** Page shell, navigation, and the handful of components every page reuses. */
import { can, type Actor, type Permission } from "../auth/authz.ts";
import { html, raw, toString, type SafeHtml } from "./html.ts";
import { STYLESHEET } from "./styles.ts";

export interface PageOptions {
  title: string;
  actor: Actor;
  /** Path prefix used to light up the bottom nav, e.g. "/equipment". */
  section?: string;
  unread?: number;
  flash?: { kind: "ok" | "bad" | "info"; message: string } | null;
  back?: { href: string; label: string } | null;
}

const BOTTOM_NAV: { href: string; label: string; icon: string; permission?: Permission }[] = [
  { href: "/", label: "Today", icon: "▣" },
  { href: "/tasks", label: "Tasks", icon: "✓" },
  { href: "/equipment", label: "Equipment", icon: "⛏" },
  { href: "/homes", label: "Homes", icon: "⌂" },
  { href: "/repairs", label: "Repairs", icon: "⚑" },
];

export function page(body: SafeHtml, options: PageOptions): Response {
  const section = options.section ?? "/";
  const document = html`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex, nofollow, noarchive">
<meta name="referrer" content="same-origin">
<meta name="color-scheme" content="light dark">
<title>${options.title} · Home Placer portal</title>
<style>${raw(STYLESHEET)}</style>
</head>
<body>
<header class="top">
  <a href="/" aria-label="Portal home">HP</a>
  <span class="title">${options.title}</span>
  <span class="who">${options.actor.displayName}<br>${options.actor.roles.join(" · ")}</span>
  <a href="/notifications" aria-label="Notifications">${options.unread ? html`🔔 ${options.unread}` : "🔔"}</a>
</header>
<main>
  ${options.back ? html`<p><a href="${options.back.href}">‹ ${options.back.label}</a></p>` : ""}
  ${options.flash
    ? html`<div class="notice ${options.flash.kind === "bad" ? "bad" : options.flash.kind === "ok" ? "ok" : ""}" role="status">${options.flash.message}</div>`
    : ""}
  ${body}
  <footer class="foot">
    Home Placer employee portal · internal use only
    ${can(options.actor, "employee.manage") ? html` · <a href="/admin">Admin</a>` : ""}
  </footer>
</main>
<nav class="bottom" aria-label="Primary">
  ${BOTTOM_NAV.map(
    (item) => html`<a href="${item.href}" ${raw(isCurrent(section, item.href) ? 'aria-current="page"' : "")}>
      <span class="ico" aria-hidden="true">${item.icon}</span>${item.label}</a>`,
  )}
</nav>
</body>
</html>`;

  return new Response(toString(document), {
    status: 200,
    headers: securityHeaders({ "Content-Type": "text/html; charset=utf-8" }),
  });
}

function isCurrent(section: string, href: string): boolean {
  return href === "/" ? section === "/" : section.startsWith(href);
}

/**
 * Applied to every response. The CSP is strict because the portal serves no
 * scripts at all: an injected `<script>` has nothing to run under.
 */
export function securityHeaders(extra: Record<string, string> = {}): Headers {
  return new Headers({
    "Content-Security-Policy":
      "default-src 'none'; style-src 'unsafe-inline'; img-src 'self' data:; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",
    "Referrer-Policy": "same-origin",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    // Employee records must never sit in a shared cache.
    "Cache-Control": "no-store, private",
    ...extra,
  });
}

export function tabs(items: { href: string; label: string; current?: boolean }[]): SafeHtml {
  return html`<nav class="tabs">${items.map(
    (item) => html`<a href="${item.href}" ${raw(item.current ? 'aria-current="page"' : "")}>${item.label}</a>`,
  )}</nav>`;
}

export function statGrid(stats: { n: string | number; k: string; href?: string }[]): SafeHtml {
  return html`<div class="grid">${stats.map((stat) =>
    stat.href
      ? html`<a class="stat" style="text-decoration:none;color:inherit" href="${stat.href}"><div class="n">${stat.n}</div><div class="k">${stat.k}</div></a>`
      : html`<div class="stat"><div class="n">${stat.n}</div><div class="k">${stat.k}</div></div>`,
  )}</div>`;
}

export type BadgeTone = "" | "ok" | "warn" | "bad";

export function badge(label: string, tone: BadgeTone = ""): SafeHtml {
  return html`<span class="badge ${tone}">${label.replace(/_/g, " ")}</span>`;
}

export function empty(message: string): SafeHtml {
  return html`<p class="empty">${message}</p>`;
}

export function kv(entries: [string, unknown][]): SafeHtml {
  const rows = entries.filter(([, value]) => value !== null && value !== undefined && value !== "");
  if (rows.length === 0) return raw("");
  return html`<dl class="kv">${rows.map(([key, value]) => html`<dt>${key}</dt><dd>${value as never}</dd>`)}</dl>`;
}

/** External links always get noopener/noreferrer and an explicit new tab. */
export function externalLink(url: string | null | undefined, label: string): SafeHtml {
  if (!url) return raw("");
  return html`<a href="${url}" target="_blank" rel="noopener noreferrer external">${label} ↗</a>`;
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  return value.slice(0, 16).replace("T", " ");
}

export function money(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return "—";
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function hoursMinutes(minutes: number | null | undefined): string {
  if (!minutes) return "—";
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return hours ? `${hours} h ${rest ? `${rest} m` : ""}`.trim() : `${rest} m`;
}
