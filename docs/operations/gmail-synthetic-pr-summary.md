# Proposed title

Prevent ambiguous and truncated Gmail order and tracking matches

# Proposed body

Vendor emails containing several orders or packages could select the first identifier, and malformed identifiers could be truncated into valid-looking matches. Require a single unique supported order or shipment identifier, validate token boundaries, and combine tracking candidates across the snippet and body. Also prevent “order notification” from being interpreted as an order-number label.

Add 15 synthetic regressions covering identifier boundaries, multiple/repeated packages, HTML-only fallback, nested MIME, and duplicate message delivery across pages and polling runs. No schema or API changes.

Validation: `npm run portal:check` passed TypeScript, all 336 tests, and ESLint; `git diff --check` passed. No real mailbox data or production operations used.

Limitations: HTML body extraction and content-level receipt deduplication remain unsupported; unfamiliar formats still need manual review. This change does not activate Gmail or resolve its outstanding administrator/policy prerequisites.
