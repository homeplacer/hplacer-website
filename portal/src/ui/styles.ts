/**
 * The portal's stylesheet, inlined into every page.
 *
 * Mobile-first and deliberately plain: crews use this one-handed, in gloves, on
 * a phone in daylight. Controls are at least 44 px, the type is large, and the
 * layout is a single column that widens on a desk monitor. No external fonts or
 * assets are fetched — the whole page is one request.
 */
export const STYLESHEET = `
:root {
  color-scheme: light dark;
  --bg: #f4f5f7;
  --surface: #ffffff;
  --surface-2: #eef0f3;
  --ink: #14181d;
  --ink-soft: #5b6672;
  --line: #d7dce2;
  --brand: #16457a;
  --brand-ink: #ffffff;
  --ok: #1b6b3a;
  --warn: #8a5a00;
  --bad: #a11b1b;
  --radius: 12px;
  --tap: 44px;
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #11151a;
    --surface: #1a2028;
    --surface-2: #232b35;
    --ink: #eef2f6;
    --ink-soft: #a3b0bd;
    --line: #313b47;
    --brand: #4d90d6;
    --brand-ink: #0b0f14;
    --ok: #63d18d;
    --warn: #e8b25a;
    --bad: #f0837f;
  }
}
* { box-sizing: border-box; }
body {
  margin: 0;
  padding: 0 0 5.5rem;
  background: var(--bg);
  color: var(--ink);
  font: 16px/1.5 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  -webkit-text-size-adjust: 100%;
}
a { color: var(--brand); }
header.top {
  position: sticky; top: 0; z-index: 20;
  display: flex; align-items: center; gap: .75rem;
  padding: .75rem 1rem;
  background: var(--brand); color: var(--brand-ink);
}
header.top a { color: var(--brand-ink); text-decoration: none; }
header.top .title { font-weight: 700; font-size: 1.05rem; flex: 1; }
header.top .who { font-size: .8rem; opacity: .85; text-align: right; }
main { padding: 1rem; max-width: 60rem; margin: 0 auto; }
h1 { font-size: 1.35rem; margin: 0 0 .25rem; }
h2 { font-size: 1.05rem; margin: 1.5rem 0 .5rem; }
h3 { font-size: .95rem; margin: 0 0 .25rem; }
p.lede { color: var(--ink-soft); margin: 0 0 1rem; }
.card {
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  padding: .875rem 1rem;
  margin-bottom: .75rem;
}
a.card { display: block; text-decoration: none; color: inherit; }
a.card:active { background: var(--surface-2); }
.card .meta { color: var(--ink-soft); font-size: .85rem; }
.row { display: flex; gap: .5rem; align-items: center; justify-content: space-between; }
.stack { display: flex; flex-direction: column; gap: .35rem; }
.grid { display: grid; gap: .75rem; grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr)); }
.stat { background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius); padding: .75rem; }
.stat .n { font-size: 1.6rem; font-weight: 700; line-height: 1.1; }
.stat .k { color: var(--ink-soft); font-size: .8rem; }
.badge {
  display: inline-block; padding: .15rem .5rem; border-radius: 999px;
  font-size: .75rem; font-weight: 600; border: 1px solid var(--line);
  background: var(--surface-2); color: var(--ink-soft); white-space: nowrap;
}
.badge.ok { color: var(--ok); border-color: currentColor; }
.badge.warn { color: var(--warn); border-color: currentColor; }
.badge.bad { color: var(--bad); border-color: currentColor; }
dl.kv { display: grid; grid-template-columns: minmax(7rem, auto) 1fr; gap: .3rem .75rem; margin: .5rem 0 0; }
dl.kv dt { color: var(--ink-soft); font-size: .85rem; }
dl.kv dd { margin: 0; font-size: .9rem; word-break: break-word; }
form { margin: 0; }
fieldset { border: 1px solid var(--line); border-radius: var(--radius); padding: .75rem; margin: 0 0 .75rem; background: var(--surface); }
legend { font-weight: 600; font-size: .9rem; padding: 0 .35rem; }
label { display: block; font-size: .85rem; color: var(--ink-soft); margin: .6rem 0 .2rem; }
input, select, textarea {
  width: 100%; min-height: var(--tap); padding: .5rem .6rem; font: inherit;
  color: var(--ink); background: var(--surface); border: 1px solid var(--line); border-radius: 8px;
}
textarea { min-height: 5rem; }
input[type=checkbox], input[type=radio] { width: auto; min-height: auto; }
button, .btn {
  display: inline-flex; align-items: center; justify-content: center;
  min-height: var(--tap); padding: .5rem 1rem; gap: .4rem;
  font: inherit; font-weight: 600; cursor: pointer; text-decoration: none;
  background: var(--brand); color: var(--brand-ink); border: 1px solid transparent; border-radius: 8px;
}
.btn.secondary, button.secondary { background: var(--surface); color: var(--ink); border-color: var(--line); }
.btn.danger, button.danger { background: var(--bad); color: #fff; }
.btn-row { display: flex; flex-wrap: wrap; gap: .5rem; margin-top: .75rem; }
.check-row {
  display: grid; grid-template-columns: 1fr auto; gap: .5rem;
  align-items: center; padding: .6rem 0; border-bottom: 1px solid var(--line);
}
.check-row:last-of-type { border-bottom: 0; }
.check-row .q { font-size: .92rem; }
.check-row .opts { display: flex; gap: .25rem; }
.check-row .opts label {
  margin: 0; min-width: var(--tap); min-height: var(--tap);
  display: flex; align-items: center; justify-content: center;
  border: 1px solid var(--line); border-radius: 8px; font-size: .78rem; font-weight: 600;
  color: var(--ink); background: var(--surface-2); cursor: pointer;
}
.check-row .opts input { position: absolute; opacity: 0; pointer-events: none; }
.check-row .opts input:checked + span { text-decoration: underline; }
.check-row .opts label:has(input:checked) { background: var(--brand); color: var(--brand-ink); border-color: var(--brand); }
.notice { border-left: 4px solid var(--brand); padding: .6rem .8rem; background: var(--surface); border-radius: 8px; margin-bottom: 1rem; }
.notice.bad { border-left-color: var(--bad); }
.notice.ok { border-left-color: var(--ok); }
.table-wrap { overflow-x: auto; }
table { width: 100%; border-collapse: collapse; font-size: .85rem; }
th, td { text-align: left; padding: .45rem .5rem; border-bottom: 1px solid var(--line); vertical-align: top; }
th { color: var(--ink-soft); font-weight: 600; }
nav.tabs { display: flex; gap: .4rem; overflow-x: auto; margin-bottom: .75rem; padding-bottom: .25rem; }
nav.tabs a {
  white-space: nowrap; padding: .45rem .75rem; border-radius: 999px; text-decoration: none;
  border: 1px solid var(--line); background: var(--surface); color: var(--ink); font-size: .85rem;
}
nav.tabs a[aria-current=page] { background: var(--brand); color: var(--brand-ink); border-color: var(--brand); }
nav.bottom {
  position: fixed; bottom: 0; left: 0; right: 0; z-index: 30;
  display: grid; grid-template-columns: repeat(5, 1fr);
  background: var(--surface); border-top: 1px solid var(--line);
  padding-bottom: env(safe-area-inset-bottom);
}
nav.bottom a {
  min-height: var(--tap); display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: .1rem; font-size: .7rem; text-decoration: none; color: var(--ink-soft); padding: .4rem 0;
}
nav.bottom a[aria-current=page] { color: var(--brand); font-weight: 700; }
nav.bottom .ico { font-size: 1.1rem; line-height: 1; }
.empty { color: var(--ink-soft); font-size: .9rem; padding: 1.5rem 0; text-align: center; }
.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
footer.foot { color: var(--ink-soft); font-size: .75rem; padding: 1.5rem 1rem 0; text-align: center; }
`;
