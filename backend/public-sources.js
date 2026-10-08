const express=require('express');
const buildDetransSpatial=require('./intelligence/detrans-spatial');
const CBVJ_2025_URL='https://www.cbvj.org.br/blog/bombeiros-voluntarios-de-joinville-atenderam-14-574-ocorrencias-em-2025/';
const CBVJ_2024_URL='https://www.cbvj.org.br/blog/bombeiros-voluntarios-de-joinville-atenderam-mais-de-11-mil-ocorrencias-em-2024/';
const DETRANS_URL='https://www.joinville.sc.gov.br/publicacoes/estudos-tecnicos-equipamentos-de-fiscalizacao-eletronica-radares-e-lombadas/';
const SIMGEO_URL='https://www.joinville.sc.gov.br/servicos/acessar-sistema-de-informacoes-municipais-georreferenciadas-simgeo/';
const SIMGEO_ROOT='https://geo.joinville.sc.gov.br/server/rest/services/simgeo';
const SIMGEO_SCHOOLS='https://geo.joinville.sc.gov.br/server/rest/services/SEPUR/educacao_simgeo_v4/MapServer/1';
const SIMGEO_ROADS='https://geo.joinville.sc.gov.br/server/rest/services/SEPUR/sistema_viario_e_transportes_simgeo_v4/MapServer/1';
const SIMGEO_CYCLE='https://geo.joinville.sc.gov.br/server/rest/services/SEPUR/sistema_viario_e_transportes_simgeo_v4/MapServer/4';
const SIMGEO_ACCIDENTS='https://geo.joinville.sc.gov.br/server/rest/services/base_geo/acidentes/FeatureServer/0';
const RENAEST_CKAN='https://dados.transportes.gov.br/api/3/action/package_show?id=renaest';
const SUS_HOSPITALS_CKAN='https://dadosabertos.saude.gov.br/api/3/action/package_show?id=hospitais-e-leitos';
const CACHE_TTL=6*60*60*1000;
const REQUEST_TIMEOUT=12000;
let cache={};
function withTimeout(promise,ms=REQUEST_TIMEOUT){return Promise.race([promise,new Promise((_,reject)=>setTimeout(()=>reject(new Error('Tempo limite da fonte externa excedido.')),ms))])}
function cacheSet(key,data){cache[key]={data,expiresAt:Date.now()+CACHE_TTL,lastSuccessAt:new Date().toISOString()};return data}
function cacheGet(key){return cache[key]?.data||null}
function clean(v){return String(v||'').replace(/&nbsp;/gi,' ').replace(/\s+/g,' ').trim()}
function decode(v){return clean(String(v||'').replace(/<[^>]*>/g,' ').replace(/&amp;/g,'&').replace(/&#39;/g,"'").replace(/&quot;/g,'"').replace(/&ndash;/g,'–').replace(/&nbsp;/g,' '))}
function number(v){const n=Number(String(v||'').replace(/\./g,'').replace(',','.'));return Number.isFinite(n)?n:null}
function parseRanking(text){const out=[];const heading=text.search(/As dez vias com mais acidentes/i);if(heading<0)return out;const section=text.slice(heading).split(/Operacional|Fonte:/i)[0];const re=/(\\d{1,2})\\s*[ºo]?\\s*\\|\\s*([^|]+?)\\s*\\|\\s*(\\d+)\\s*\\|\\s*([^|]+?)\\s*\\|\\s*(\\d+)/gi;let m;while((m=re.exec(section))){const road24=clean(m[2]),road25=clean(m[4]);if(road24&&road25)out.push({road:road24,value2024:number(m[3]),road2025:road25,value2025:number(m[5])})}return out}
function normalizeRanking(rows){const map=new Map();for(const r of rows){const road=clean(r.road2025||r.road);if(road)map.set(road.toLowerCase(),{road,value2024:r.value2024,value2025:r.value2025})}return[...map.values()].sort((a,b)=>(b.value2025||0)-(a.value2025||0)).map((x,i)=>({...x,rank2025:i+1,variation2024to2025:x.value2024?Number((((x.value2025-x.value2024)/x.value2024)*100).toFixed(2)):null}))}
async function fetchText(url){const r=await withTimeout(fetch(url,{headers:{'User-Agent':'SIGES-Escola-Segura/3.6 public-source-reader'}}));if(!r.ok)throw new Error(`Fonte externa respondeu HTTP ${r.status}`);return r.text()}
function htmlToText(html){return decode(html.replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<br\s*\/?\s*>/gi,'\n').replace(/<\/td>|<\/th>/gi,' | ').replace(/<\/p>|<\/div>|<\/tr>|<\/li>/gi,'\n'))}
async function loadCbvj(force=false){if(!force&&cacheGet('cbvj')&&cache.cbvj.expiresAt>Date.now())return cache.cbvj.data;const text=htmlToText(await fetchText(CBVJ_2025_URL));const text24=await fetchText(CBVJ_2024_URL).catch(()=>null);const corridors=normalizeRanking(parseRanking(text));const data={source:'CBVJ',sourceName:'Corpo de Bombeiros Voluntários de Joinville',municipality:'Joinville',retrievedAt:new Date().toISOString(),latestCompleteYear:2025,latestPublicationDate:'2026-01-08',methodology:'Ranking publicado no Relatório Operacional 2025/CBVJ; o SIGES preserva a fonte e não substitui dados históricos de outras publicações.',urls:{2025:CBVJ_2025_URL,2024:CBVJ_2024_URL},summary:{totalOccurrences2025:14574,trafficCarVsMotorcycle2025:1923},corridors,raw:{ranking2025Count:corridors.length,has2024Publication:Boolean(text24)}};cacheSet('cbvj',data);return data}
function extractRoad(title){let s=clean(title.replace(/^Estudo Técnico(?: Redutor de Velocidade 40 kmh| Controlador de Velocidade 60km\/h| Controlador de Velocidade Semafórico)?\s*/i,''));const m=s.match(/(?:Rua|Av\.?|Avenida|Rodovia|BR-)[^,–]+/i);if(!m)return'Outros';s=m[0].replace(/\s+\d+[\wºª.-]*(?:\s*(?:e|,|\/|com|próx\.?|prox\.?|nº?|n°).*)?$/i,'');return clean(s).replace(/\s+(?:N-S|S-N|L-O|O-L)$/i,'')||clean(m[0])}
function extractSpeed(title){const m=String(title||'').match(/(?:redutor|controlador).*?(30|40|50|60|70|80)\s*km\/?h/i);return m?Number(m[1]):null}
function parseDetrans(html){const items=[];const re=/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>([\s\S]{0,900}?)(?=<a\s|<\/section|$)/gi;let m;while((m=re.exec(html))){const title=decode(m[2]);if(!/Estudo Técnico|Atualização Bienal/i.test(title))continue;const tail=decode(m[3]);const dateMatch=tail.match(/Documento disponibilizado em\s*(\d{2}\/\d{2}\/\d{4})/i);items.push({title,url:new URL(m[1],DETRANS_URL).href,date:dateMatch?dateMatch[1]:null,year:dateMatch?Number(dateMatch[1].slice(-4)):null,road:extractRoad(title),speedKmh:extractSpeed(title)})}const unique=[];const seen=new Set();for(const x of items){if(!seen.has(x.url)){seen.add(x.url);unique.push(x)}}const years={};for(const x of unique){const y=x.year||'indefinido';years[y]=(years[y]||0)+1}const corridors={};for(const x of unique){if(x.road&&x.road!=='Outros')corridors[x.road]=(corridors[x.road]||0)+1}const ranking=Object.entries(corridors).map(([road,count])=>({road,count})).sort((a,b)=>b.count-a.count).map((x,i)=>({...x,rank:i+1}));const latestYear=Math.max(...unique.map(x=>x.year||0));const latestDate=unique.map(x=>x.date).filter(Boolean).sort((a,b)=>b.split('/').reverse().join('').localeCompare(a.split('/').reverse().join('')))[0]||null;return{source:'DETRANS',sourceName:'Departamento de Trânsito de Joinville',municipality:'Joinville',retrievedAt:new Date().toISOString(),latestCompleteYear:latestYear||null,latestPublicationDate:latestDate?latestDate.split('/').reverse().join('-'):null,methodology:'Inventário somente leitura dos estudos técnicos publicados oficialmente pelo DETRANS. O ranking representa quantidade de estudos por corredor, não acidentes. Não se calcula variação 2024→2025 quando a fonte não fornece série anual homogênea.',urls:{publication:DETRANS_URL},summary:{totalOccurrences:null,totalStudies:unique.length,studiesByYear:years},corridors:ranking,documents:unique.slice(0,120)}}
async function loadDetrans(force=false){if(!force&&cacheGet('detrans')&&cache.detrans.expiresAt>Date.now())return cache.detrans.data;const data=parseDetrans(await fetchText(DETRANS_URL));cacheSet('detrans',data);return data}
async function getJson(url){const r=await withTimeout(fetch(url,{headers:{'User-Agent':'SIGES-Escola-Segura/3.7 public-data-reader'}}));if(!r.ok)throw new Error(`Fonte pública respondeu HTTP ${r.status}`);return r.json()}
function catalogResources(pkg,yearPattern){const resources=Array.isArray(pkg?.result?.resources)?pkg.result.resources:[];return resources.filter(x=>yearPattern.test(String(x.name||x.description||''))).map(x=>({id:x.id,name:x.name||x.description||'Recurso',format:x.format||null,url:x.url||null,lastModified:x.last_modified||x.metadata_modified||null,size:x.size||null})).sort((a,b)=>String(b.name).localeCompare(String(a.name),undefined,{numeric:true}));}
async function loadRenaest(force=false){
  if(!force&&cacheGet('renaest')&&cache.renaest.expiresAt>Date.now())return cache.renaest.data;
  const pkg=await getJson(RENAEST_CKAN);
  const resources=catalogResources(pkg,/RENAEST\s*-?\s*Mensal\s*-?\s*(0[1-9]|1[0-2])-20(?:25|26)/i);
  const latest=resources[0]||null;
  let rows=[];
  let ingestion='catalogo';
  let ingestionError=null;
  if(latest?.id){
    try{
      const ds=await getJson(`https://dados.transportes.gov.br/api/3/action/datastore_search?resource_id=${encodeURIComponent(latest.id)}&limit=5000`);
      rows=Array.isArray(ds?.result?.records)?ds.result.records:[];
      if(rows.length)ingestion='datastore';
    }catch(error){ingestionError=error.message}
  }
  const keys=rows.length?Object.keys(rows[0]):[];
  const normalizeKey=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'');
  const municipalityKey=keys.find(k=>/(municipio|nomemunicipio|municipionome|cidade|localidade)/.test(normalizeKey(k)));
  const ufKey=keys.find(k=>normalizeKey(k)==='uf'||normalizeKey(k).includes('siglauf'));
  const joinville=rows.filter(row=>{
    if(!municipalityKey)return false;
    const municipality=normalizeKey(row[municipalityKey]);
    const uf=ufKey?normalizeKey(row[ufKey]):'';
    return municipality==='joinville'&&(uf===''||uf==='sc');
  });
  const numericCandidates=keys.filter(k=>/(sinistro|acidente|ocorrencia|quantidade|total|vitima|morto|obito|ferido)/.test(normalizeKey(k)));
  const aggregates={};
  for(const key of numericCandidates){
    const values=joinville.map(r=>Number(String(r[key]).replace(',','.'))).filter(Number.isFinite);
    if(values.length)aggregates[key]=values.reduce((a,b)=>a+b,0);
  }
  const data={
    source:'RENAEST',
    sourceName:'Registro Nacional de Sinistros e Estatísticas de Trânsito',
    municipality:'Joinville',
    retrievedAt:new Date().toISOString(),
    sourceStatus:latest?(rows.length?'online':'partial'):'offline',
    latestCompleteYear:2026,
    latestAvailableMonth:latest?(String(latest.name).match(/(0[1-9]|1[0-2])-2026/)||[])[1]||null:null,
    available2026Months:resources.filter(x=>/2026/.test(x.name)).map(x=>{const m=String(x.name).match(/(0[1-9]|1[0-2])-2026/);return m?Number(m[1]):null}).filter(Boolean).sort((a,b)=>a-b),
    resourceCount:resources.length,
    resources,
    ingestion,
    ingestionError,
    latestResource:latest,
    joinvilleRecords:joinville.length,
    joinvilleAggregates:aggregates,
    detectedFields:{municipality:municipalityKey||null,uf:ufKey||null,numeric:numericCandidates},
    methodology:'O SIGES consulta o catálogo RENAEST e, quando o recurso mensal está exposto no DataStore, ingere os registros para dentro da aplicação e filtra Joinville/SC. O painel identifica explicitamente quando a fonte oferece apenas catálogo, evitando transformar disponibilidade de arquivo em dado analítico.',
    urls:{dataset:'https://dados.transportes.gov.br/dataset/renaest',api:RENAEST_CKAN}
  };
  cacheSet('renaest',data);
  return data;
}
async function loadHealth(force=false){if(!force&&cacheGet('health')&&cache.health.expiresAt>Date.now())return cache.health.data;const pkg=await getJson(SUS_HOSPITALS_CKAN);const resources=catalogResources(pkg,/2026/i);const latest=resources[0]||null;const data={source:'SAUDE',sourceName:'Ministério da Saúde — Hospitais e Leitos',municipality:'Brasil / recorte municipal quando disponível',retrievedAt:new Date().toISOString(),sourceStatus:resources.length?'online':'partial',latestCompleteYear:2026,latestResource:latest,resourceCount:resources.length,resources,methodology:'Catálogo oficial do Portal de Dados Abertos do SUS. Os dados agregados respeitam as limitações de privacidade da fonte; o SIGES não identifica cidadãos.',urls:{dataset:'https://dadosabertos.saude.gov.br/dataset/hospitais-e-leitos',api:SUS_HOSPITALS_CKAN}};cacheSet('health',data);return data}
async function loadSimgeo(force=false){
  if(!force&&cacheGet('simgeo')&&cache.simgeo.expiresAt>Date.now())return cache.simgeo.data;
  const currentYear=new Date().getFullYear();
  const currentMonth=new Date().getMonth()+1;
  const monthQueries=(year,limitMonth)=>Array.from({length:limitMonth},(_,i)=>{
    const month=i+1,m=String(month).padStart(2,'0');
    const nextDate=new Date(Date.UTC(year,month,1));
    const nextYear=nextDate.getUTCFullYear();
    const nextMonth=String(nextDate.getUTCMonth()+1).padStart(2,'0');
    const where=encodeURIComponent(`data >= DATE '${year}-${m}-01' AND data < DATE '${nextYear}-${nextMonth}-01'`);
    return getJson(`${SIMGEO_ACCIDENTS}/query?where=${where}&returnCountOnly=true&f=json`);
  });
  const baseResults=await Promise.allSettled([
    getJson(`${SIMGEO_SCHOOLS}/query?where=1%3D1&returnCountOnly=true&f=json`),
    getJson(`${SIMGEO_ROOT}/planejamento/MapServer/layers?f=json`),
    getJson(`${SIMGEO_CYCLE}/query?where=1%3D1&outFields=nome_logra,ciclo,extensao,categoria&returnGeometry=false&resultRecordCount=2000&f=json`),
    getJson(`${SIMGEO_ACCIDENTS}?f=json`),
    ...monthQueries(2025,12),
    ...monthQueries(currentYear,currentYear===2026?currentMonth:12)
  ]);
  const value=(i,fallback)=>baseResults[i]?.status==='fulfilled'?baseResults[i].value:fallback;
  const schools=value(0,{count:null});
  const layersJson=value(1,{layers:[]});
  const cycleJson=value(2,{features:[]});
  const accidentMeta=value(3,{fields:[]});
  const fields=Array.isArray(accidentMeta.fields)?accidentMeta.fields:[];
  const oidField=fields.find(x=>x.type==='esriFieldTypeOID')?.name||'objectid';
  const roadField=['logradouro','nomelog','nome_logra','via','local'].find(name=>fields.some(x=>String(x.name||'').toLowerCase()===name));
  const stats=encodeURIComponent(JSON.stringify([{statisticType:'count',onStatisticField:oidField,outStatisticFieldName:'sinistros'}]));
  const roadQueries=[];
  for(const year of [2025,currentYear]){
    if(!roadField)continue;
    const where=encodeURIComponent(`ano=${year}`);
    roadQueries.push(getJson(`${SIMGEO_ACCIDENTS}/query?where=${where}&outStatistics=${stats}&groupByFieldsForStatistics=${encodeURIComponent(roadField)}&orderByFields=sinistros%20DESC&outFields=${encodeURIComponent(roadField)}&returnGeometry=false&resultRecordCount=100&f=json`));
  }
  const roadResults=await Promise.allSettled(roadQueries);
  const parseRoads=(result,year)=>{
    if(result?.status!=='fulfilled')return[];
    return (result.value.features||[]).map(f=>{
      const a=f.attributes||{};
      const road=clean(a[roadField]);
      const count=Number(a.sinistros);
      return road&&Number.isFinite(count)?{road,count,year}:null;
    }).filter(Boolean);
  };
  const corridors2025=parseRoads(roadResults[0],2025);
  const corridors2026=parseRoads(roadResults[1],currentYear);
  const monthStart2025=4;
  const month2025Results=baseResults.slice(monthStart2025,monthStart2025+12);
  const month2026Results=baseResults.slice(monthStart2025+12);
  const monthly2025=month2025Results.map((r,i)=>({month:i+1,count:r.status==='fulfilled'?Number(r.value.count)||0:null,status:r.status==='fulfilled'?'ok':'unavailable'}));
  const monthly2026=month2026Results.map((r,i)=>({month:i+1,count:r.status==='fulfilled'?Number(r.value.count)||0:null,status:r.status==='fulfilled'?'ok':'unavailable'}));
  const layers=(layersJson.layers||[]).map(x=>({id:x.id,name:x.name,type:x.type}));
  const cycleCorridors=(cycleJson.features||[]).map(f=>f.attributes||{}).filter(x=>clean(x.nome_logra));
  const successful=baseResults.filter(r=>r.status==='fulfilled').length+roadResults.filter(r=>r.status==='fulfilled').length;
  const requested=baseResults.length+roadResults.length;
  const failed=requested-successful;
  const accidents2025Count=monthly2025.reduce((sum,x)=>sum+(Number.isFinite(x.count)?x.count:0),0);
  const accidents2026Count=monthly2026.reduce((sum,x)=>sum+(Number.isFinite(x.count)?x.count:0),0);
  const data={
    source:'SIMGEO',
    sourceName:'Sistema de Informações Municipais Georreferenciadas',
    municipality:'Joinville',
    retrievedAt:new Date().toISOString(),
    latestCompleteYear:currentYear,
    sourceStatus:failed===0?'online':successful>0?'partial':'offline',
    queryHealth:{requested,succeeded:successful,failed},
    methodology:'Consulta direta às camadas públicas do SIMGeo. O SIGES traz as contagens para dentro da aplicação e mantém a fonte apenas como rastreabilidade. A camada de acidentes registra acidentes de trânsito com vítimas no Município de Joinville.',
    urls:{portal:SIMGEO_URL,rest:SIMGEO_ROOT,schools:SIMGEO_SCHOOLS,roads:SIMGEO_ROADS,cycle:SIMGEO_CYCLE,accidents:SIMGEO_ACCIDENTS},
    summary:{
      totalOccurrences:null,
      schoolUnits:schools.count==null?null:`${schools.count} (todas as categorias: municipais, estaduais, conveniadas e rurais/CEIs)`,
      schoolUnitsCount:schools.count??null,
      schoolUnitsScope:'CEIs + municipais + estaduais + conveniadas + rurais',
      planningLayers:layers.length,
      cycleSegments:cycleCorridors.length,
      accidents2025Count,
      accidents2026Count,
      accidents2025Monthly:monthly2025,
      accidents2026Monthly:monthly2026,
      accidentRoadField:roadField||null
    },
    corridors:cycleCorridors,
    corridors2025,
    corridors2026,
    layers,
    privacy:'Somente metadados e contagens agregadas; nenhuma alteração de camada é realizada pelo SIGES.'
  };
  if(successful>0)cacheSet('simgeo',data);
  else if(cacheGet('simgeo'))return {...cache.simgeo.data,sourceStatus:'stale',retrievedAt:new Date().toISOString()};
  return data;
}
module.exports=function buildPublicSourcesRouter(){const router=express.Router();router.get('/health',(req,res)=>res.json({ok:true,source:'public-sources',mode:'read-only',cacheTtlMs:CACHE_TTL}));
router.get('/status',(req,res)=>res.json({ok:true,retrievedAt:new Date().toISOString(),sources:Object.fromEntries(['cbvj','detrans','simgeo'].map(key=>[key,{cached:Boolean(cacheGet(key)),expiresAt:cache[key]?.expiresAt||null,lastSuccessAt:cache[key]?.lastSuccessAt||null,status:cacheGet(key)?(cache[key].expiresAt>Date.now()?'cached':'stale'):'not_loaded'}]))}));router.get('/cbvj',async(req,res)=>{try{res.json(await loadCbvj(req.query.refresh==='1'))}catch(error){res.status(502).json({error:'Não foi possível consultar o CBVJ agora.',detail:error.message,source:'CBVJ',readOnly:true})}});router.get('/detrans',async(req,res)=>{try{res.json(await loadDetrans(req.query.refresh==='1'))}catch(error){res.status(502).json({error:'Não foi possível consultar o DETRANS agora.',detail:error.message,source:'DETRANS',readOnly:true})}});router.get('/detrans-correlations',async(req,res)=>{try{res.json(await buildDetransSpatial())}catch(error){res.status(502).json({error:'Não foi possível calcular as correspondências espaciais DETRANS/SIMGEO agora.',detail:error.message,source:'DETRANS+SIMGEO',readOnly:true})}});router.get('/simgeo',async(req,res)=>{try{res.json(await loadSimgeo(req.query.refresh==='1'))}catch(error){res.status(502).json({error:'Não foi possível consultar o SIMGeo agora.',detail:error.message,source:'SIMGEO',readOnly:true})}});
router.get('/renaest',async(req,res)=>{try{res.json(await loadRenaest(req.query.refresh==='1'))}catch(error){res.status(502).json({error:'Não foi possível consultar o catálogo RENAEST agora.',detail:error.message,source:'RENAEST',readOnly:true})}});
router.get('/health-data',async(req,res)=>{try{res.json(await loadHealth(req.query.refresh==='1'))}catch(error){res.status(502).json({error:'Não foi possível consultar o catálogo de Saúde agora.',detail:error.message,source:'SAUDE',readOnly:true})}});return router}
module.exports.constants={CBVJ_2025_URL,CBVJ_2024_URL,DETRANS_URL,SIMGEO_URL,SIMGEO_ROOT,SIMGEO_SCHOOLS,SIMGEO_ROADS,SIMGEO_CYCLE,SIMGEO_ACCIDENTS,RENAEST_CKAN,SUS_HOSPITALS_CKAN};