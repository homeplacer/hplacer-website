# Local repair, job planning, and GPS checkpoint — September 24, 2026

User subsequently authorized deployment and production fleet corrections plus the two reported repairs on September 24, 2026. GPS vendor contact remains unauthorized. Deployment outcome is recorded separately.

Local preview uses port 8797 and portal/.local/repair-parts-preview.sqlite, copied safely from the earlier preview. It contains user-reported repairs and filter references. Treat this ignored database as valuable local data; do not reseed it.

Repair work details are separate from billing lines: exact or approximate date range, mechanic name, reported hours, estimated/confirmed parts cost, supplier, and reported completion. Save via POST /api/repairs/:id/work-details. Migration 0015_repair_work_details.sql. Actual billing workflow status remains separately controlled. Existing two real reports populated through local API; unknown values remain null.

Jobs can start without a known reference or name; references are generated and address supplies the default title. Job detail links to editable planning screen. Add/rename/cancel unassigned checklist steps per job; cancellation preserves history. Planning and on-hold jobs now appear in task assignment.

GPS research: LandAirSea advertises a full API catalog in official SYNC and 54 specification sheets. Account eligibility, endpoint/authentication documentation, rates/cost and actual access have NOT been verified. No GPS integration is active.
Sources:
- https://landairsea.com/pages/support-documentation
- https://cdn.shopify.com/s/files/1/0505/8337/1972/files/Sync_SpecSheet.pdf?v=1660915285
- https://cdn.shopify.com/s/files/1/0505/8337/1972/files/54_SpecSheet.pdf?v=1660915284
- https://landairsea.com/pages/faqs

Next GPS work: read existing signed-in portal device list, match device IDs to fleet assets, retain unconfirmed matches, and determine account API availability. Keep tracker health separate from equipment availability. A parked motion-activated tracker can legitimately have an old report time. GPS runtime is not automatically engine hours. No public ShareSpot link should be created automatically.
