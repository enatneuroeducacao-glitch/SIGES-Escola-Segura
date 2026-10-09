-- SIGES Territorial Data Platform
-- Migration 001: territorial catalog and auditable batch ingestion.
-- Apply only after confirming the target Supabase project and taking a backup.
create extension if not exists pgcrypto;
create table if not exists public.siges_ufs (
  uf char(2) primary key, name text not null, ibge_code char(2) unique not null,
  created_at timestamptz not null default now()
);
create table if not exists public.siges_municipalities (
  ibge_code char(7) primary key, name text not null,
  uf char(2) not null references public.siges_ufs(uf),
  is_active boolean not null default true, created_at timestamptz not null default now(),
  unique (name, uf)
);
create index if not exists siges_municipalities_uf_name_idx on public.siges_municipalities(uf, name);
create table if not exists public.siges_data_sources (
  id uuid primary key default gen_random_uuid(), source_key text not null unique, name text not null,
  publisher text, source_url text,
  data_granularity text not null default 'municipality'
    check (data_granularity in ('national','state','municipality','street','point','mixed')),
  default_format text, is_official boolean not null default false, active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now()
);
create table if not exists public.siges_import_jobs (
  id uuid primary key default gen_random_uuid(), source_id uuid references public.siges_data_sources(id),
  original_filename text not null, file_sha256 char(64), file_size_bytes bigint check (file_size_bytes is null or file_size_bytes >= 0),
  format text not null,
  status text not null default 'queued' check (status in ('queued','validating','ready','processing','completed','partial','failed','cancelled')),
  requested_by text, default_uf char(2) references public.siges_ufs(uf),
  default_municipality_ibge char(7) references public.siges_municipalities(ibge_code),
  period_start date, period_end date,
  rows_seen bigint not null default 0, rows_accepted bigint not null default 0,
  rows_rejected bigint not null default 0, rows_duplicate bigint not null default 0,
  error_summary text, mapping jsonb not null default '{}'::jsonb, metadata jsonb not null default '{}'::jsonb,
  started_at timestamptz, finished_at timestamptz, created_at timestamptz not null default now(),
  check (period_end is null or period_start is null or period_end >= period_start)
);
create index if not exists siges_import_jobs_status_created_idx on public.siges_import_jobs(status, created_at desc);
-- Immutable staging: preserve original source columns and validation outcome.
create table if not exists public.siges_raw_records (
  id bigint generated always as identity primary key,
  import_job_id uuid not null references public.siges_import_jobs(id) on delete restrict,
  row_number bigint not null check (row_number > 0), source_id uuid references public.siges_data_sources(id),
  uf char(2) references public.siges_ufs(uf), municipality_ibge char(7) references public.siges_municipalities(ibge_code),
  municipality_name_raw text, period_start date, period_end date,
  record_fingerprint char(64) not null, raw_payload jsonb not null,
  validation_status text not null default 'pending'
    check (validation_status in ('pending','accepted','rejected','duplicate')),
  validation_messages jsonb not null default '[]'::jsonb, imported_at timestamptz not null default now(),
  unique (import_job_id, row_number)
);
create index if not exists siges_raw_records_job_status_idx on public.siges_raw_records(import_job_id, validation_status);
create index if not exists siges_raw_records_territory_period_idx on public.siges_raw_records(uf, municipality_ibge, period_start);
create index if not exists siges_raw_records_fingerprint_idx on public.siges_raw_records(record_fingerprint);
create table if not exists public.siges_indicators (
  id bigint generated always as identity primary key, source_id uuid not null references public.siges_data_sources(id),
  municipality_ibge char(7) references public.siges_municipalities(ibge_code), uf char(2) references public.siges_ufs(uf),
  indicator_key text not null, indicator_label text not null, period_start date not null, period_end date not null,
  value numeric, unit text,
  geographic_level text not null check (geographic_level in ('national','state','municipality','street','point')),
  source_record_id bigint references public.siges_raw_records(id),
  revision integer not null default 1 check (revision > 0), is_current boolean not null default true,
  quality_status text not null default 'validated' check (quality_status in ('pending','validated','estimated','rejected')),
  metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(),
  check (period_end >= period_start),
  check (geographic_level <> 'municipality' or municipality_ibge is not null),
  check (geographic_level <> 'state' or uf is not null)
);
create index if not exists siges_indicators_geo_period_idx on public.siges_indicators(uf, municipality_ibge, indicator_key, period_start);
create index if not exists siges_indicators_current_idx on public.siges_indicators(is_current, quality_status, period_start);
-- RLS is enabled now. Add role/territory-specific policies after mapping the real auth model.
-- This deliberately avoids accidental public exposure during initial rollout.
alter table public.siges_ufs enable row level security;
alter table public.siges_municipalities enable row level security;
alter table public.siges_data_sources enable row level security;
alter table public.siges_import_jobs enable row level security;
alter table public.siges_raw_records enable row level security;
alter table public.siges_indicators enable row level security;
