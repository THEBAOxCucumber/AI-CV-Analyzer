ALTER TABLE job_descriptions
  ADD COLUMN source VARCHAR(50) NULL AFTER description,
  ADD COLUMN external_job_id VARCHAR(255) NULL AFTER source,
  ADD COLUMN source_url TEXT NULL AFTER external_job_id,
  ADD COLUMN location VARCHAR(255) NULL AFTER source_url,
  ADD COLUMN employment_type VARCHAR(100) NULL AFTER location,
  ADD COLUMN salary VARCHAR(255) NULL AFTER employment_type,
  ADD COLUMN posted_at DATETIME NULL AFTER salary;

CREATE UNIQUE INDEX uq_job_descriptions_user_source_external
  ON job_descriptions (
    user_id,
    source,
    external_job_id
  );