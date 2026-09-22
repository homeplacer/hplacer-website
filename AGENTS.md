<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Two-account collaboration

- The backend account owns Cloudflare Workers, routes, queues and scheduled jobs, event tracking, analytics plumbing, data ingestion, observability, secrets, deployment safeguards, and backend tests.
- The customer-facing account owns page layout, copy, visual components, forms, user journeys, and other interface work.
- Each task uses its own branch and pull request. Do not directly edit, rebase, or deploy another account's active branch.
- Keep shared contracts explicit: document any API, event, environment-variable, schema, or route change that requires interface work.
- Production deployments require a reviewed pull request and the user's instruction to deploy. Never send test leads or hard-code live listing data.
