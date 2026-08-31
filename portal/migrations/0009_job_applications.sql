-- Private applicant records from the public Careers page. Resume objects live
-- in the existing private R2 bucket and are never stored as public URLs.

CREATE TABLE job_applications (
  id TEXT PRIMARY KEY,
  reference TEXT NOT NULL UNIQUE,
  position TEXT NOT NULL,
  applicant_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  city_state TEXT,
  available_date TEXT,
  experience TEXT,
  credentials TEXT,
  references_text TEXT,
  resume_key TEXT,
  resume_file_name TEXT,
  resume_content_type TEXT,
  resume_byte_size INTEGER,
  status TEXT NOT NULL DEFAULT 'received'
    CHECK (status IN ('received', 'reviewing', 'contacted', 'not_selected', 'hired', 'withdrawn')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK ((resume_key IS NULL AND resume_file_name IS NULL AND resume_content_type IS NULL AND resume_byte_size IS NULL)
      OR (resume_key IS NOT NULL AND resume_file_name IS NOT NULL AND resume_content_type IS NOT NULL AND resume_byte_size > 0))
);

CREATE INDEX idx_job_applications_status_created ON job_applications(status, created_at DESC);
CREATE INDEX idx_job_applications_email ON job_applications(email);

INSERT INTO notification_categories (category, label, description, default_role)
VALUES ('job_application', 'Job application', 'A candidate applied through the public Careers page', 'admin');
