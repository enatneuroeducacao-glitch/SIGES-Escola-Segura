-- SIGES: large-file RENAEST ingestion, isolated from the existing JSON database.
-- Apply only after DATABASE_URL is explicitly configured for the SIGES PostgreSQL database.
CREATE TABLE IF NOT EXISTS siges_import_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dataset TEXT NOT NULL CHECK (dataset IN ('renaest_vitimas','renaest_acidentes')),
  source_name TEXT NOT NULL,
  source_sha256 TEXT,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','processing','completed','partial','failed','cancelled')),
  file_bytes BIGINT,
  entries_seen INTEGER NOT NULL DEFAULT 0,
  rows_read BIGINT NOT NULL DEFAULT 0,
  rows_inserted BIGINT NOT NULL DEFAULT 0,
  rows_duplicate BIGINT NOT NULL DEFAULT 0,
  rows_rejected BIGINT NOT NULL DEFAULT 0,
  current_entry TEXT,
  period_start DATE,
  period_end DATE,
  error_summary TEXT,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS siges_import_jobs_dataset_created_idx ON siges_import_jobs(dataset, created_at DESC);
CREATE TABLE IF NOT EXISTS siges_renaest_records (
  id BIGSERIAL PRIMARY KEY,
  dataset TEXT NOT NULL CHECK (dataset IN ('renaest_vitimas','renaest_acidentes')),
  import_job_id UUID NOT NULL REFERENCES siges_import_jobs(id),
  source_name TEXT NOT NULL,
  source_entry TEXT NOT NULL,
  period_year SMALLINT,
  period_month SMALLINT CHECK (period_month BETWEEN 1 AND 12),
  municipality_code TEXT,
  municipality_name TEXT,
  uf CHAR(2),
  record_hash CHAR(64) NOT NULL,
  row_data JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT siges_renaest_record_dedupe UNIQUE(dataset, record_hash)
);
CREATE INDEX IF NOT EXISTS siges_renaest_records_period_idx ON siges_renaest_records(dataset, period_year, period_month);
CREATE INDEX IF NOT EXISTS siges_renaest_records_municipality_idx ON siges_renaest_records(municipality_code, uf);
CREATE INDEX IF NOT EXISTS siges_renaest_records_job_idx ON siges_renaest_records(import_job_id);
CREATE INDEX IF NOT EXISTS siges_renaest_records_row_data_gin_idx ON siges_renaest_records USING GIN(row_data);
CREATE OR REPLACE VIEW siges_renaest_import_summary AS
SELECT dataset, period_year, period_month, uf, municipality_code, municipality_name, COUNT(*)::BIGINT AS records_imported
FROM siges_renaest_records GROUP BY dataset, period_year, period_month, uf, municipality_code, municipality_name;
