create table if not exists public.student_guide_assessments (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.units(id) on delete cascade,
  student_code text not null,
  display_name text not null,
  school_class text,
  assessment_date date,
  assessed_by uuid references auth.users(id),
  status text not null default 'DRAFT' check (status in ('DRAFT','VALIDADO','ARQUIVADO')),
  d numeric(6,2),
  o numeric(6,2),
  t numeric(6,2),
  h numeric(6,2),
  p numeric(6,2),
  hsi_global numeric(6,2),
  risk_level text,
  risk_text text,
  priority_need text,
  recommendations text,
  evidence_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists student_guide_unit_idx on public.student_guide_assessments(unit_id);
create index if not exists student_guide_risk_idx on public.student_guide_assessments(risk_level);
create index if not exists student_guide_date_idx on public.student_guide_assessments(assessment_date desc);

alter table public.student_guide_assessments enable row level security;
create policy "authenticated read student guide" on public.student_guide_assessments for select to authenticated using (true);
create policy "authenticated insert student guide" on public.student_guide_assessments for insert to authenticated with check (assessed_by = auth.uid());
create policy "authenticated update own student guide" on public.student_guide_assessments for update to authenticated using (assessed_by = auth.uid()) with check (assessed_by = auth.uid());
