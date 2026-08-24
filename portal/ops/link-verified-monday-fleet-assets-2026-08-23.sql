-- Portal-side links from a read-only exact-ID comparison with Monday board
-- 18009779855 (FLEET / EQUIPMENT). Nothing in this file writes to Monday.
-- FLEET-033 is intentionally excluded: its trailer VIN conflicts with the
-- insurer's value and remains a verification flag.

INSERT OR IGNORE INTO monday_links
  (id, entity_type, entity_id, canonical_key, board_key, monday_item_id, sync_state, created_at, updated_at)
VALUES
  ('mlk_fleet_001','asset','ast_fleet_001','B4SB39709','equipment','18009779864','linked',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('mlk_fleet_002','asset','ast_fleet_002','1T0333GMVPF444942','equipment','18009779866','linked',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('mlk_fleet_003','asset','ast_fleet_003','1T0333GMPPF444773','equipment','18009779871','linked',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('mlk_fleet_004','asset','ast_fleet_004','1T0333GKHJF333723','equipment','12422251285','linked',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('mlk_fleet_006','asset','ast_fleet_006','SYOO9ECCO5588','equipment','18009793958','linked',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('mlk_fleet_007','asset','ast_fleet_007','KMTPC242K54A30064','equipment','11583260169','linked',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('mlk_fleet_008','asset','ast_fleet_008','CAT0963DKLGS1570','equipment','18009794522','linked',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('mlk_fleet_009','asset','ast_fleet_009','CAT00D6KAEL703304','equipment','12422280260','linked',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('mlk_fleet_010','asset','ast_fleet_010','CAT0305ECH5M00727','equipment','12422281310','linked',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('mlk_fleet_011','asset','ast_fleet_011','CAT3035EKJWY00296','equipment','12855347581','linked',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('mlk_fleet_012','asset','ast_fleet_012','NAD04322','equipment','18339357203','linked',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('mlk_fleet_013','asset','ast_fleet_013','SYC006386U6900','equipment','18009795187','linked',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('mlk_fleet_014','asset','ast_fleet_014','QH13R2024031700004','equipment','11585503461','linked',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('mlk_fleet_015','asset','ast_fleet_015','TFAAC110C20000383','equipment','18325856178','linked',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('mlk_fleet_016','asset','ast_fleet_016','222508782','equipment','18325827346','linked',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('mlk_fleet_019','asset','ast_fleet_019','3C63RRRL6RG149579','equipment','18009779876','linked',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('mlk_fleet_020','asset','ast_fleet_020','1GT39ME73PF107857','equipment','18009779873','linked',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('mlk_fleet_021','asset','ast_fleet_021','1FDUF5HT1KDA05565','equipment','18009781762','linked',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('mlk_fleet_022','asset','ast_fleet_022','1FDAF56F9YEE36528','equipment','11658242713','linked',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('mlk_fleet_023','asset','ast_fleet_023','1FDWX34P86EB83556','equipment','11658237297','linked',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('mlk_fleet_024','asset','ast_fleet_024','1FTEX1EM4EKF62899','equipment','18009819007','linked',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('mlk_fleet_025','asset','ast_fleet_025','VG6BA09B7PB700585','equipment','11658277778','linked',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('mlk_fleet_026','asset','ast_fleet_026','1NKZXPTX7FJ441176','equipment','18339455062','linked',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('mlk_fleet_027','asset','ast_fleet_027','1GDJ6H1J5SJ517652','equipment','11658259230','linked',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('mlk_fleet_028','asset','ast_fleet_028','7HCGF3021RB058829','equipment','18009807178','linked',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('mlk_fleet_029','asset','ast_fleet_029','1P9BE1623RF849158','equipment','18009807363','linked',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('mlk_fleet_030','asset','ast_fleet_030','4T9BF2020TD524890','equipment','11161531474','linked',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('mlk_fleet_031','asset','ast_fleet_031','1P9BD1418SN949121','equipment','11161555163','linked',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('mlk_fleet_032','asset','ast_fleet_032','4YMBU1015PG049710','equipment','12422235685','linked',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('mlk_fleet_034','asset','ast_fleet_034','4YMBU1226MG132983','equipment','11585554721','linked',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);
