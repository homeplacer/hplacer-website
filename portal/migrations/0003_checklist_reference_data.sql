-- 0003_checklist_reference_data.sql
--
-- Reference data only: the inspection checklists themselves. These are Home
-- Placer's own operating procedures, not employee, customer, or vendor data, so
-- they belong in source control and ship with the schema.

PRAGMA foreign_keys = ON;

------------------------------------------------------------------------------
-- Daily pre-use equipment inspections
------------------------------------------------------------------------------

INSERT INTO checklist_templates (id, template_key, name, inspection_kind, applies_to, asset_type, meter_prompt) VALUES
  ('tpl_daily_excavator',  'daily_excavator',  'Excavator pre-use',     'daily_equipment', 'asset', 'excavator',     'hours'),
  ('tpl_daily_skid_steer', 'daily_skid_steer', 'Skid steer pre-use',    'daily_equipment', 'asset', 'skid_steer',    'hours'),
  ('tpl_daily_bulldozer',  'daily_bulldozer',  'Bulldozer pre-use',     'daily_equipment', 'asset', 'bulldozer',     'hours'),
  ('tpl_daily_trailer',    'daily_trailer',    'Trailer pre-trip',      'daily_equipment', 'asset', 'trailer',       NULL),
  ('tpl_daily_dump_truck', 'daily_dump_truck', 'Dump truck pre-trip',   'daily_equipment', 'asset', 'dump_truck',    'miles'),
  ('tpl_daily_pickup',     'daily_pickup',     'Pickup pre-trip',       'daily_equipment', 'asset', 'pickup_truck',  'miles'),
  ('tpl_daily_other',      'daily_other',      'General pre-use',       'daily_equipment', 'asset', 'other',         NULL);

-- Heavy equipment (excavator / skid steer / bulldozer)
INSERT INTO checklist_items (id, template_id, checklist_key, question, sort_order, critical) VALUES
  ('ci_exc_1', 'tpl_daily_excavator', 'walkaround',      'Walk-around complete, no new damage or leaks under the machine', 1, 0),
  ('ci_exc_2', 'tpl_daily_excavator', 'engine_oil',      'Engine oil at correct level',                                    2, 1),
  ('ci_exc_3', 'tpl_daily_excavator', 'hydraulic_fluid', 'Hydraulic fluid at correct level, no hose chafing or weeping',   3, 1),
  ('ci_exc_4', 'tpl_daily_excavator', 'coolant',         'Coolant at correct level',                                       4, 1),
  ('ci_exc_5', 'tpl_daily_excavator', 'tracks',          'Tracks/undercarriage tensioned, no missing pads or bolts',       5, 0),
  ('ci_exc_6', 'tpl_daily_excavator', 'bucket_teeth',    'Bucket, teeth, and coupler secure',                              6, 0),
  ('ci_exc_7', 'tpl_daily_excavator', 'controls',        'Controls, horn, and backup alarm work',                          7, 1),
  ('ci_exc_8', 'tpl_daily_excavator', 'seatbelt',        'Seat belt and ROPS intact',                                      8, 1),
  ('ci_exc_9', 'tpl_daily_excavator', 'fire_ext',        'Fire extinguisher present and charged',                          9, 0);

INSERT INTO checklist_items (id, template_id, checklist_key, question, sort_order, critical) VALUES
  ('ci_skd_1', 'tpl_daily_skid_steer', 'walkaround',      'Walk-around complete, no new damage or leaks',               1, 0),
  ('ci_skd_2', 'tpl_daily_skid_steer', 'engine_oil',      'Engine oil at correct level',                                2, 1),
  ('ci_skd_3', 'tpl_daily_skid_steer', 'hydraulic_fluid', 'Hydraulic fluid at correct level, couplers clean',           3, 1),
  ('ci_skd_4', 'tpl_daily_skid_steer', 'tires_tracks',    'Tires or tracks serviceable',                                4, 0),
  ('ci_skd_5', 'tpl_daily_skid_steer', 'attachment',      'Attachment pins/locks fully engaged',                        5, 1),
  ('ci_skd_6', 'tpl_daily_skid_steer', 'safety_bar',      'Seat bar, seat belt, and interlocks function',               6, 1),
  ('ci_skd_7', 'tpl_daily_skid_steer', 'lights_alarm',    'Lights and backup alarm work',                               7, 0);

INSERT INTO checklist_items (id, template_id, checklist_key, question, sort_order, critical) VALUES
  ('ci_dzr_1', 'tpl_daily_bulldozer', 'walkaround',      'Walk-around complete, no new damage or leaks',   1, 0),
  ('ci_dzr_2', 'tpl_daily_bulldozer', 'engine_oil',      'Engine oil at correct level',                    2, 1),
  ('ci_dzr_3', 'tpl_daily_bulldozer', 'hydraulic_fluid', 'Hydraulic fluid at correct level',               3, 1),
  ('ci_dzr_4', 'tpl_daily_bulldozer', 'undercarriage',   'Undercarriage and grousers serviceable',         4, 0),
  ('ci_dzr_5', 'tpl_daily_bulldozer', 'blade',           'Blade, cutting edge, and pins secure',           5, 0),
  ('ci_dzr_6', 'tpl_daily_bulldozer', 'controls',        'Controls, horn, and backup alarm work',          6, 1),
  ('ci_dzr_7', 'tpl_daily_bulldozer', 'seatbelt',        'Seat belt and ROPS intact',                      7, 1);

-- Towed and road equipment
INSERT INTO checklist_items (id, template_id, checklist_key, question, sort_order, critical) VALUES
  ('ci_trl_1', 'tpl_daily_trailer', 'coupler',      'Coupler, safety chains, and breakaway cable secure',       1, 1),
  ('ci_trl_2', 'tpl_daily_trailer', 'tires',        'Tire pressure and tread acceptable, lug nuts tight',       2, 1),
  ('ci_trl_3', 'tpl_daily_trailer', 'brakes',       'Trailer brakes engage',                                    3, 1),
  ('ci_trl_4', 'tpl_daily_trailer', 'lights',       'Running, brake, and turn lights work',                     4, 1),
  ('ci_trl_5', 'tpl_daily_trailer', 'deck',         'Deck, ramps, and tie-down points sound',                   5, 0),
  ('ci_trl_6', 'tpl_daily_trailer', 'straps',       'Chains, binders, and straps rated and undamaged',          6, 1),
  ('ci_trl_7', 'tpl_daily_trailer', 'registration', 'Registration and annual inspection current',               7, 0);

INSERT INTO checklist_items (id, template_id, checklist_key, question, sort_order, critical) VALUES
  ('ci_dmp_1', 'tpl_daily_dump_truck', 'walkaround',  'Walk-around complete, no leaks or new damage',       1, 0),
  ('ci_dmp_2', 'tpl_daily_dump_truck', 'fluids',      'Engine oil and coolant at correct levels',           2, 1),
  ('ci_dmp_3', 'tpl_daily_dump_truck', 'tires',       'Tire pressure and tread acceptable, lug nuts tight', 3, 1),
  ('ci_dmp_4', 'tpl_daily_dump_truck', 'brakes',      'Service and parking brakes hold',                    4, 1),
  ('ci_dmp_5', 'tpl_daily_dump_truck', 'lights',      'Lights, turn signals, and backup alarm work',        5, 1),
  ('ci_dmp_6', 'tpl_daily_dump_truck', 'hoist',       'Hoist, tailgate latch, and body pins operate',       6, 1),
  ('ci_dmp_7', 'tpl_daily_dump_truck', 'tarp',        'Tarp system operates and covers the load',           7, 0),
  ('ci_dmp_8', 'tpl_daily_dump_truck', 'paperwork',   'Registration, insurance, and inspection current',    8, 0);

INSERT INTO checklist_items (id, template_id, checklist_key, question, sort_order, critical) VALUES
  ('ci_pkp_1', 'tpl_daily_pickup', 'walkaround', 'Walk-around complete, no leaks or new damage',      1, 0),
  ('ci_pkp_2', 'tpl_daily_pickup', 'fluids',     'Engine oil and coolant at correct levels',          2, 1),
  ('ci_pkp_3', 'tpl_daily_pickup', 'tires',      'Tire pressure and tread acceptable',                3, 1),
  ('ci_pkp_4', 'tpl_daily_pickup', 'lights',     'Lights and turn signals work',                      4, 1),
  ('ci_pkp_5', 'tpl_daily_pickup', 'hitch',      'Hitch, ball, and wiring serviceable',               5, 0),
  ('ci_pkp_6', 'tpl_daily_pickup', 'load',       'Bed load secured',                                  6, 0),
  ('ci_pkp_7', 'tpl_daily_pickup', 'paperwork',  'Registration and insurance current',                7, 0);

INSERT INTO checklist_items (id, template_id, checklist_key, question, sort_order, critical) VALUES
  ('ci_oth_1', 'tpl_daily_other', 'condition',  'Equipment is in serviceable condition',   1, 1),
  ('ci_oth_2', 'tpl_daily_other', 'guards',     'Guards and safety devices in place',      2, 1),
  ('ci_oth_3', 'tpl_daily_other', 'fluids',     'Fluids and fuel at correct levels',       3, 0);

------------------------------------------------------------------------------
-- Manufactured home reports
------------------------------------------------------------------------------

INSERT INTO checklist_templates (id, template_key, name, inspection_kind, applies_to, asset_type, meter_prompt) VALUES
  ('tpl_home_delivery', 'home_delivery', 'Home delivery report',   'delivery',         'home', NULL, NULL),
  ('tpl_home_setup',    'home_setup',    'Home setup report',      'setup',            'home', NULL, NULL),
  ('tpl_home_final',    'home_final',    'Final inspection',       'final_inspection', 'home', NULL, NULL);

INSERT INTO checklist_items (id, template_id, checklist_key, question, sort_order, critical) VALUES
  ('ci_del_1', 'tpl_home_delivery', 'serial_verified',  'Serial number on the data plate matches the order',        1, 1),
  ('ci_del_2', 'tpl_home_delivery', 'hud_labels',       'HUD labels present on every section',                      2, 1),
  ('ci_del_3', 'tpl_home_delivery', 'exterior_damage',  'No transport damage to siding, roof, or shingles',         3, 0),
  ('ci_del_4', 'tpl_home_delivery', 'glass',            'Windows and glass doors intact',                           4, 0),
  ('ci_del_5', 'tpl_home_delivery', 'interior_damage',  'No interior damage from transport',                        5, 0),
  ('ci_del_6', 'tpl_home_delivery', 'ship_loose',       'Ship-loose parts inventory complete',                      6, 1),
  ('ci_del_7', 'tpl_home_delivery', 'site_access',      'Site access adequate for the set',                         7, 0),
  ('ci_del_8', 'tpl_home_delivery', 'placement',        'Sections placed on the correct lot and orientation',        8, 1);

INSERT INTO checklist_items (id, template_id, checklist_key, question, sort_order, critical) VALUES
  ('ci_set_1',  'tpl_home_setup', 'piers',        'Piers set per the manufacturer footing plan',          1, 1),
  ('ci_set_2',  'tpl_home_setup', 'anchors',      'Anchors and straps installed to spec',                 2, 1),
  ('ci_set_3',  'tpl_home_setup', 'level',        'Home level within tolerance across all sections',      3, 1),
  ('ci_set_4',  'tpl_home_setup', 'marriage',     'Marriage line closed, bolted, and gasketed',           4, 1),
  ('ci_set_5',  'tpl_home_setup', 'crossovers',   'Duct, water, and electrical crossovers connected',     5, 1),
  ('ci_set_6',  'tpl_home_setup', 'plumbing',     'Plumbing pressure tested, no leaks',                   6, 1),
  ('ci_set_7',  'tpl_home_setup', 'electrical',   'Panel bonded, service connected, GFCIs tested',        7, 1),
  ('ci_set_8',  'tpl_home_setup', 'hvac',         'HVAC operating in heat and cool',                      8, 0),
  ('ci_set_9',  'tpl_home_setup', 'skirting',     'Skirting and vents installed',                         9, 0),
  ('ci_set_10', 'tpl_home_setup', 'steps',        'Steps, landings, and handrails installed',            10, 0);

INSERT INTO checklist_items (id, template_id, checklist_key, question, sort_order, critical) VALUES
  ('ci_fin_1', 'tpl_home_final', 'punch_complete', 'All punch-list items closed',                      1, 1),
  ('ci_fin_2', 'tpl_home_final', 'doors_windows',  'Doors and windows operate and seal',               2, 0),
  ('ci_fin_3', 'tpl_home_final', 'appliances',     'Appliances operate',                               3, 0),
  ('ci_fin_4', 'tpl_home_final', 'smoke_co',       'Smoke and CO alarms installed and tested',         4, 1),
  ('ci_fin_5', 'tpl_home_final', 'egress',         'Egress windows and exterior doors unobstructed',   5, 1),
  ('ci_fin_6', 'tpl_home_final', 'cleanup',        'Site cleaned, debris and packaging removed',       6, 0),
  ('ci_fin_7', 'tpl_home_final', 'permit_signoff', 'Local inspection signed off',                      7, 1),
  ('ci_fin_8', 'tpl_home_final', 'homeowner',      'Homeowner walkthrough completed and documented',   8, 0);
