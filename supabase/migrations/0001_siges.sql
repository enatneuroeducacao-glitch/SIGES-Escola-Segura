create extension if not exists pgcrypto;

create table if not exists public.profiles (id uuid primary key references auth.users(id) on delete cascade, full_name text, role text not null default 'viewer' check (role in ('admin','manager','field_agent','viewer')), created_at timestamptz not null default now());
create table if not exists public.units (id uuid primary key default gen_random_uuid(), name text not null, unit_type text not null, neighborhood text, address text, rank integer, d numeric(5,2), o numeric(5,2), t numeric(5,2), h numeric(5,2), p numeric(5,2), hsi numeric(6,2), infrastructure_score numeric(6,2), exposure_score numeric(6,2), technical_evidence_score numeric(6,2), public_evidence_score numeric(6,2), confidence_score numeric(6,2), ipe numeric(6,2), priority text, student_guide text, behavior_flag text, traffic_flag text, physical_infrastructure_flag text, transport_crossing_flag text, accessibility_flag text, speed_kmh numeric, vdm numeric, crashes_3y numeric, crossings numeric, sidewalk text, signage text, lighting text, pickup_dropoff text, cyclists text, primary_source text, data_status text, recommended_action text, observations text, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table if not exists public.evidence (id uuid primary key default gen_random_uuid(), unit_id uuid references public.units(id) on delete cascade, evidence_type text not null, status text not null, description text, source_name text, source_url text, source_date date, confidence text, created_at timestamptz not null default now());
create table if not exists public.field_surveys (id uuid primary key default gen_random_uuid(), unit_id uuid not null references public.units(id) on delete cascade, surveyed_at timestamptz not null default now(), surveyed_by uuid references auth.users(id), speed_kmh numeric, vdm numeric, crashes_3y numeric, crossings numeric, sidewalk text, signage text, lighting text, pickup_dropoff text, cyclists text, accessibility text, pedestrian_flow text, notes text, status text not null default 'draft' check (status in ('draft','submitted','validated')));
create table if not exists public.interventions (id uuid primary key default gen_random_uuid(), unit_id uuid not null references public.units(id) on delete cascade, title text not null, description text, phase text not null default 'immediate' check (phase in ('immediate','0-30','31-90','91-180','continuous')), responsible text, status text not null default 'planned' check (status in ('planned','in_progress','blocked','completed')), due_date date, evidence_required text, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table if not exists public.audit_log (id bigint generated always as identity primary key, user_id uuid references auth.users(id), action text not null, entity text, entity_id uuid, details jsonb, created_at timestamptz not null default now());

alter table public.profiles enable row level security;
alter table public.units enable row level security;
alter table public.evidence enable row level security;
alter table public.field_surveys enable row level security;
alter table public.interventions enable row level security;
alter table public.audit_log enable row level security;

create policy "authenticated read units" on public.units for select to authenticated using (true);
create policy "authenticated read evidence" on public.evidence for select to authenticated using (true);
create policy "authenticated read surveys" on public.field_surveys for select to authenticated using (true);
create policy "authenticated read interventions" on public.interventions for select to authenticated using (true);
create policy "authenticated read profiles" on public.profiles for select to authenticated using (id = auth.uid());
create policy "authenticated insert surveys" on public.field_surveys for insert to authenticated with check (surveyed_by = auth.uid());
create policy "authenticated update own surveys" on public.field_surveys for update to authenticated using (surveyed_by = auth.uid()) with check (surveyed_by = auth.uid());

create index if not exists units_priority_idx on public.units(priority);
create index if not exists units_ipe_idx on public.units(ipe desc);
create index if not exists units_neighborhood_idx on public.units(neighborhood);
create index if not exists evidence_unit_idx on public.evidence(unit_id);
create index if not exists surveys_unit_idx on public.field_surveys(unit_id);

insert into public.units (name,unit_type,neighborhood,address,rank,d,o,t,h,p,hsi,infrastructure_score,exposure_score,technical_evidence_score,public_evidence_score,confidence_score,ipe,priority,student_guide,behavior_flag,traffic_flag,physical_infrastructure_flag,transport_crossing_flag,accessibility_flag,speed_kmh,vdm,crashes_3y,crossings,sidewalk,signage,lighting,pickup_dropoff,cyclists,primary_source,data_status,recommended_action,observations) values
('Escola Municipal Prof Ada Santanna da Silveira','Escola','Paranaguamirim','Rua Monsenhor Gercino, 6674',1,18,17,19,19,18,91,75,75,100,70,90,85,'P1 - Crítica','SIM','SIM','SIM','SIM','AVALIAR','AVALIAR',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'DETRANS — estudo técnico específico','TRIAGEM — sem vistoria de campo','Validar em campo e priorizar investigação/intervenção.','DETRANS — estudo técnico específico'),
('Escola Municipal Prof Lacy Luiza da Cruz Flores','Escola','João Costa','Rua Waldemiro José Borges, 3997',2,18,18,18,18,18,90,75,75,100,70,90,84,'P1 - Crítica','SIM','SIM','SIM','SIM','AVALIAR','AVALIAR',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'DETRANS — estudo técnico específico','TRIAGEM — sem vistoria de campo','Validar em campo e priorizar investigação/intervenção.','DETRANS — estudo técnico específico'),
('Escola Municipal Professor Oswaldo Cabral','Escola','Jarivatuba','Rua Monsenhor Gercino, 3134',3,18,18,18,18,18,90,75,75,100,70,90,84,'P1 - Crítica','SIM','SIM','SIM','SIM','AVALIAR','AVALIAR',40,8137,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'DETRANS — estudo técnico específico','TRIAGEM — sem vistoria de campo','Validar em campo e priorizar investigação/intervenção.','DETRANS — estudo técnico específico'),
('Escola Municipal Padre Valente Simioni','Escola','Boa Vista','Rua Albano Schmidt, 5164',4,18,18,18,18,18,90,75,75,100,70,90,84,'P1 - Crítica','SIM','SIM','SIM','SIM','AVALIAR','AVALIAR',40,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'DETRANS — estudo técnico específico','TRIAGEM — sem vistoria de campo','Validar em campo e priorizar investigação/intervenção.','DETRANS — estudo técnico específico')
ON CONFLICT DO NOTHING;
