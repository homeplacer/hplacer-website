-- dev-seed.sql — DEMONSTRATION DATA ONLY.
--
-- This file is never applied to the production database. It exists so
-- `npm run portal:dev` and the test suite have a yard full of equipment, a few
-- jobs, and a working billing queue to exercise.
--
-- Everything here is invented: the addresses, serial numbers, VINs, vendor
-- links, and dollar figures are illustrative. Real employee records, customer
-- data, vendor accounts, and photos are created in the live database by an
-- administrator and never checked into source control.

PRAGMA foreign_keys = ON;

------------------------------------------------------------------------------
-- Staff. Supervisors: Brandon, Joe, Tara, Greg, Brett.
-- Tara also carries the billing role — she runs the bill-back queue.
------------------------------------------------------------------------------

INSERT INTO employees (id, access_subject, email, display_name, role, crew, phone, active, created_at, updated_at) VALUES
  ('emp_admin',   'pending:ops@hplacer.com',     'ops@hplacer.com',     'Operations Admin', 'admin',      NULL,        NULL, 1, '2026-01-05 09:00:00', '2026-01-05 09:00:00'),
  ('emp_brandon', 'pending:brandon@hplacer.com', 'brandon@hplacer.com', 'Brandon',          'supervisor', 'Set crew',  NULL, 1, '2026-01-05 09:00:00', '2026-01-05 09:00:00'),
  ('emp_joe',     'pending:joe@hplacer.com',     'joe@hplacer.com',     'Joe',              'supervisor', 'Field ops', NULL, 1, '2026-01-05 09:00:00', '2026-01-05 09:00:00'),
  ('emp_tara',    'pending:tara@hplacer.com',    'tara@hplacer.com',    'Tara',             'supervisor', 'Office',    NULL, 1, '2026-01-05 09:00:00', '2026-01-05 09:00:00'),
  ('emp_greg',    'pending:greg@hplacer.com',    'greg@hplacer.com',    'Greg',             'supervisor', 'Dirt crew', NULL, 1, '2026-01-05 09:00:00', '2026-01-05 09:00:00'),
  ('emp_brett',   'pending:brett@hplacer.com',   'brett@hplacer.com',   'Brett',            'supervisor', 'Service',   NULL, 1, '2026-01-05 09:00:00', '2026-01-05 09:00:00'),
  ('emp_dale',    'pending:dale@hplacer.com',    'dale@hplacer.com',    'Dale R.',          'employee',   'Dirt crew', NULL, 1, '2026-02-10 09:00:00', '2026-02-10 09:00:00'),
  ('emp_marcus',  'pending:marcus@hplacer.com',  'marcus@hplacer.com',  'Marcus T.',        'employee',   'Set crew',  NULL, 1, '2026-02-10 09:00:00', '2026-02-10 09:00:00'),
  ('emp_wes',     'pending:wes@hplacer.com',     'wes@hplacer.com',     'Wes P.',           'employee',   'Service',   NULL, 1, '2026-03-02 09:00:00', '2026-03-02 09:00:00'),
  ('emp_nina',    'pending:nina@hplacer.com',    'nina@hplacer.com',    'Nina K.',          'employee',   'Transport', NULL, 1, '2026-03-02 09:00:00', '2026-03-02 09:00:00');

INSERT INTO employee_role_grants (employee_id, role, granted_by, created_at) VALUES
  ('emp_tara', 'billing', 'emp_admin', '2026-01-05 09:05:00');

------------------------------------------------------------------------------
-- Jobs and lots
------------------------------------------------------------------------------

INSERT INTO jobs (id, job_number, title, status, street_address, city, state, postal_code, google_maps_url,
                  drive_folder_url, supervisor_id, customer_reference, notes, created_at, updated_at) VALUES
  ('job_2601', 'HP-2601', 'Mill Creek Ridge — Phase 2', 'active', '184 Mill Creek Rd', 'Boone', 'NC', '28607',
   'https://www.google.com/maps/search/?api=1&query=36.2168,-81.6746',
   'https://drive.google.com/drive/folders/1MillCreekRidgePhase2Demo', 'emp_brandon', 'MCR-P2',
   'Steep grade on lots 12-14; track machines only.', '2026-04-02 08:00:00', '2026-08-14 16:20:00'),
  ('job_2604', 'HP-2604', 'Hollis private placement', 'active', '77 Ridgeview Ln', 'Lenoir', 'NC', '28645',
   'https://www.google.com/maps/search/?api=1&query=35.9140,-81.5390',
   'https://drive.google.com/drive/folders/1HollisPlacementDemo', 'emp_greg', 'HOLLIS-01',
   'Well and septic already in. Power pole at the road.', '2026-05-18 08:00:00', '2026-08-19 11:05:00'),
  ('job_2588', 'HP-2588', 'Watauga Bend — single set', 'complete', '12 Bend Rd', 'Vilas', 'NC', '28692',
   'https://www.google.com/maps/search/?api=1&query=36.2530,-81.7830',
   'https://drive.google.com/drive/folders/1WataugaBendDemo', 'emp_joe', 'WB-09',
   NULL, '2026-02-11 08:00:00', '2026-06-30 15:00:00');

INSERT INTO lots (id, job_id, lot_number, parcel_id, street_address, city, state, postal_code, latitude, longitude,
                  google_maps_url, plat_drive_url, permit_drive_url, access_notes, utility_notes, status,
                  created_at, updated_at) VALUES
  ('lot_2601_12', 'job_2601', '12', '2892-14-3311', '184 Mill Creek Rd Lot 12', 'Boone', 'NC', '28607', 36.2170, -81.6749,
   'https://www.google.com/maps/search/?api=1&query=36.2170,-81.6749',
   'https://drive.google.com/file/d/1PlatMillCreekLot12Demo/view',
   'https://drive.google.com/file/d/1PermitMillCreekLot12Demo/view',
   'Enter from the gravel spur past the mailboxes. Low limbs — no high loads.',
   'Power set, water tap at the northeast corner.', 'set', '2026-04-02 08:10:00', '2026-08-14 16:20:00'),
  ('lot_2601_13', 'job_2601', '13', '2892-14-3312', '184 Mill Creek Rd Lot 13', 'Boone', 'NC', '28607', 36.2174, -81.6752,
   'https://www.google.com/maps/search/?api=1&query=36.2174,-81.6752',
   'https://drive.google.com/file/d/1PlatMillCreekLot13Demo/view',
   'https://drive.google.com/file/d/1PermitMillCreekLot13Demo/view',
   'Same spur as lot 12. Turnaround is tight for the 40 ft trailer.',
   'Water tap installed. Power pending meter set.', 'prepped', '2026-04-02 08:12:00', '2026-08-18 09:40:00'),
  ('lot_2604_1', 'job_2604', '1', '3041-88-0142', '77 Ridgeview Ln', 'Lenoir', 'NC', '28645', 35.9142, -81.5388,
   'https://www.google.com/maps/search/?api=1&query=35.9142,-81.5388',
   'https://drive.google.com/file/d/1PlatHollisDemo/view',
   'https://drive.google.com/file/d/1PermitHollisDemo/view',
   'Driveway is 11 ft wide at the culvert.', 'Well and septic in; power pole at the road.',
   'permitted', '2026-05-18 08:05:00', '2026-08-19 11:05:00'),
  ('lot_2588_1', 'job_2588', '1', '2799-01-7788', '12 Bend Rd', 'Vilas', 'NC', '28692', 36.2531, -81.7828,
   'https://www.google.com/maps/search/?api=1&query=36.2531,-81.7828',
   'https://drive.google.com/file/d/1PlatWataugaBendDemo/view',
   'https://drive.google.com/file/d/1PermitWataugaBendDemo/view',
   NULL, NULL, 'complete', '2026-02-11 08:05:00', '2026-06-30 15:00:00');

------------------------------------------------------------------------------
-- Homes, keyed by serial number
------------------------------------------------------------------------------

INSERT INTO homes (id, serial_number, manufacturer, model, model_year, section_count, hud_label_numbers,
                   job_id, lot_id, status, delivered_on, setup_completed_on, final_inspection_on,
                   warranty_expires_on, created_at, updated_at) VALUES
  ('hom_a1', 'CAV2026NC114772A', 'Cavco', 'Vivid', 2026, 2, 'NCA1884221 / NCA1884222', 'job_2601', 'lot_2601_12',
   'inspection_pending', '2026-08-04', '2026-08-13', NULL, '2027-08-13', '2026-06-20 09:00:00', '2026-08-13 17:10:00'),
  ('hom_a2', 'CLT2026TN903318X', 'Clayton', 'Rocketman', 2026, 2, 'TNA2210554 / TNA2210555', 'job_2601', 'lot_2601_13',
   'delivery_pending', NULL, NULL, NULL, NULL, '2026-07-01 09:00:00', '2026-07-01 09:00:00'),
  ('hom_a3', 'CAV2025NC098120B', 'Cavco', 'Pearl', 2025, 1, 'NCA1791003', 'job_2604', 'lot_2604_1',
   'delivery_pending', NULL, NULL, NULL, NULL, '2026-07-22 09:00:00', '2026-07-22 09:00:00'),
  ('hom_a4', 'CLT2025TN881204Z', 'Clayton', 'Hartford', 2025, 2, 'TNA2098771 / TNA2098772', 'job_2588', 'lot_2588_1',
   'complete', '2026-05-19', '2026-05-28', '2026-06-24', '2027-05-28', '2026-03-05 09:00:00', '2026-06-24 14:00:00');

------------------------------------------------------------------------------
-- Equipment, keyed by asset tag with a serial number or VIN behind it
------------------------------------------------------------------------------

INSERT INTO assets (id, asset_tag, asset_type, manufacturer, model, model_year, serial_number, vin, plate_number,
                    hour_meter, odometer, status, home_base, assigned_to, created_at, updated_at) VALUES
  ('ast_ex1', 'EX-01', 'excavator',    'Deere',     '135G',       2021, 'DR135G21008841', NULL, NULL, 3184.6, NULL, 'available',      'Boone yard',  'emp_dale',   '2026-01-06 08:00:00', '2026-08-20 07:15:00'),
  ('ast_ex2', 'EX-02', 'excavator',    'Kubota',    'KX057-5',    2023, 'KB0575023114',   NULL, NULL, 968.2,  NULL, 'available',      'Boone yard',  NULL,         '2026-01-06 08:00:00', '2026-08-19 07:40:00'),
  ('ast_ss1', 'SS-01', 'skid_steer',   'Bobcat',    'S66',        2022, 'BC S66 220991',  NULL, NULL, 1742.9, NULL, 'available',      'Boone yard',  'emp_marcus', '2026-01-06 08:00:00', '2026-08-20 07:20:00'),
  ('ast_ss2', 'SS-02', 'skid_steer',   'Case',      'SR210B',     2020, 'CS210B200417',   NULL, NULL, 2996.4, NULL, 'out_of_service', 'Boone yard',  NULL,         '2026-01-06 08:00:00', '2026-08-18 16:05:00'),
  ('ast_dz1', 'DZ-01', 'bulldozer',    'Deere',     '450K',       2019, 'DR450K19002277', NULL, NULL, 4410.1, NULL, 'available',      'Lenoir yard', NULL,         '2026-01-06 08:00:00', '2026-08-15 07:10:00'),
  ('ast_tr1', 'TR-01', 'trailer',      'PJ',        'CE 20ft',    2022, NULL, '4P5CE2022N1330441', 'NC-TR4471', NULL, NULL,   'available',      'Boone yard',  NULL,         '2026-01-06 08:00:00', '2026-08-20 06:55:00'),
  ('ast_tr2', 'TR-02', 'trailer',      'Big Tex',   '22GN 40ft',  2024, NULL, '16V2F4029R6091220', 'NC-TR9902', NULL, NULL,   'available',      'Boone yard',  'emp_nina',   '2026-02-14 08:00:00', '2026-08-19 06:30:00'),
  ('ast_dt1', 'DT-01', 'dump_truck',   'Freightliner', 'M2 106',  2020, NULL, '1FVACWDT0LHLR2201', 'NC-DT1180', NULL, 118442, 'available',      'Boone yard',  NULL,         '2026-01-06 08:00:00', '2026-08-20 06:45:00'),
  ('ast_pk1', 'PK-01', 'pickup_truck', 'Ford',      'F-250',      2023, NULL, '1FT8W2BT4PEC55011', 'NC-PK2210', NULL, 64180,  'available',      'Boone yard',  'emp_brett',  '2026-01-06 08:00:00', '2026-08-20 06:40:00'),
  ('ast_pk2', 'PK-02', 'pickup_truck', 'Chevrolet', 'Silverado 2500', 2021, NULL, '1GC4YNEY6MF201884', 'NC-PK7745', NULL, 98220, 'available', 'Lenoir yard', 'emp_greg', '2026-01-06 08:00:00', '2026-08-19 06:50:00');

UPDATE assets SET out_of_service_reason = 'Hydraulic leak at the left lift cylinder — parts on order.' WHERE id = 'ast_ss2';

INSERT INTO asset_service_schedules (id, asset_id, service_key, description, interval_hours, interval_miles,
                                     interval_days, last_service_at, last_service_hours, last_service_miles, active) VALUES
  ('svs_ex1_oil', 'ast_ex1', 'engine_oil',   'Engine oil and filter',        250,  NULL, NULL, '2026-07-02 10:00:00', 3010.0, NULL, 1),
  ('svs_ex1_hyd', 'ast_ex1', 'hydraulic',    'Hydraulic filter',             1000, NULL, NULL, '2026-03-11 10:00:00', 2600.0, NULL, 1),
  ('svs_ex2_oil', 'ast_ex2', 'engine_oil',   'Engine oil and filter',        250,  NULL, NULL, '2026-08-01 10:00:00', 900.0,  NULL, 1),
  ('svs_ss1_oil', 'ast_ss1', 'engine_oil',   'Engine oil and filter',        200,  NULL, NULL, '2026-06-18 10:00:00', 1600.0, NULL, 1),
  ('svs_dz1_oil', 'ast_dz1', 'engine_oil',   'Engine oil and filter',        250,  NULL, NULL, '2026-05-20 10:00:00', 4180.0, NULL, 1),
  ('svs_dt1_oil', 'ast_dt1', 'engine_oil',   'Engine oil and filter',        NULL, 15000, NULL, '2026-04-08 10:00:00', NULL, 106000, 1),
  ('svs_dt1_dot', 'ast_dt1', 'dot_annual',   'DOT annual inspection',        NULL, NULL, 365,  '2025-11-14 10:00:00', NULL, NULL, 1),
  ('svs_pk1_oil', 'ast_pk1', 'engine_oil',   'Engine oil and filter',        NULL, 7500, NULL, '2026-06-30 10:00:00', NULL, 60100, 1),
  ('svs_tr2_bear','ast_tr2', 'wheel_bearing','Repack wheel bearings',        NULL, NULL, 180,  '2026-03-01 10:00:00', NULL, NULL, 1);

INSERT INTO asset_service_records (id, asset_id, schedule_id, service_type, description, performed_at, performed_by,
                                   vendor, hour_meter, odometer, cost_cents, created_at) VALUES
  ('svr_1', 'ast_ex1', 'svs_ex1_oil', 'preventive', 'Engine oil and filter, greased boom pins', '2026-07-02 10:00:00', 'emp_wes', NULL, 3010.0, NULL, 21400, '2026-07-02 10:00:00'),
  ('svr_2', 'ast_dt1', 'svs_dt1_oil', 'preventive', 'Engine oil, fuel filters', '2026-04-08 10:00:00', 'emp_wes', 'Boone Diesel', NULL, 106000, 48900, '2026-04-08 10:00:00');

------------------------------------------------------------------------------
-- Inventory. quantity_on_hand is maintained by the movement trigger, so the
-- opening balances are inserted as 'received' movements.
------------------------------------------------------------------------------

INSERT INTO parts (id, sku, name, description, unit, quantity_on_hand, reorder_point, reorder_quantity,
                   preferred_vendor, product_url, preferred_unit_cost_cents, storage_location, active, created_at, updated_at) VALUES
  ('prt_anchor', 'ANC-4830', 'Auger anchor, 30 in', 'Galvanized mobile home auger anchor', 'each', 0, 40, 100,
   'Tie Down Engineering', 'https://www.example-vendor.com/catalog/anchor-4830', 1450, 'Shop rack A1', 1, '2026-01-08 08:00:00', '2026-01-08 08:00:00'),
  ('prt_strap', 'STR-3016', 'Anchor strap, 16 ft', 'Galvanized strap with buckle', 'each', 0, 30, 80,
   'Tie Down Engineering', 'https://www.example-vendor.com/catalog/strap-3016', 890, 'Shop rack A1', 1, '2026-01-08 08:00:00', '2026-01-08 08:00:00'),
  ('prt_pier', 'PIR-1008', 'Adjustable pier, 8 in', 'Steel pier with adjustable cap', 'each', 0, 24, 60,
   'Southern Supply', 'https://www.example-vendor.com/catalog/pier-1008', 2100, 'Shop rack A2', 1, '2026-01-08 08:00:00', '2026-01-08 08:00:00'),
  ('prt_shim', 'SHM-0402', 'Hardwood shim pack', 'Pack of 25 setup shims', 'pack', 0, 10, 30,
   'Southern Supply', 'https://www.example-vendor.com/catalog/shim-0402', 1250, 'Shop rack A2', 1, '2026-01-08 08:00:00', '2026-01-08 08:00:00'),
  ('prt_crossover', 'DCT-1400', 'Crossover duct, 14 in x 25 ft', 'Insulated flexible crossover duct', 'each', 0, 6, 12,
   'Southern Supply', 'https://www.example-vendor.com/catalog/duct-1400', 4300, 'Shop rack B1', 1, '2026-01-08 08:00:00', '2026-01-08 08:00:00'),
  ('prt_hyd', 'HYD-3812', 'Hydraulic hose, 3/8 in x 48 in', 'Two-wire hose, JIC ends', 'each', 0, 4, 10,
   'Carolina Hydraulics', 'https://www.example-vendor.com/catalog/hose-3812', 6200, 'Shop rack C3', 1, '2026-01-08 08:00:00', '2026-01-08 08:00:00'),
  ('prt_filter', 'FLT-EX01', 'Engine oil filter, Deere 135G', NULL, 'each', 0, 3, 6,
   'Deere Parts', 'https://www.example-vendor.com/catalog/filter-ex01', 3400, 'Shop rack C1', 1, '2026-01-08 08:00:00', '2026-01-08 08:00:00'),
  ('prt_tooth', 'TTH-J350', 'Bucket tooth, J350', NULL, 'each', 0, 8, 20,
   'Carolina Attachments', 'https://www.example-vendor.com/catalog/tooth-j350', 1980, 'Shop rack C2', 1, '2026-01-08 08:00:00', '2026-01-08 08:00:00'),
  ('prt_skirt', 'SKT-2400', 'Skirting panel, 24 in', 'Vinyl skirting panel', 'each', 0, 40, 120,
   'Southern Supply', 'https://www.example-vendor.com/catalog/skirt-2400', 760, 'Yard bay 2', 1, '2026-01-08 08:00:00', '2026-01-08 08:00:00'),
  ('prt_marriage', 'GSK-1600', 'Marriage line gasket, 16 ft', NULL, 'each', 0, 8, 20,
   'Southern Supply', 'https://www.example-vendor.com/catalog/gasket-1600', 2450, 'Shop rack B1', 1, '2026-01-08 08:00:00', '2026-01-08 08:00:00');

INSERT INTO inventory_movements (id, part_id, movement_type, quantity, repair_ticket_id, recorded_by, notes, created_at) VALUES
  ('mov_o1', 'prt_anchor',    'received', 180, NULL, 'emp_tara', 'Opening balance', '2026-01-08 08:05:00'),
  ('mov_o2', 'prt_strap',     'received', 120, NULL, 'emp_tara', 'Opening balance', '2026-01-08 08:05:00'),
  ('mov_o3', 'prt_pier',      'received',  96, NULL, 'emp_tara', 'Opening balance', '2026-01-08 08:05:00'),
  ('mov_o4', 'prt_shim',      'received',  40, NULL, 'emp_tara', 'Opening balance', '2026-01-08 08:05:00'),
  ('mov_o5', 'prt_crossover', 'received',  18, NULL, 'emp_tara', 'Opening balance', '2026-01-08 08:05:00'),
  ('mov_o6', 'prt_hyd',       'received',  12, NULL, 'emp_tara', 'Opening balance', '2026-01-08 08:05:00'),
  ('mov_o7', 'prt_filter',    'received',   9, NULL, 'emp_tara', 'Opening balance', '2026-01-08 08:05:00'),
  ('mov_o8', 'prt_tooth',     'received',  36, NULL, 'emp_tara', 'Opening balance', '2026-01-08 08:05:00'),
  ('mov_o9', 'prt_skirt',     'received', 260, NULL, 'emp_tara', 'Opening balance', '2026-01-08 08:05:00'),
  ('mov_o10','prt_marriage',  'received',  24, NULL, 'emp_tara', 'Opening balance', '2026-01-08 08:05:00'),
  -- A season of setting homes draws the fast movers down; the crossover duct
  -- and the hydraulic hose end up under their reorder points.
  ('mov_u1', 'prt_anchor',    'used', -142, NULL, 'emp_marcus', 'Mill Creek lots 12-14', '2026-08-05 15:10:00'),
  ('mov_u2', 'prt_strap',     'used',  -96, NULL, 'emp_marcus', 'Mill Creek lots 12-14', '2026-08-05 15:10:00'),
  ('mov_u3', 'prt_crossover', 'used',  -14, NULL, 'emp_marcus', 'Mill Creek lot 12 set',  '2026-08-12 11:30:00'),
  ('mov_u4', 'prt_hyd',       'used',   -9, NULL, 'emp_wes',    'SS-02 and DZ-01 repairs','2026-08-18 16:00:00'),
  ('mov_u5', 'prt_pier',      'used',  -60, NULL, 'emp_marcus', 'Mill Creek lot 12 set',  '2026-08-12 11:30:00');

------------------------------------------------------------------------------
-- Work in flight
------------------------------------------------------------------------------

INSERT INTO work_tasks (id, title, details, status, priority, due_at, job_id, lot_id, home_id, asset_id,
                        assigned_to, created_by, requires_photo, created_at, updated_at) VALUES
  ('tsk_1', 'Set skirting on Mill Creek lot 12', 'Vinyl skirting and vents, both sides plus ends.', 'in_progress', 'high',
   '2026-08-23 17:00:00', 'job_2601', 'lot_2601_12', 'hom_a1', NULL, 'emp_marcus', 'emp_brandon', 1,
   '2026-08-17 08:00:00', '2026-08-20 07:30:00'),
  ('tsk_2', 'Grade and gravel the lot 13 pad', 'Bring pad to grade before the 26th delivery.', 'open', 'urgent',
   '2026-08-25 17:00:00', 'job_2601', 'lot_2601_13', NULL, 'ast_dz1', 'emp_dale', 'emp_greg', 0,
   '2026-08-18 08:00:00', '2026-08-18 08:00:00'),
  ('tsk_3', 'Pull SS-02 hydraulic cylinder', 'Left lift cylinder is weeping. Cap the lines before pulling.', 'blocked', 'high',
   '2026-08-22 17:00:00', NULL, NULL, NULL, 'ast_ss2', 'emp_wes', 'emp_brett', 1,
   '2026-08-18 16:10:00', '2026-08-19 09:00:00'),
  ('tsk_4', 'Confirm Hollis driveway width', 'Measure at the culvert; 40 ft trailer may not make the turn.', 'open', 'normal',
   '2026-08-24 12:00:00', 'job_2604', 'lot_2604_1', NULL, NULL, 'emp_nina', 'emp_joe', 1,
   '2026-08-19 11:10:00', '2026-08-19 11:10:00'),
  ('tsk_5', 'Final walkthrough punch list — Watauga Bend', NULL, 'complete', 'normal', '2026-06-24 17:00:00',
   'job_2588', 'lot_2588_1', 'hom_a4', NULL, 'emp_marcus', 'emp_joe', 0, '2026-06-20 08:00:00', '2026-06-24 14:00:00');

UPDATE work_tasks SET completed_at = '2026-06-24 14:00:00', completed_by = 'emp_marcus',
                      completion_notes = 'All punch items closed; homeowner signed off.'
 WHERE id = 'tsk_5';

------------------------------------------------------------------------------
-- Repairs and the bill-back queue
------------------------------------------------------------------------------

INSERT INTO repair_tickets (id, ticket_number, status, bill_back_status, title, description, job_id, lot_id,
                            home_id, asset_id, reported_by, assigned_to, responsible_party, responsible_party_type,
                            labor_minutes, billing_notes, bill_back_amount_cents, invoice_reference,
                            approved_by, approved_at, completed_at, billed_at, created_at, updated_at) VALUES
  ('rep_1', 'RT-2026-0001', 'complete', 'review_needed',
   'Transport damage to end wall siding',
   'Two siding panels on the road-side end wall were crushed in transit. Noted at delivery and photographed before the set.',
   'job_2601', 'lot_2601_12', 'hom_a1', NULL, 'emp_marcus', 'emp_wes', 'Ridgeline Transport', 'transporter',
   210, NULL, NULL, NULL, 'emp_brandon', '2026-08-05 09:00:00', '2026-08-11 15:30:00', NULL,
   '2026-08-04 16:40:00', '2026-08-11 15:30:00'),
  ('rep_2', 'RT-2026-0002', 'awaiting_parts', 'not_applicable',
   'SS-02 left lift cylinder leaking',
   'Failed the pre-use hydraulic check. Steady weep at the rod seal; machine tagged out.',
   NULL, NULL, NULL, 'ast_ss2', 'emp_wes', 'emp_wes', NULL, 'internal',
   90, NULL, NULL, NULL, 'emp_brett', '2026-08-18 16:30:00', NULL, NULL,
   '2026-08-18 16:20:00', '2026-08-19 09:00:00'),
  ('rep_3', 'RT-2026-0003', 'billed', 'billed',
   'Factory-missed marriage line insulation',
   'Marriage line insulation was omitted at the factory on the rear third. Installed on site.',
   'job_2588', 'lot_2588_1', 'hom_a4', NULL, 'emp_marcus', 'emp_wes', 'Clayton Homes', 'manufacturer',
   180, 'Submitted with photos on the warranty portal; approved in full.', 46500, 'INV-2026-0311',
   'emp_joe', '2026-06-02 09:00:00', '2026-06-09 16:00:00', '2026-06-18 10:20:00',
   '2026-06-01 14:10:00', '2026-06-18 10:20:00');

INSERT INTO repair_labor_entries (id, repair_ticket_id, employee_id, worked_on, minutes, rate_cents_per_hour, description, recorded_by, created_at) VALUES
  ('lab_1', 'rep_1', 'emp_wes',    '2026-08-10', 120, 8500, 'Removed damaged panels, prepped wall', 'emp_wes', '2026-08-10 16:00:00'),
  ('lab_2', 'rep_1', 'emp_marcus', '2026-08-11',  90, 7500, 'Hung and trimmed replacement panels', 'emp_wes', '2026-08-11 15:30:00'),
  ('lab_3', 'rep_2', 'emp_wes',    '2026-08-19',  90, 8500, 'Tagged out, capped lines, pulled cylinder', 'emp_wes', '2026-08-19 09:00:00'),
  ('lab_4', 'rep_3', 'emp_wes',    '2026-06-09', 180, 8500, 'Opened rear third, installed insulation, closed up', 'emp_wes', '2026-06-09 16:00:00');

INSERT INTO repair_material_lines (id, repair_ticket_id, part_id, description, quantity, unit_cost_cents, inventory_movement_id, recorded_by, created_at) VALUES
  ('mtl_1', 'rep_1', NULL, 'Siding panels to match, 2 ea', 2, 8900, NULL, 'emp_wes', '2026-08-10 16:00:00'),
  ('mtl_2', 'rep_2', 'prt_hyd', 'Hydraulic hose, 3/8 in x 48 in', 1, 6200, NULL, 'emp_wes', '2026-08-19 09:00:00'),
  ('mtl_3', 'rep_3', 'prt_marriage', 'Marriage line gasket, 16 ft', 2, 2450, NULL, 'emp_wes', '2026-06-09 16:00:00');

INSERT INTO repair_status_events (id, repair_ticket_id, field, from_value, to_value, note, changed_by, created_at) VALUES
  ('evt_1', 'rep_1', 'status', 'reported', 'approved', 'Photos reviewed; proceed with repair.', 'emp_brandon', '2026-08-05 09:00:00'),
  ('evt_2', 'rep_1', 'status', 'in_progress', 'complete', NULL, 'emp_wes', '2026-08-11 15:30:00'),
  ('evt_3', 'rep_3', 'bill_back_status', 'ready_to_bill', 'billed', 'Warranty claim approved in full.', 'emp_tara', '2026-06-18 10:20:00');

------------------------------------------------------------------------------
-- Documents: Drive references for the paperwork, R2 rows omitted because no
-- object exists locally until someone uploads one through the portal.
------------------------------------------------------------------------------

INSERT INTO documents (id, document_type, storage_provider, storage_key, external_url, file_name, content_type,
                       byte_size, upload_status, caption, job_id, lot_id, home_id, uploaded_by, created_at) VALUES
  ('doc_1', 'plat',   'google_drive', '1PlatMillCreekLot12Demo',   'https://drive.google.com/file/d/1PlatMillCreekLot12Demo/view',   'Mill Creek Lot 12 plat.pdf',   NULL, NULL, 'stored', 'Recorded plat, phase 2', 'job_2601', 'lot_2601_12', NULL, 'emp_brandon', '2026-04-02 08:20:00'),
  ('doc_2', 'permit', 'google_drive', '1PermitMillCreekLot12Demo', 'https://drive.google.com/file/d/1PermitMillCreekLot12Demo/view', 'Mill Creek Lot 12 permit.pdf', NULL, NULL, 'stored', 'County setup permit',    'job_2601', 'lot_2601_12', NULL, 'emp_brandon', '2026-04-02 08:22:00'),
  ('doc_3', 'report', 'google_drive', '1CavcoDataPlateDemo',       'https://drive.google.com/file/d/1CavcoDataPlateDemo/view',       'Data plate CAV2026NC114772A.pdf', NULL, NULL, 'stored', 'Factory data plate scan', NULL, NULL, 'hom_a1', 'emp_marcus', '2026-08-04 17:00:00');

------------------------------------------------------------------------------
-- Monday board registry. Board and item ids here are placeholders: the real
-- ids are entered by an administrator on the portal's admin page.
------------------------------------------------------------------------------

INSERT INTO monday_boards (board_key, monday_board_id, name, canonical_key_kind, active, created_at) VALUES
  ('homes',     '1000000001', 'Homes (demo placeholder)',     'serial_number', 1, '2026-01-10 08:00:00'),
  ('equipment', '1000000002', 'Equipment (demo placeholder)', 'vin',           1, '2026-01-10 08:00:00'),
  ('jobs',      '1000000003', 'Jobs (demo placeholder)',      'job_number',    1, '2026-01-10 08:00:00');

INSERT INTO monday_links (id, entity_type, entity_id, canonical_key, board_key, monday_item_id, sync_state,
                          last_synced_at, created_at, updated_at) VALUES
  ('mlk_1', 'home',  'hom_a1',  'CAV2026NC114772A',  'homes',     '2000000011', 'linked', '2026-08-05 08:00:00', '2026-06-20 09:10:00', '2026-08-05 08:00:00'),
  ('mlk_2', 'asset', 'ast_dt1', '1FVACWDT0LHLR2201', 'equipment', '2000000042', 'linked', '2026-08-05 08:00:00', '2026-01-10 08:10:00', '2026-08-05 08:00:00'),
  ('mlk_3', 'job',   'job_2601','HP2601',            'jobs',      '2000000077', 'linked', '2026-08-05 08:00:00', '2026-04-02 08:30:00', '2026-08-05 08:00:00');

UPDATE homes          SET monday_item_id = '2000000011' WHERE id = 'hom_a1';
UPDATE assets         SET monday_item_id = '2000000042' WHERE id = 'ast_dt1';
UPDATE jobs           SET monday_item_id = '2000000077' WHERE id = 'job_2601';

------------------------------------------------------------------------------
-- Site addresses and owners of record.
--
-- Only the text is seeded. The normalized matching keys are derived from it by
-- backfillMatchKeys() when the seed is applied, so the seed can never disagree
-- with what the application would have written. Note lot 12 and lot 13 sit at
-- the same street number — deliberate, so the ambiguous-match path has
-- something real to exercise.
------------------------------------------------------------------------------

UPDATE homes SET
  site_address = '184 Mill Creek Rd Lot 12', site_city = 'Boone', site_state = 'NC', site_postal_code = '28607',
  site_address_notes = 'Gravel spur past the mailboxes; second drive on the left.',
  customer_name = 'Dana Whitfield',
  customer_phone = '(828) 555-0142',
  customer_email = 'dana.whitfield@example.com'
 WHERE id = 'hom_a1';

UPDATE homes SET
  site_address = '184 Mill Creek Rd Lot 13', site_city = 'Boone', site_state = 'NC', site_postal_code = '28607'
 WHERE id = 'hom_a2';

UPDATE homes SET
  site_address = '77 Ridgeview Ln', site_city = 'Lenoir', site_state = 'NC', site_postal_code = '28645',
  customer_name = 'Marcus and Joy Alvarez',
  customer_phone = '828-555-0177'
 WHERE id = 'hom_a3';

UPDATE homes SET
  site_address = '12 Bend Rd', site_city = 'Vilas', site_state = 'NC', site_postal_code = '28692',
  customer_name = 'Ray Pruitt',
  customer_phone = '(828) 555-0198',
  customer_email = 'ray.pruitt@example.com'
 WHERE id = 'hom_a4';



------------------------------------------------------------------------------
-- Notification routing. Warranty requests reach the supervisors by default;
-- this adds billing so Tara sees them too, and shows the shape of an override.
------------------------------------------------------------------------------

INSERT INTO notification_routes (id, category, recipient_kind, recipient_role, recipient_employee_id, active, created_by, created_at) VALUES
  ('nrt_warranty_sup',  'warranty_request', 'role', 'supervisor', NULL, 1, 'emp_admin', '2026-08-20 09:00:00'),
  ('nrt_warranty_bill', 'warranty_request', 'role', 'billing',    NULL, 1, 'emp_admin', '2026-08-20 09:00:00');
