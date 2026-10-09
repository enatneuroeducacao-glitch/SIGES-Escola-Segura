-- SIGES public-data ingestion metadata. Additive only; no operational tables are modified.
create table if not exists public.data_source_catalog (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  organization text not null,
  name text not null,
  homepage_url text,
  catalog_url text,
  access_method text not null default 'manual_review'
    check (access_method in ('api','catalog_api','download','arcgis_rest','manual_review')),
  expected_frequency text,
  license_notes text,
  is_active boolean not null default true,
  last_checked_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.data_source_resources (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.data_source_catalog(id) on delete restrict,
  external_resource_id text,
  resource_name text not null,
  resource_url text not null,
  release_date date,
  media_type text,
  content_length_bytes bigint check (content_length_bytes is null or content_length_bytes >= 0),
  checksum_sha256 text,
  discovered_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_id, resource_url)
);

create index if not exists idx_data_source_resources_source_release
  on public.data_source_resources (source_id, release_date desc);
create index if not exists idx_data_source_resources_last_seen
  on public.data_source_resources (last_seen_at desc);

create table if not exists public.data_ingestion_runs (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.data_source_catalog(id) on delete restrict,
  resource_id uuid references public.data_source_resources(id) on delete restrict,
  status text not null default 'queued'
    check (status in ('queued','running','succeeded','partial','failed','cancelled')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  records_read bigint not null default 0 check (records_read >= 0),
  records_inserted bigint not null default 0 check (records_inserted >= 0),
  records_updated bigint not null default 0 check (records_updated >= 0),
  records_skipped bigint not null default 0 check (records_skipped >= 0),
  records_rejected bigint not null default 0 check (records_rejected >= 0),
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check (finished_at is null or finished_at >= started_at)
);

create index if not exists idx_data_ingestion_runs_source_started
  on public.data_ingestion_runs (source_id, started_at desc);
create index if not exists idx_data_ingestion_runs_status_started
  on public.data_ingestion_runs (status, started_at desc);

alter table public.data_source_catalog enable row level security;
alter table public.data_source_resources enable row level security;
alter table public.data_ingestion_runs enable row level security;

comment on table public.data_source_catalog is 'Catálogo de fontes públicas aprovadas para coleta de dados do SIGES; não contém dados de pessoas.';
comment on table public.data_source_resources is 'Recursos/arquivos descobertos em catálogos oficiais, com URL, referência e metadados de coleta.';
comment on table public.data_ingestion_runs is 'Histórico auditável de execuções de ingestão; grava contagens e erros, sem conteúdo pessoal bruto.';
