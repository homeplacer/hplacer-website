# Home Placer Employee Portal

The employee portal will live at `portal.hplacer.com` as a separate Cloudflare
Worker from the public website. It is deliberately isolated from the marketing
site so employee data, documents, and field photos are never public assets.

## What it manages

- Jobs, lots, plats, directions, and job documents
- Manufactured homes keyed by serial number, from delivery through inspection
- Equipment keyed by asset tag and serial number or VIN
- Daily equipment inspections, defects, and maintenance history
- Supervisor-assigned work tasks and completion evidence
- Repair tickets, bill-back evidence, labor, materials, and Tara's billing queue
- Parts, stock levels, vendor links, purchase requests, and low-stock alerts
- Monday.com synchronization using the serial number/VIN and Monday item ID

## Storage and security

- D1: operational records and permissions
- R2: private field photos, receipts, and inspection evidence
- Google Drive: plats, permits, factory documents, and existing job folders
- Cloudflare Access: employee login before any portal route or API is reachable

`migrations/0001_initial.sql` is the initial data model. It is intentionally
empty: no employee names, credentials, vendor accounts, photos, or customer data
are checked into source control.

## Build order

1. Provision the dedicated Worker, D1 database, R2 bucket, and Cloudflare Access policy.
2. Create employee accounts and supervisor roles.
3. Implement field workflows: daily inspection, repair ticket, photo upload,
   material request, and task completion.
4. Add Tara's billing and inventory queues plus daily notifications.
5. Connect the selected Monday boards through a least-privilege API token.
