create table if not exists public.city_data_context (
  id uuid primary key default gen_random_uuid(),
  edition text not null default 'Joinville Cidade em Dados 2025',
  source_name text not null,
  source_url text,
  source_date date,
  data_year integer,
  category text not null,
  metric_key text not null,
  metric_label text not null,
  value_numeric numeric,
  value_text text,
  unit text,
  notes text,
  created_at timestamptz not null default now(),
  unique(edition, metric_key)
);

alter table public.city_data_context enable row level security;
drop policy if exists city_data_context_public_read on public.city_data_context;
create policy city_data_context_public_read on public.city_data_context for select to anon, authenticated using (true);

-- Data rows are loaded in the deployed database from the official Joinville Cidade em Dados 2025 publication.
