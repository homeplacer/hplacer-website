CREATE TABLE asset_part_references (
 id TEXT PRIMARY KEY,
 asset_id TEXT NOT NULL REFERENCES assets(id),
 name TEXT NOT NULL,
 oem_number TEXT,
 aftermarket_number TEXT,
 supplier TEXT,
 supplier_url TEXT,
 source_url TEXT,
 fit_status TEXT NOT NULL DEFAULT 'unverified' CHECK(fit_status IN ('unverified','confirmed')),
 evidence TEXT,
 notes TEXT,
 updated_by TEXT NOT NULL REFERENCES employees(id),
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX asset_part_references_asset ON asset_part_references(asset_id);
