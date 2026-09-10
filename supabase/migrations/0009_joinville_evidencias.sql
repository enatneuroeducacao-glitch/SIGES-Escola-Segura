insert into public.evidence (unit_id,evidence_type,status,description,source_name,source_date,confidence)
select id,'Estudo técnico DETRANS — redutor 40 km/h','CONFIRMADA','Estudo técnico específico; referência de velocidade 40 km/h.','Prefeitura de Joinville — DETRANS: Estudos Técnicos de Fiscalização Eletrônica','2026-08-27','ALTA' from public.units where name='Escola Municipal Professor Oswaldo Cabral'
on conflict do nothing;
insert into public.evidence (unit_id,evidence_type,status,description,source_name,source_date,confidence)
select id,'Estudo técnico DETRANS — redutor 40 km/h','CONFIRMADA','Estudo técnico específico; referência de velocidade 40 km/h.','Prefeitura de Joinville — DETRANS: Estudos Técnicos de Fiscalização Eletrônica','2026-08-27','ALTA' from public.units where name='Escola Municipal Prof Ada Santanna da Silveira'
on conflict do nothing;
insert into public.evidence (unit_id,evidence_type,status,description,source_name,source_date,confidence)
select id,'Estudo técnico DETRANS — redutor 40 km/h','CONFIRMADA','Estudo técnico específico; referência de velocidade 40 km/h.','Prefeitura de Joinville — DETRANS: Estudos Técnicos de Fiscalização Eletrônica','2026-08-27','ALTA' from public.units where name='Escola Municipal Prof Lacy Luiza da Cruz Flores'
on conflict do nothing;
insert into public.evidence (unit_id,evidence_type,status,description,source_name,source_date,confidence)
select id,'Estudo técnico DETRANS — redutor 40 km/h','CONFIRMADA','Estudo técnico específico; referência de velocidade 40 km/h.','Prefeitura de Joinville — DETRANS: Estudos Técnicos de Fiscalização Eletrônica','2026-08-27','ALTA' from public.units where name='Escola Municipal Padre Valente Simioni'
on conflict do nothing;
