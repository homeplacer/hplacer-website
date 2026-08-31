-- Internal Careers review metadata and structured insurance-card tracking.
-- Applicant resumes and insurance-card files remain private R2 objects; these
-- tables store only the metadata needed to authorize and operate the portal.

ALTER TABLE job_applications ADD COLUMN review_notes TEXT;
ALTER TABLE job_applications ADD COLUMN reviewed_by TEXT REFERENCES employees(id);
ALTER TABLE job_applications ADD COLUMN reviewed_at TEXT;

CREATE TABLE asset_insurance_cards (
  id TEXT PRIMARY KEY,
  asset_id TEXT NOT NULL REFERENCES assets(id),
  document_id TEXT REFERENCES documents(id),
  provider TEXT NOT NULL,
  policy_number TEXT,
  effective_on TEXT,
  expires_on TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'current'
    CHECK (status IN ('current', 'superseded', 'cancelled')),
  created_by TEXT REFERENCES employees(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (effective_on IS NULL OR effective_on <= expires_on)
);

CREATE UNIQUE INDEX idx_asset_insurance_current
  ON asset_insurance_cards(asset_id) WHERE status = 'current';
CREATE UNIQUE INDEX idx_asset_insurance_document
  ON asset_insurance_cards(document_id) WHERE document_id IS NOT NULL;
CREATE INDEX idx_asset_insurance_expiry
  ON asset_insurance_cards(status, expires_on);

-- Preserve the supplied 2026 State Farm cards as structured current records
-- when the attachment operations have already been applied. Environments that
-- do not contain those documents simply insert no rows.
INSERT OR IGNORE INTO asset_insurance_cards
  (id, asset_id, document_id, provider, effective_on, expires_on, status, created_by, created_at, updated_at)
SELECT 'ins_' || d.id, d.asset_id, d.id, 'State Farm', '2026-07-30', '2027-01-30', 'current',
       d.uploaded_by, d.created_at, d.created_at
  FROM documents d
 WHERE d.asset_id IS NOT NULL
   AND d.upload_status = 'stored'
   AND lower(ifnull(d.caption, '')) LIKE '%insurance card%'
   AND lower(ifnull(d.caption, '')) LIKE '%effective july 30, 2026%'
   AND lower(ifnull(d.caption, '')) LIKE '%expires january 30, 2027%';

INSERT INTO notification_categories (category, label, description, default_role)
VALUES ('insurance_expiring', 'Insurance expiring', 'A vehicle insurance card is approaching or past its expiration date', 'admin');
