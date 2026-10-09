-- Index the optional resource foreign key used when reviewing ingestion runs.
create index if not exists idx_data_ingestion_runs_resource_id on public.data_ingestion_runs (resource_id);
