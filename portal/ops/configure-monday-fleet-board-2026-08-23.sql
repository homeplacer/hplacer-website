-- Monday Fleet / Equipment board, discovered read-only on 2026-08-23.
-- The board holds road-vehicle VINs and equipment serials in the same column;
-- `vin_or_serial` preserves each portal link's actual identifier while the
-- matching plan remains fail-closed for duplicates or conflicts.

INSERT INTO monday_boards
  (board_key, monday_board_id, name, canonical_key_kind, active, created_at)
VALUES
  ('equipment', '18009779855', 'FLEET / EQUIPMENT', 'vin', 1, CURRENT_TIMESTAMP)
ON CONFLICT (board_key) DO UPDATE SET
  monday_board_id = excluded.monday_board_id,
  name = excluded.name,
  canonical_key_kind = excluded.canonical_key_kind,
  active = 1;

INSERT INTO monday_board_match_modes (board_key, match_mode, created_at, updated_at)
VALUES ('equipment', 'vin_or_serial', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (board_key) DO UPDATE SET
  match_mode = excluded.match_mode,
  updated_at = excluded.updated_at;
