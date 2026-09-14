const missing=v=>v==null||String(v).trim()===''||String(v).trim()==='—'||String(v).trim()==='-';
const value=(v,fallback='—')=>missing(v)?fallback:String(v);
const number=(v,fallback='—')=>{const n=Number(v);return Number.isFinite(n)?String(n):fallback};

const fieldDefs=[
  ['Velocidade km/h','Velocidade'],
  ['VDM','VDM'],
  ['Sinistros 3 anos','Sinistros 3 anos'],
  ['Travessias','Travessias'],
  ['Calçada','Calçada'],
  ['Sinalização','Sinalização'],
  ['Iluminação','Iluminação'],
  ['Embarque/Desembarque','Embarque/Desembarque'],
  ['Infraestrutura cicloviária','Infraestrutura cicloviária']
];

export function buildDossierOpinion(row){
  const available=fieldDefs.filter(([,key])=>!missing(row[key])||!missing(row[`${key} oficial`])).map(([label,key])=>({label,key,value:!missing(row[key])?row[key]:row[`${key} oficial`]}));
  const absent=fieldDefs.filter(([,key])=>missing(row[key])&&missing(row[`${key} oficial`])).map(([label])=>label);
  const total=fieldDefs.length;
  const pct=Math.round((available.length/total)*100);
  const needsComplementary=available.length<=6;
  const classification=needsComplementary?'NECESSITA DE DADOS COMPLEMENTARES':'DECISÃO INSTITUCIONAL SOBRE ALUNO GUIA';
  const school=value(row.Unidade);
  const address=value(row.Endereço||row.Via);
  const neighborhood=value(row.Bairro);
  const priority=value(row['Prioridade Territorial 3.2']||row.Prioridade);
  const priorityStatus=value(row['Status da prioridade territorial SIGES'],'NÃO VALIDADA');
  const confidence=number(row['Confiabilidade territorial']);
  const hsi=number(row['HSI-DOTH-P']);
  const ipe=number(row['IPE Territorial 3.2']);
  const accidents2023=value(row['Acidentes corredor 2023']);
  const accidents2024=value(row['Acidentes corredor 2024']);
  const accidents2025=value(row['Acidentes corredor 2025']);
  const ranking2024=value(row['Ranking acidentes 2024']);
  const corridor=value(row['Corredor de sinistros associado']);
  const source=value(row['Fonte dos sinistros']||row['Fonte territorial principal']);
  const trace=value(row['Rastreabilidade SIGES'],'Nenhuma evidência pública adicional correspondente foi identificada para esta unidade.');
  const priorityReason=value(row['Justificativa da prioridade territorial SIGES']);

  const availabilityText=available.length
    ? available.map(x=>`${x.label}: ${value(x.value)}`).join('; ')
    : 'Nenhum dos 9 campos críticos possui informação correspondente disponível no registro analisado.';
  const absentText=absent.length?absent.join(', '):'Nenhum dos 9 campos críticos está ausente.';

  const conclusion=needsComplementary
    ? `O Dossiê apresenta ${available.length}/${total} campos críticos com informação (${pct}%). Segundo a regra operacional interna do SIGES, esse nível de cobertura exige complementação dos dados territoriais inexistentes antes de uma decisão institucional sobre a adoção de Aluno Guia.`
    : `O Dossiê apresenta ${available.length}/${total} campos críticos com informação (${pct}%). Segundo a regra operacional interna do SIGES, esse nível de cobertura permite que a unidade escolar tome decisão institucional sobre a adoção ou não de Aluno Guia. O SIGES não determina automaticamente essa adoção.`;

  return [
    'PARECER TÉCNICO SIGES — ANÁLISE DO DOSSIÊ TERRITORIAL',
    '',
    '1. IDENTIFICAÇÃO',
    `Escola: ${school}`,
    `Endereço: ${address}`,
    `Bairro: ${neighborhood}`,
    '',
    '2. SÍNTESE TÉCNICA',
    `O presente parecer é gerado automaticamente a partir dos dados efetivamente disponíveis no Dossiê Territorial do SIGES para a unidade identificada. Não são criados valores para campos sem correspondência ou sem fonte pública confirmada.`,
    `HSI-DOTH-P: ${hsi} · IPE Territorial 3.2: ${ipe} · Prioridade territorial: ${priority} · Status da prioridade: ${priorityStatus} · Confiabilidade territorial registrada: ${confidence}.`,
    '',
    '3. EVIDÊNCIAS DE SINISTROS',
    `Corredor associado: ${corridor}`,
    `Acidentes 2023: ${accidents2023} · Acidentes 2024: ${accidents2024} · Ranking 2024: ${ranking2024} · Acidentes 2025: ${accidents2025}.`,
    `Fonte registrada: ${source}`,
    `Situação da evidência: ${value(row['Situação da evidência de sinistros'])}`,
    '',
    '4. COBERTURA DOS DADOS CRÍTICOS',
    `Cobertura: ${available.length}/${total} (${pct}%).`,
    `Dados efetivamente disponíveis: ${availabilityText}`,
    `Dados ausentes ou não localizados: ${absentText}.`,
    '',
    '5. ANÁLISE DA PRIORIDADE TERRITORIAL',
    `Status: ${priorityStatus}.`,
    `Justificativa registrada pelo SIGES: ${priorityReason}.`,
    '',
    '6. CONCLUSÃO E PROVIDÊNCIA',
    conclusion,
    needsComplementary
      ? 'Providência: complementar os dados territoriais inexistentes ou não localizados. A adoção de Aluno Guia não deve ser tratada como conclusão automática desta etapa.'
      : 'Providência: decisão institucional da escola sobre a adoção ou não de Aluno Guia, considerando o contexto escolar e os elementos que não podem ser determinados exclusivamente pelos dados territoriais.',
    '',
    '7. RASTREABILIDADE',
    trace,
    '',
    '8. LIMITAÇÕES',
    'Este parecer é um produto informativo e analítico do SIGES. A ausência de dado significa ausência de correspondência ou de informação disponível nas fontes incorporadas no momento da leitura; não significa necessariamente inexistência do elemento no território. O parecer não substitui vistoria, levantamento de campo, engenharia de tráfego, avaliação técnica específica, validação institucional ou decisão administrativa.',
    '',
    'Critério operacional: 0–6 de 9 campos críticos = NECESSITA DE DADOS COMPLEMENTARES; 7–9 de 9 = DECISÃO INSTITUCIONAL SOBRE ALUNO GUIA.',
    'O critério acima é interno ao SIGES e não constitui, por si só, certificação oficial de Escola Segura.'
  ].join('\n');
}
