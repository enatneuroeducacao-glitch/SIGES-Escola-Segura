import DATA_B64 from '../data/joinville-3-2-data.gz.b64?raw';
import{buildEvidenceTrace,formatEvidenceTrace}from'./evidenceTrace';
import{buildDossierOpinion}from'./dossierOpinion';

const clean=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\bquinze\b/g,'15').replace(/\b(rua|r|av|av\.|avenida|rodovia|br[- ]?)\b/g,'').replace(/[^a-z0-9]+/g,' ').trim();
const nonEmptyRow=x=>x&&Object.values(x).some(v=>String(v??'').trim()!=='');
const validMatrixRow=x=>nonEmptyRow(x)&&String(x.Unidade??'').trim()!=='';
const validEvidenceRow=x=>nonEmptyRow(x);
const validCrashRow=x=>nonEmptyRow(x)&&(String(x.Via??x.Corredor??'').trim()!=='');
const API_BASE=(import.meta.env.VITE_API_BASE||'https://escola-segura-api-r51o.onrender.com/api').replace(/\/$/,'');
const api=async path=>{const r=await fetch(`${API_BASE}${path}`,{cache:'no-store'});if(!r.ok)throw new Error(`HTTP ${r.status}`);return r.json()};
const isMissing=v=>v==null||String(v).trim()===''||String(v).trim()==='—'||String(v).trim()==='-';
const firstDefined=(...values)=>values.find(v=>!isMissing(v));
const priorityCode=v=>String(v??'').match(/\bP[1-4]\b/)?.[0]||'';

async function loadStatic(){
  const b=atob(String(DATA_B64).replace(/\s+/g,''));
  const bytes=Uint8Array.from(b,c=>c.charCodeAt(0));
  if(typeof DecompressionStream==='undefined')throw new Error('Este navegador não suporta descompressão gzip.');
  const ds=new DecompressionStream('gzip');
  const json=await new Response(new Blob([bytes]).stream().pipeThrough(ds)).json();
  return{
    matrix:(json['MATRIZ 3.2']||[]).filter(validMatrixRow),
    evidencias:(json['EVIDÊNCIAS TERRITORIAIS']||[]).filter(validEvidenceRow),
    sinistros:(json['SINISTROS_CORREDORES']||[]).filter(validCrashRow),
    dashboard:json['DASHBOARD 3.2']||[],
    metodologia:json['METODOLOGIA 3.2']||[],
    dicionario:json['DICIONÁRIO 3.2']||[]
  };
}

function resolveTerritorialPriority(row){
  const matrix=priorityCode(row.Prioridade);
  const raw=priorityCode(row['Prioridade Territorial 3.2']);
  const confidence=Number(row['Confiabilidade territorial']);
  const availability=String(row['Dados territoriais disponíveis']??'').trim();
  const hasTerritorialMatch=availability!==''&&availability.toLowerCase()!=='sem correspondência';
  if(raw&&Number.isFinite(confidence)&&confidence>=60&&hasTerritorialMatch)return{value:raw,validated:true,reason:'Prioridade territorial mantida porque há correspondência territorial identificada e confiabilidade suficiente.'};
  if(matrix)return{value:matrix,validated:false,reason:'Prioridade territorial não validada: evidência territorial insuficiente ou sem correspondência; foi preservada a prioridade da matriz para evitar elevação indevida.'};
  return{value:raw||'—',validated:false,reason:'Prioridade territorial sem validação suficiente; não foi possível estabelecer correspondência territorial confiável.'};
}

const corridorMatch=(schoolKey,road)=>{
  const a=clean(schoolKey),b=clean(road);
  return Boolean(a&&b&&(a===b||a.includes(b)||b.includes(a)));
};

function findSchoolCorridor(row,corridors){
  const key=firstDefined(row['Corredor normalizado'],row.Corredor,row.Via,row.Endereço)||'';
  if(!key)return null;
  return corridors.find(r=>corridorMatch(key,r.Via||r.Corredor||r.road||r.road2025||''))||null;
}

function dossierCorridorFields(row,corridor,cbvjMatch){
  const road=firstDefined(corridor?.Via,corridor?.Corredor,corridor?.road,corridor?.road2025);
  if(!road)return{};
  const a23=firstDefined(corridor?.['Acidentes 2023'],corridor?.value2023);
  const a24=firstDefined(corridor?.['Acidentes 2024'],corridor?.value2024);
  const r24=firstDefined(corridor?.['Rank 2024'],corridor?.rank2024);
  const presence=firstDefined(corridor?.['Presença nos dois anos'],corridor?.presence);
  const source=firstDefined(corridor?.Fonte,corridor?.source,cbvjMatch?.source,'Joinville Cidade em Dados 2025');
  const fields={
    'Corredor de sinistros associado':road,
    'Acidentes corredor 2023':a23,
    'Acidentes corredor 2024':a24,
    'Ranking acidentes 2024':r24,
    'Presença de sinistros nos dois anos':presence,
    'Fonte dos sinistros':source,
    'Situação da evidência de sinistros':(!isMissing(a23)||!isMissing(a24))?'Correspondência de logradouro confirmada na base de corredores.':'Sem dado de sinistros correspondente na base disponível.'
  };
  return Object.fromEntries(Object.entries(fields).filter(([,v])=>!isMissing(v)));
}

function enrich(base,sources){
  const cb=sources.cbvj?.corridors||[];
  const det=sources.detrans?.corridors||[];
  const docs=sources.detrans?.documents||[];
  const cycles=sources.simgeo?.corridors||[];
  const simgeo2025=sources.simgeo?.corridors2025||[];
  const simgeo2026=sources.simgeo?.corridors2026||[];
  const match=(a,b)=>corridorMatch(a,b);
  const matchedCycle=key=>cycles.filter(r=>match(key,r.nome_logra));
  const matchedDetransDoc=key=>docs.find(r=>match(key,r.road)&&Number.isFinite(Number(r.speedKmh)));
  const matrix=base.matrix.map(x=>{
    const key=firstDefined(x['Corredor normalizado'],x.Corredor,x.Via,x.Endereço)||'';
    const staticCorridor=findSchoolCorridor(x,base.sinistros);
    const liveCorridor=cb.find(r=>match(key,r.road)||match(key,r.road2025||r.road));
    const simgeoCorridor2025=simgeo2025.find(r=>match(key,r.road));
    const simgeoCorridor2026=simgeo2026.find(r=>match(key,r.road));
    const c=simgeoCorridor2026||simgeoCorridor2025||liveCorridor||staticCorridor;
    const d=det.find(r=>match(key,r.road));
    const doc=matchedDetransDoc(key);
    const cyc=matchedCycle(key);
    const next={...x};

    const accident2025=firstDefined(simgeoCorridor2025?.count,liveCorridor?.value2025,x['Acidentes corredor 2025']);
    const accident2026=firstDefined(simgeoCorridor2026?.count,x['Acidentes corredor 2026']);
    const accident2024=firstDefined(liveCorridor?.value2024,staticCorridor?.['Acidentes 2024'],x['Acidentes corredor 2024']);
    const accident2023=firstDefined(liveCorridor?.value2023,staticCorridor?.['Acidentes 2023'],x['Acidentes corredor 2023']);
    const rank2024=firstDefined(liveCorridor?.rank2024,staticCorridor?.['Rank 2024'],x['Ranking acidentes 2024']);
    const variation=firstDefined(liveCorridor?.variation2024to2025,x['Variação acidentes 2024-2025']);
    const variation2025to2026=Number.isFinite(Number(accident2025))&&Number.isFinite(Number(accident2026))&&Number(accident2025)!==0?Number((((Number(accident2026)-Number(accident2025))/Number(accident2025))*100).toFixed(2)):null;
    const studies=firstDefined(d?.count,x['Estudos DETRANS']);
    const studyYear=firstDefined(doc?.year,x['Ano estudo DETRANS']);

    if(!isMissing(accident2023))next['Acidentes corredor 2023']=accident2023;
    if(!isMissing(accident2024))next['Acidentes corredor 2024']=accident2024;
    if(!isMissing(rank2024))next['Ranking acidentes 2024']=rank2024;
    if(!isMissing(accident2025)){
      next['Acidentes corredor 2025']=accident2025;
      if(isMissing(x['Acidentes 2025']))next['Acidentes 2025']=accident2025;
    }
    if(!isMissing(accident2026)){
      next['Acidentes corredor 2026']=accident2026;
      next['Acidentes 2026']=accident2026;
      next['Fonte acidentes 2026']='SIMGEO — camada pública de acidentes com vítimas';
    }
    if(variation2025to2026!==null)next['Variação acidentes 2025-2026']=variation2025to2026;
    if(!isMissing(variation))next['Variação acidentes 2024-2025']=variation;
    if(!isMissing(studies))next['Estudos DETRANS']=studies;
    if(!isMissing(studyYear))next['Ano estudo DETRANS']=studyYear;
    if(isMissing(x['Velocidade km/h'])&&isMissing(x.Velocidade)&&doc?.speedKmh)next['Velocidade km/h']=doc.speedKmh;
    if(isMissing(x.Velocidade)&&doc?.speedKmh)next.Velocidade=doc.speedKmh;
    if(isMissing(x['Infraestrutura cicloviária'])&&cyc.length)next['Infraestrutura cicloviária']=`Presente — ${cyc.length} segmento(s) identificado(s) no SIMGeo`;

    const corridorFields=dossierCorridorFields(x,staticCorridor||liveCorridor,liveCorridor);
    if(!isMissing(accident2026)){
      corridorFields['Acidentes corredor 2026']=accident2026;
      corridorFields['Fonte acidentes 2026']='SIMGEO — camada pública de acidentes com vítimas';
    }
    Object.entries(corridorFields).forEach(([k,v])=>{if(isMissing(next[k])&&!isMissing(v))next[k]=v});
    return next;
  });

  const sinistros=base.sinistros.map(x=>{
    const key=x.Via||x.Corredor||'';
    const c=cb.find(r=>match(key,r.road)||match(key,r.road2025||r.road));
    const s25=simgeo2025.find(r=>match(key,r.road));
    const s26=simgeo2026.find(r=>match(key,r.road));
    const next={...x};
    const accident2025=firstDefined(s25?.count,c?.value2025,x['Acidentes 2025']);
    const accident2026=firstDefined(s26?.count,x['Acidentes 2026']);
    const variation=firstDefined(c?.variation2024to2025,x['Variação 2024-2025']);
    const variation2025to2026=Number.isFinite(Number(accident2025))&&Number.isFinite(Number(accident2026))&&Number(accident2025)!==0?Number((((Number(accident2026)-Number(accident2025))/Number(accident2025))*100).toFixed(2)):null;
    if(!isMissing(accident2025))next['Acidentes 2025']=accident2025;
    if(!isMissing(accident2026))next['Acidentes 2026']=accident2026;
    if(variation2025to2026!==null)next['Variação 2025-2026']=variation2025to2026;
    if(!isMissing(variation))next['Variação 2024-2025']=variation;
    if(!isMissing(accident2026))next['Fonte 2026']='SIMGEO — dados consultados pelo SIGES';
    return next;
  });

  return{...base,matrix,sinistros,sources,meta:{updatedAt:sources.generatedAt||new Date().toISOString(),latestYear:Math.max(2025,...Object.values(sources).map(s=>Number(s?.latestCompleteYear)||0)),liveSources:Object.values(sources).filter(Boolean).length}};
}

const completeness=row=>{
  const fields=[['Velocidade km/h','Velocidade'],['VDM','VDM'],['Sinistros 3 anos','Sinistros 3 anos'],['Travessias','Travessias'],['Calçada','Calçada'],['Sinalização','Sinalização'],['Iluminação','Iluminação'],['Embarque/Desembarque','Embarque/Desembarque'],['Infraestrutura cicloviária','Infraestrutura cicloviária']];
  const available=fields.filter(([,b])=>!isMissing(row[b])||!isMissing(row[`${b} oficial`])).length;
  return{available,total:fields.length,percent:Math.round((available/fields.length)*100),missing:fields.filter(([,b])=>isMissing(row[b])&&isMissing(row[`${b} oficial`])).map(([a])=>a)};
};

export function classifySchool(row){
  const c=completeness(row);
  if(c.available<=6)return{status:'NECESSITA DE DADOS COMPLEMENTARES',code:'COMPLEMENTARES',percent:c.percent,available:c.available,total:c.total,missing:c.missing,recommendation:'Complementar os dados territoriais inexistentes no relatório antes da decisão institucional sobre a adoção de Aluno Guia.'};
  return{status:'DECISÃO INSTITUCIONAL SOBRE ALUNO GUIA',code:'DECISAO_INSTITUCIONAL',percent:c.percent,available:c.available,total:c.total,missing:c.missing,recommendation:'A escola dispõe de evidências territoriais suficientes para decisão institucional. A adoção de Aluno Guia é facultativa e deve ser definida pela instituição, considerando seu contexto e avaliação de risco.'};
}

export async function loadSigesData({refresh=false}={}){
  const base=await loadStatic();
  const suffix=refresh?'?refresh=1':'';
  const results=await Promise.allSettled([api(`/public-sources/cbvj${suffix}`),api(`/public-sources/detrans${suffix}`),api(`/public-sources/simgeo${suffix}`),api(`/public-sources/renaest${suffix}`),api(`/public-sources/health-data${suffix}`)]);
  const sourceNames=['cbvj','detrans','simgeo','renaest','health'];
  const sources={};
  const sourceHealth={};
  results.forEach((r,i)=>{const key=sourceNames[i];if(r.status==='fulfilled'){sources[key]=r.value;sourceHealth[key]={status:r.value?.sourceStatus||'online',retrievedAt:r.value?.retrievedAt||null,error:null}}else{sourceHealth[key]={status:'offline',retrievedAt:null,error:r.reason?.message||'Falha na consulta'}}});
  const data=enrich(base,sources);
  data.meta={...(data.meta||{}),sourceHealth};
  data.matrix=data.matrix.map(x=>{
    const territorial=resolveTerritorialPriority(x);
    const d=classifySchool(x);
    const raw=priorityCode(x['Prioridade Territorial 3.2']);
    const priorityFields=raw&&raw!==territorial.value?{'Prioridade Territorial 3.2 original':raw}:{};
    const dossier=Object.fromEntries([
      ['Síntese do dossiê SIGES',`Unidade: ${x.Unidade||'—'} · Logradouro: ${x.Endereço||x.Via||'—'} · Prioridade territorial: ${territorial.value||'—'}.`],
      ['Situação dos sinistros no corredor',x['Situação da evidência de sinistros']||'Sem correspondência de sinistros confirmada na base disponível.'],
      ['Dados de sinistros confirmados','2023: '+(x['Acidentes corredor 2023']??'—')+' · 2024: '+(x['Acidentes corredor 2024']??'—')+' · Ranking 2024: '+(x['Ranking acidentes 2024']??'—')+' · 2025: '+(x['Acidentes corredor 2025']??'não disponível')],
      ['Fonte de sinistros',x['Fonte dos sinistros']||'—'],
      ['Regra de decisão do Aluno Guia',d.available<=6?'Até 6 de 9 campos críticos disponíveis: exigir dados complementares antes da decisão institucional.':'A partir de 7 de 9 campos críticos disponíveis: decisão institucional sobre adoção ou não do Aluno Guia.']
    ]);
    return{...dossier,...x,...priorityFields,
      'Prioridade Territorial 3.2':territorial.value,
      'Status da prioridade territorial SIGES':territorial.validated?'VALIDADA':'NÃO VALIDADA',
      'Justificativa da prioridade territorial SIGES':territorial.reason,
      'Classificação SIGES':d.status,
      'Cobertura de evidências SIGES':`${d.available}/${d.total} (${d.percent}%)`,
      'Dados disponíveis SIGES':d.available,
      'Dados ausentes SIGES':d.missing.length?d.missing.join(', '):'Nenhum campo crítico ausente',
      'Providência recomendada SIGES':d.recommendation,
      'Parecer Técnico SIGES':buildDossierOpinion({...x,...dossier,...priorityFields,'Prioridade Territorial 3.2':territorial.value,'Status da prioridade territorial SIGES':territorial.validated?'VALIDADA':'NÃO VALIDADA','Justificativa da prioridade territorial SIGES':territorial.reason}),
      'Rastreabilidade SIGES':formatEvidenceTrace(buildEvidenceTrace(x,data.sources))||'Nenhuma evidência pública adicional correspondente foi identificada para esta unidade.'
    };
  });
  return data;
}
