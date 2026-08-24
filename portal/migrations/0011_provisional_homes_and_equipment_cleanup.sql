-- Provisional homes keep an internal unique serial placeholder until the data
-- plate details are known. Existing homes are complete.
ALTER TABLE homes ADD COLUMN identity_incomplete INTEGER NOT NULL DEFAULT 0 CHECK (identity_incomplete IN (0, 1));

-- Imported rows with neither a serial nor VIN cannot be mapped safely to a
-- physical asset. Retire them from active operations without deleting their
-- records, documents, inspections, defects, or history.
UPDATE assets
   SET status = 'retired', updated_at = CURRENT_TIMESTAMP
 WHERE id IN (
   SELECT a.id FROM assets a
   JOIN asset_source_metadata m ON m.asset_id = a.id
   WHERE m.verification_status <> 'verified'
     AND a.serial_number IS NULL AND a.vin IS NULL
 );
