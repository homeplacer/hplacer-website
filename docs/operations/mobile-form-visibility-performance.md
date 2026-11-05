# Mobile contact-dock observer work

## Narrow frontend change (2026-10-06)

The contact dock watches stable inline form regions so it does not overlap an
in-page form. It must also discover late-mounted forms, follow client-side route
changes, and ignore native dialogs. Previously every child-list mutation anywhere
in the page ran a full-body `[data-form-region], form` query, including unrelated
hydration and message updates.

The observer now inspects added subtrees and the continued membership/eligibility
of previously observed regions before deciding whether a whole-page reconcile is
needed. It still reconciles when an inline region is added, removed, or moved into
a dialog. Hydration within an already observed stable region needs no new scan.
Intersection visibility, cleanup, dock keyboard exclusion, and dialog behavior
are unchanged.

The deterministic observer fixture performs 20 unrelated mutation batches after
the initial scan. The previous implementation performs 20 additional whole-page
scans; the new implementation performs zero. This is a measured reduction in
specific unnecessary work, **not** a measured CPU-time, LCP, TBT, or ranking gain.
The fixture still checks initially empty pages, late forms, route subtree additions,
removal of visible regions, dialog exclusion, stale intersection entries, and cleanup.

## Remaining performance investigation

The captured October 6 Semrush mobile report identifies homepage long tasks in
GA4, the document, and `09_plxqh4z_01.js`. The matching production build's latter
chunk contains the shared Next/React hydration runtime, not the contact form.
Its resource-level attribution does not identify the observer as the cause of
that task. GA4 loading/event plumbing remains a backend-owned dependency; this
change does not alter it, tracking events, APIs, data, fonts, or image loading.

Homepage, About, and Contact LCP elements in the captured runs are text. Mobile
PageSpeed repeats varied materially without a deployment. Establishing a release
regression or a further fix requires matched device/settings/page samples and
repeated metrics plus function-level traces, rather than the desktop/mobile score
comparison or image-byte counts alone.

A lazy inquiry-form experiment was evaluated and discarded: the initial-byte
benefit was modest and uneven, with first-open loading/failure tradeoffs on a
conversion action. The inquiry form and modal stay eager and unchanged.
