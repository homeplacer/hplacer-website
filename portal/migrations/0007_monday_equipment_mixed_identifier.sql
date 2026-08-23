-- Some fleet boards use a VIN for road vehicles and a serial number for
-- equipment. Keep that explicit as a board matching strategy rather than
-- weakening the canonical identifier stored on each individual link.
--
-- This is intentionally a separate table: rebuilding monday_boards would
-- disturb its existing foreign-key history (links, discovery runs, and queue).
CREATE TABLE monday_board_match_modes (
  board_key TEXT PRIMARY KEY REFERENCES monday_boards(board_key) ON DELETE CASCADE,
  match_mode TEXT NOT NULL CHECK (match_mode IN ('canonical', 'vin_or_serial')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (board_key = 'equipment' OR match_mode = 'canonical')
);
