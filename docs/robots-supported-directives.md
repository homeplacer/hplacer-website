# Robots directive compatibility correction

## Authorized scope

The user explicitly authorized this limited backend-owned correction after being asked about the remaining robots.txt warning and outdated AI-information endpoint. This branch changes only the robots policy; the AI-information correction is a separate task and pull request.

The emitted `Content-Signal` line is now a comment. [Google's robots.txt specification](https://developers.google.com/crawling/docs/robots-txt/robots-txt-spec#syntax) supports `user-agent`, `allow`, `disallow`, and `sitemap`; text following `#` is ignored. The comment retains the existing policy intent without presenting a nonstandard field as an active robots directive.

## Preserved contract

- `/robots.txt` remains a static, plain-text GET response with status 200.
- Every other response byte, crawler group, private path, directive, and sitemap URL remains unchanged.
- Google-Extended and the existing training crawler groups remain blocked.
- Public search and assistant-retrieval groups retain all existing private-path exclusions.
- No API, event, environment variable, secret, route, cache setting, deployment configuration, backend integration, or frontend dependency is added or changed.

The regression tests pin the entire pre-change response independently of the production exports and allow only the `# ` prefix change. They also verify the supported active fields, group exclusions, training blocks, and handler response contract.

## Checks before review

- All 66 public-site tests pass, including four new robots policy/handler regression tests. Existing lead-route tests use local fixtures and stubbed network calls; no test lead was sent.
- `npx tsc --noEmit`, `npm run lint`, and `npm run build` pass. Lint retains the pre-existing unused `nowIso` warning in the unrelated portal import; no lint errors were introduced.
- The generated `.next/server/app/robots.txt.body` matches the current live response exactly except for the approved `# ` prefix. Generated response metadata remains status 200 and `text/plain; charset=utf-8`.
- An independent reviewer found no issues in the change and reran all four new regression tests successfully.
- This branch has not been merged or deployed; release is left to the parent agent after review.

## Release verification

After the reviewed release, GET `https://hplacer.com/robots.txt` and verify that `Content-Signal` appears only as a comment, the remaining body matches the pre-change policy byte for byte, and the response remains successful plain text. A fresh SEMrush crawl should then reassess the robots warning; this change does not claim a post-release audit result in advance.
