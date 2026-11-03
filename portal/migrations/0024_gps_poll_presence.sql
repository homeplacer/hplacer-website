-- Keep API poll presence separate from the tracker's last GPS fix.
ALTER TABLE gps_devices ADD COLUMN last_returned_at TEXT;
ALTER TABLE gps_devices ADD COLUMN returned_in_last_poll INTEGER;
