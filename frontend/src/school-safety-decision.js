const MISSING=v=>v==null||String(v).trim()===''||String(v).trim()==='—'||String(v).trim()==='-';

export const DECISION_LABELS={
  ALUNO_GUIA:'NECESSITA DE ALUNO GUIA',
  COMPLEMENTARES:'NECESSITA DE RELATÓRIOS COMPLEMENTARES',
  SELO:'ESCOLA COM DADOS SUFICIENTES PARA SELO ESCOLA SEGURA'
};

const FIELDS=[
  ['Velocidade km/h','Velocidade'],['VDM','VDM'],['Sinistros 3 anos','Sinistros 3 anos'],
  ['Travessias','Travessias'],['Calçada','Calçada'],['Sinalização','Sinalização'],
  ['Iluminação','Iluminação'],['Embarque/Desembarque','Embarque/Desembarque'],
  ['Infraestrutura cicloviária','Infraestrutura cicloviária']
];

export function evidenceCoverage(row={}){
  const present=FIELDS.filter(([,key])=>!MISSING(row[key])||!MISSING(row[`${key} oficial`])).map(([label])=>label);
  const missing=FIELDS.filter(([,key])=>MISSING(row[key])&&MISSING(row[`${key} oficial`])).map(([label])=>label);
  return {available:present.length,total:FIELDS.length,percent:Math.round(present.length/FIELDS.length*100),present,missing};
}

export function classifySchool(row={}){
  const coverage=evidenceCoverage(row);
  const hsi=Number(row['HSI-DOTH-P']);
  const ipe=Number(row['IPE Territorial 3.2']);
  const priority=String(row.Prioridade||'');
  if(coverage.percent>=78&&Number.isFinite(hsi)&&Number.isFinite(ipe)&&hsi>=70&&ipe>=70&&!/\bP[12]\b/.test(priority)) return {code:'SELO',label:DECISION_LABELS.SELO,coverage};
  if(coverage.percent<45||/\bP[12]\b/.test(priority)) return {code:'ALUNO_GUIA',label:DECISION_LABELS.ALUNO_GUIA,coverage};
  return {code:'COMPLEMENTARES',label:DECISION_LABELS.COMPLEMENTARES,coverage};
}

export function buildDecisionReport(rows=[]){
  const classified=rows.map(row=>({...row,decision:classifySchool(row)}));
  const counts=classified.reduce((a,row)=>{const k=row.decision.code;a[k]=(a[k]||0)+1;return a},{SELO:0,ALUNO_GUIA:0,COMPLEMENTARES:0});
  return {classified,counts,total:classified.length,rule:'Triagem técnica baseada em disponibilidade de evidências, HSI-DOTH-P, IPE Territorial e prioridade. Não constitui certificação automática.'};
}
