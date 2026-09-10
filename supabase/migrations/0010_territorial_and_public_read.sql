alter table public.units add column if not exists corridor_normalized text;
alter table public.units add column if not exists detrans_in_corridor text;
alter table public.units add column if not exists detrans_studies_count numeric;
alter table public.units add column if not exists detrans_proximity text;
alter table public.units add column if not exists detrans_point text;
alter table public.units add column if not exists accidents_corridor_2023 numeric;
alter table public.units add column if not exists accidents_corridor_2024 numeric;
alter table public.units add column if not exists accident_rank_2024 numeric;
alter table public.units add column if not exists accident_evidence_score numeric;
alter table public.units add column if not exists detrans_evidence_score numeric;
alter table public.units add column if not exists territorial_data_available text;
alter table public.units add column if not exists territorial_confidence text;
alter table public.units add column if not exists ipe_territorial numeric(6,2);
alter table public.units add column if not exists territorial_priority text;
alter table public.units add column if not exists territorial_justification text;
alter table public.units add column if not exists territorial_primary_source text;

create index if not exists units_territorial_priority_idx on public.units(territorial_priority);
create index if not exists units_territorial_ipe_idx on public.units(ipe_territorial desc);
create unique index if not exists evidence_unit_type_date_uidx on public.evidence(unit_id,evidence_type,source_date);

-- O painel territorial pode ser consultado sem expor dados individuais do Aluno Guia.
create policy "public read units" on public.units for select to anon using (true);
create policy "public read evidence" on public.evidence for select to anon using (true);
