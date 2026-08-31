# Portal R2 retention runbook

The `hplacer-portal-photos` bucket is private and contains several different
record classes under one binding:

- field photos, inspection evidence, repair photos, and receipts under `photos/`;
- homeowner warranty photos under the same `photos/` prefix;
- applicant resumes under `job-applications/`;
- insurance-card PDFs attached by the fleet operations scripts.

## Current safe policy

Do **not** configure automatic object expiration until Home Placer chooses and
documents a retention period for each record class. A single blanket expiry can
silently delete evidence needed for warranty, billing, employment, insurance,
or audit work while D1 still points to the missing object.

Cloudflare R2 already aborts incomplete multipart uploads after seven days by
default. The portal currently performs bounded single-request uploads, so that
default creates no record-retention risk.

Wrangler does not express R2 lifecycle rules inside `wrangler.jsonc`; lifecycle
is bucket-level state. Before any approved change, capture the live rules:

```sh
npx wrangler r2 bucket lifecycle list hplacer-portal-photos
```

Do not use `r2 bucket lifecycle set` as a shortcut: it replaces the bucket's
entire lifecycle configuration. Prefer adding one reviewed, prefix-specific
rule at a time, then list the rules again and test that an authorized portal
download still works.

## Decision required before deletion rules

For each prefix, record an owner-approved minimum retention period, whether a
legal or billing hold can override deletion, and who verifies D1 metadata after
objects expire. The current `photos/` prefix mixes several record classes; if
their retention periods differ, change future object keys to separate prefixes
before enabling expiry.

Rollback for a newly added rule is to remove that rule by its exact id. Removing
a rule prevents future lifecycle deletion; it cannot restore an object already
deleted, so bucket changes require an independent backup/recovery decision.
