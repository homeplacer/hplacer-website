-- Private R2 insurance-card PDFs sourced from the supplied State Farm cards.
-- Each document is tied to the exact verified vehicle; bytes are never public.

INSERT OR IGNORE INTO documents
  (id, document_type, storage_provider, storage_key, external_url, file_name,
   content_type, byte_size, checksum_sha256, upload_status, caption, asset_id,
   uploaded_by, created_at)
VALUES
  ('doc_insurance_fleet_019', 'other', 'r2', 'assets/ast_fleet_019/insurance-card-2026-07-30.pdf', NULL,
   '2024-RAM-3500-insurance-card.pdf', 'application/pdf', 828928,
   'a4a9baddb2577a04d212ac26fc621a0fe58f05d6f818deed1aa5ed05e9b2df2c', 'stored',
   'State Farm insurance card — effective July 30, 2026; expires January 30, 2027.', 'ast_fleet_019', 'emp_carolina_admin', CURRENT_TIMESTAMP),
  ('doc_insurance_fleet_020', 'other', 'r2', 'assets/ast_fleet_020/insurance-card-2026-07-30.pdf', NULL,
   '2023-GMC-Sierra-2500-insurance-card.pdf', 'application/pdf', 828936,
   '619383cd634eb0e1c5a39ae798b7b639c78255e9db73e974fc3ab0f298d7c089', 'stored',
   'State Farm insurance card — effective July 30, 2026; expires January 30, 2027.', 'ast_fleet_020', 'emp_carolina_admin', CURRENT_TIMESTAMP),
  ('doc_insurance_fleet_021', 'other', 'r2', 'assets/ast_fleet_021/insurance-card-2026-07-30.pdf', NULL,
   '2019-Ford-F550-insurance-card.pdf', 'application/pdf', 828929,
   'a42802a802938f7102633d1b6d40d19463d2aa22189d46140f14b3dbfc606d3b', 'stored',
   'State Farm insurance card — effective July 30, 2026; expires January 30, 2027.', 'ast_fleet_021', 'emp_carolina_admin', CURRENT_TIMESTAMP),
  ('doc_insurance_fleet_023', 'other', 'r2', 'assets/ast_fleet_023/insurance-card-2026-07-30.pdf', NULL,
   '2006-Ford-F350-insurance-card.pdf', 'application/pdf', 828932,
   '513bdca06a0e3f421e54ed4f6bab289664fb433920ba438621736f864faca921', 'stored',
   'State Farm insurance card — effective July 30, 2026; expires January 30, 2027.', 'ast_fleet_023', 'emp_carolina_admin', CURRENT_TIMESTAMP);
