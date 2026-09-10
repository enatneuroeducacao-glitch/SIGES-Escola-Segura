update public.evidence
set source_url='https://www.joinville.sc.gov.br/publicacoes/estudos-tecnicos-equipamentos-de-fiscalizacao-eletronica-radares-e-lombadas/'
where source_name='Prefeitura de Joinville — DETRANS: Estudos Técnicos de Fiscalização Eletrônica'
  and source_url is null;
