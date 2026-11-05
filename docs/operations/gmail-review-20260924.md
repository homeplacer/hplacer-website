# Gmail integration review — September 24, 2026

Reviewed open PR https://github.com/homeplacer/hplacer-website/pull/21 against released portal main419511d in an isolated local readiness worktree. Fixes were verified locally, then reconciled onto the existing PR branch through a history-preserving merge after explicit commit/push approval.

## Fixed findings
- Migration collision: Gmail migration renumbered0016 after released parts/work-detail migrations0014/0015.
- Overlapping importer invocations: atomic expiring lease, guarded release on failure, bounded network calls.
- Pagination lost-mail risk: frozen query window across resumed pages and cursor advanced only to scan start.
- False identifier extraction: ordinary order prose and phone/invoice numbers no longer become order/tracking candidates; ambiguous multiple packages remain unlinked; canonical tracking requires a full-value match.
- Review race: concurrently received/cancelled material requests cannot be reopened by delayed review.
- Lost notifications: linking and notifications now commit in the same transaction; failure rolls back for retry.
- Uninspectable receipts: reviewer-only staged downloads and linked receipt visibility on material requests, using existing document access checks.
- Silent failures: redacted importer error state and generic review-queue warning, including failed-event count.

## Verification
- npm run portal:check: TypeScript,321tests, ESLint pass.
- Wrangler deployment dry-run succeeds (no deployment).
- Git diff whitespace checks pass.
- Regression coverage includes concurrent polls, stable resumed query, tracking false positives, received/cancelled races, transaction rollback/retry, staged attachment authorization/ID isolation, private download headers, linked document access, and redacted error warnings.

## Remaining gates and limitations
- Owner must confirm Google Workspace organization/project ownership, internal audience, administrator policy and retention rules; currently Cloud Console only exposed Forturro, relationship to Home Placer unverified.
- No OAuth client/token or production secrets created; mailbox contents not accessed.
- No remote migration, deployment, production merge, credentials or mailbox access performed. The user subsequently approved committing and pushing the review fixes.
- Update the existing PR with a regular fast-forward push of the history-preserving merge; do not merge the PR or deploy until the remaining owner setup/review gates are satisfied.
- Parser covers plain text/snippets and selected carrier patterns; HTML-only/unrecognized/multiple-shipment mail may need manual handling.
- Notifications are in-portal, not SMS/email or vendor-reply monitoring.
- Retention/deletion policy and end-to-end provider verification remain required before enabling ingestion.
