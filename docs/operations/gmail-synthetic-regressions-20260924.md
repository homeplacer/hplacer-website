# Gmail synthetic regression review — 2026-09-24

Local branch `codex/gmail-synthetic-regressions`, based on merged main `0841fa1`. Prepared for a review pull request. No merge, deployment, remote migration, credentials, mailbox access, or external messages to vendors were performed.

## Findings addressed

Fifteen new synthetic cases (eleven parser, four importer) reproduce and cover:
- Multiple distinct labeled orders previously selected the first. Require one unique normalized order identifier.
- Unsupported/overlong order IDs and malformed tracking suffixes could yield valid-looking partial identifiers. Validate complete supported tokens and UPS boundaries.
- Numeric package lists under one tracking label previously selected the first. Collect listed candidates before deciding uniqueness, including when a snippet repeats just one of the body's packages. Repeated identical identifiers are not multiple packages.
- The `no` abbreviation incorrectly matched the start of `notification`; enforce the label boundary.

Reviewed importer call path: subject + snippet + nested plain-text MIME are parsed together, candidate material requests use exact order-number lookup, and staged events remain needs_review. No schema, API, permission, or storage behavior changes.

Synthetic integration coverage: HTML-only receipts fall back to subject/snippet; truncated tracking stays unset; nested plain-text parts are read while attached text/HTML are ignored; duplicate message IDs within/across pages/runs produce no additional event/attachment; distinct message IDs in one thread remain separate. All fixtures use injected fetch responses, not real mail.

## Verification

- Initial new label/list cases failed before the final fixes; focused parser suite passes afterward.
- `npm run portal:check`: TypeScript, all **336 tests**, and ESLint passed (exit 0).
- `git diff --check`: passed.
- Log: `/tmp/hplacer-gmail-final-check.log`.
- Scope: parser, synthetic parser/importer tests, and review documentation. All earlier edge cases are retained; plural labels and alphanumeric package lists also participate in ambiguity checks.

## Remaining limits

HTML body extraction is still unsupported; snippet/plain-text fallback is tested, not a complete HTML receipt parser. Unsupported formatting can require manual review. Different Gmail IDs are not deduplicated by receipt content. Carrier identification remains heuristic, and these tests do not establish real-provider end-to-end readiness. Gmail activation still needs organization/project ownership, actual OAuth audience, Workspace API Controls, approved retention/deletion rules, and applicable verification/assessment determination.
