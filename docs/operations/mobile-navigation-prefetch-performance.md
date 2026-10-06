# Mobile navigation prefetch

The persistent mobile dock previously asked Next to automatically prefetch all
four destinations as soon as it hydrated. It now waits until a visitor points at,
focuses, or touches a dock link, then restores Next's default prefetch behavior for
that destination. The existing anchor, click behavior, current-page indication,
labels, and keyboard order are unchanged. Clicking never waits for prefetch to
finish; a destination without cached data is fetched during navigation.

This is a scoped reduction in speculative network and client work, not a claim
that the outstanding mobile Core Web Vitals failures have been cleared.

## Evidence before the change

The completed October 6, 2026 matched SEMrush sample still reported poor mobile
results for `/about`, `/homes/ultra-flex-28-68`, and two legacy contact query URLs.
The homepage had 598 ms TBT. All ten matching desktop results were good.

Independent private cold About Lighthouse captures had simulated LCP of 2,192
and 2,176 ms, with TBT of 9 and 3 ms. They used mobile form factor, simulated
1,638.4 Kbps / 150 ms RTT / 4x CPU slowdown, and an existing 412x823 device
emulation with Lighthouse's own screen emulation disabled. Those conditions do
not establish equivalence with SEMrush's mobile setup.

The About LCP element was its first body paragraph. In the recorded warm trace,
actual FCP/LCP occurred at 745.2 ms; automatic route requests began at 762.3 ms.
The two cold audit breakdowns likewise placed actual LCP at 771.0 and 683.3 ms,
before route requests began at 836.7 and 703.4 ms. This evidence does not show
automatic dock prefetch as the cause of About's LCP delay.

Those cold captures requested `/homes`, `/land-packages`, and `/contact`
speculatively: 19-26 KB transferred and 86-105 KB decoded across their RSC
requests, plus approximately 6.6 KB transferred / 29.9 KB decoded of homes-only
JavaScript. These are observed baseline costs, not measured patch savings.

The header logo still uses automatic homepage prefetch. Other visible links,
including the homepage's Homes link, can independently prefetch a destination.
This patch changes only the persistent dock; it cannot promise zero speculative
requests for a route reached by another visible link.

Direct October 6 read-only requests to `/contact` and both sampled query variants
returned identical 68,813-byte HTML, identical ETags, and cache HIT responses.
No current query-specific HTML or caching fault was established by that check.

## Validation and release gate

- Production baseline and candidate builds both succeed on Next 16.3.8; all 253
  repository tests, focused ESLint, TypeScript, and diff checks pass. The About
  HTML is 69,659 bytes in both builds, and its dock markup is byte-identical.
- The changed declared client chunk grows by 120 raw bytes, 49 gzip bytes, and
  48 Brotli bytes. The other nine declared About script payloads are identical.
- Unit checks exercise initial suppression, pointer/focus/touch intent, exact
  hrefs, current-page indication, immediate click semantics, and server anchors.
- Compare baseline and candidate production Next builds using the same private
  browser/device/network/CPU configuration and a cold cache. Count initial RSC
  and route-only script requests, and record LCP, TBT, and CLS across repeats.
- Check all four dock destinations with pointer, touch, and keyboard navigation.
  Confirm a click works when a prefetch response is still pending and confirm
  the anchors work without JavaScript. Never submit a production test lead.
- Keep any performance conclusion limited to the measured configuration. A
  reviewed PR and a user's deployment instruction are required for production.

Matched cold browser comparison and real pointer/touch/keyboard navigation
checks remain partly pending. Actual browser QA at a 375 px viewport observed
nine initial RSC requests in the baseline and five in the candidate: four fewer
requests for two destinations, Homes and Contact. Home and Packages still
prefetched, including Packages through its visible inline link. This is observed
request suppression at that viewport, not a measured byte or CWV improvement.

Keyboard focus on Homes restored two Homes RSC requests; Enter navigated to its
correct heading and active label without horizontal overflow. An immediate click
on Contact without prior focus navigated to its correct heading. A native
Lighthouse comparison, throttled in-flight click, touch interaction, and actual
no-JavaScript navigation checks remain pending. The unit checks alone establish
Link props and preserved server markup, not those remaining browser outcomes.

Installed Next 16.3.8 documentation used:
`node_modules/next/dist/docs/01-app/01-getting-started/04-linking-and-navigating.md`
and `node_modules/next/dist/docs/01-app/02-guides/prefetching.md`. Both document
`prefetch={false}` for opting out and `prefetch={null}` for restoring defaults
after user intent. The existing `next/font` swap behavior, hero/media requests,
backend routes, and tracking code were not modified.
