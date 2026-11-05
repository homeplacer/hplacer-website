# General-inquiry required-phone contract

The shared `ContactForm` used by contact and inquiry dialogs requires a phone
number. Email is optional. Native `required`, a browser-compatible formatting
pattern, and a submit-handler guard reject missing or structurally unusable
phones even when an email was supplied. The guard accepts ten-digit US numbers,
eleven-digit US numbers beginning with 1, and leading-+ international numbers
with 7–15 digits, while allowing spaces, parentheses, periods and hyphens.
It does not verify that a number exists or belongs to the visitor.

Phone errors focus the phone field and use the existing persistent alert. The
startup/no-native-submit contract, capture-before-disable FormData order,
synchronous duplicate-submission guard, JSON intake/attribution, unsent mailto
fallback, and success/error behavior remain intact. Assistance forms keep their
existing required phone and email; service-form requirements are unchanged.

## Required backend follow-up

Frontend checks are not a security or intake guarantee. At the task base,
`/api/lead` still accepts a general contact with a name and email but no phone.
The backend owner must separately change contact validation to require a valid
normalized phone and return 422 before any delivery for missing/invalid phone.
Keep email optional for general contact, preserve assistance and other lead-type
contracts, attribution, duplicate handling, provider delivery and CRM mapping.
This frontend PR does not edit the API, CRM, analytics, or deployment safeguards.

Verification uses synthetic local fixtures and in-memory lead stubs only. No
production submissions or customer information belong in the fixture or this note.

## Local verification

- `node --test tests/*.test.mjs`: 226 passing tests, including six new phone
  format/handler cases and unchanged assistance/service requirements.
- `npx tsc --noEmit`, scoped ESLint, and `npm run build`: pass; 272 pages generated.
- Browser review can use
  `CONTACT_FORM_FIXTURE_PORT=18076 node tests/fixtures/contact-form-preview.mjs`.
  This loopback fixture has no API and blocks network/native submissions by CSP.
  Check email-only and malformed phones yield zero requests and focused phone
  feedback; formatted phone with blank email retains the serialized phone and
  model/package context. Check bypassed native validation, error/retry, duplicate
  submits, unsent mailto confirmation, and no-JavaScript fallback separately.

Pattern syntax follows the current HTML `v`-mode requirements documented by
[MDN](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Attributes/pattern).
