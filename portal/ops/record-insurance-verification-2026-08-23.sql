-- Cross-check four insured vehicles against the supplied State Farm cards.
-- The card's effective date is 2026-07-30; it confirms the source VINs and
-- vehicle descriptions, but does not resolve any of the existing fleet flags.

UPDATE asset_source_metadata
SET source_notes = source_notes || ' — VIN and vehicle description cross-verified against Home Placer insurance cards (effective 2026-07-30).',
    updated_at = CURRENT_TIMESTAMP
WHERE asset_id IN ('ast_fleet_019', 'ast_fleet_020', 'ast_fleet_021', 'ast_fleet_023');
