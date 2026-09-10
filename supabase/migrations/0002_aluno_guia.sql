create table if not exists public.student_guide_assessments (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.units(id) on delete cascade,
  student_code text not null,
  display_name text not null,
  school_class text,
  assessment_date date not null default current_date,
  status text not null default 'RASCUNHO' check (status in ('RASCUNHO','VALIDADO','ARQUIVADO')),
  d numeric(5,2) check (d between 0 and 100),
  o numeric(5,2) check (o between 0 and 100),
  t numeric(5,2) check (t between 0 and 100),
  h numeric(5,2) check (h between 0 and 100),
  p numeric(5,2) check (p between 0 and 100),
  hsi_global numeric(6,2) generated always as (round(((coalesce(d,0)+coalesce(o,0)+coalesce(t,0)+coalesce(h,0)+coalesce(p,0))/5.0)::numeric,2)) stored,
  risk_level text generated always as (
    case
      when (coalesce(d,0)+coalesce(o,0)+coalesce(t,0)+coalesce(h,0)+coalesce(p,0))/5.0 < 40 then 'MUITO ALTO'
      when (coalesce(d,0)+coalesce(o,0)+coalesce(t,0)+coalesce(h,0)+coalesce(p,0))/5.0 < 60 then 'ALTO'
      when (coalesce(d,0)+coalesce(o,0)+coalesce(t,0)+coalesce(h,0)+coalesce(p,0))/5.0 < 75 then 'MODERADO'
      else 'BAIXO'
    end
  ) stored,
  risk_text text,
  priority_need text,
  recommendations text,
  evidence_summary text,
  evaluated_by uuid references auth.users(id),
  validated_by uuid references auth.users(id),
  validated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists student_guide_unit_idx on public.student_guide_assessments(unit_id);
create index if not exists student_guide_risk_idx on public.student_guide_assessments(risk_level);
create index if not exists student_guide_date_idx on public.student_guide_assessments(assessment_date desc);

alter table public.student_guide_assessments enable row level security;

create policy "authenticated read student guide assessments" on public.student_guide_assessments
  for select to authenticated using (true);

create policy "authorized insert student guide assessments" on public.student_guide_assessments
  for insert to authenticated
  with check (evaluated_by = auth.uid());

create policy "authorized update student guide assessments" on public.student_guide_assessments
  for update to authenticated
  using (evaluated_by = auth.uid())
  with check (evaluated_by = auth.uid());

comment on table public.student_guide_assessments is 'Relatório individual do Aluno Guia: dados mensurados pelo HSI-DOTH-P Escolar, nível de necessidade/risco, interpretação e recomendações para gestão escolar e municipal. Uso sujeito a controle de acesso e LGPD.';
comment on column public.student_guide_assessments.student_code is 'Código pseudonimizado do estudante; evitar CPF e outros identificadores desnecessários.';
comment on column public.student_guide_assessments.hsi_global is 'Média aritmética dos cinco domínios D-O-T-H-P, escala 0-100, para triagem educativa.';
comment on column public.student_guide_assessments.risk_level is 'Classificação de necessidade educativa: BAIXO, MODERADO, ALTO ou MUITO ALTO.';
