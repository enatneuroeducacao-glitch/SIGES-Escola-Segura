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
function parseRanking(text){const out=[];const heading=text.search(/As dez vias com mais acidentes/i);if(heading<0)return out;const section=text.slice(heading).split(/Operacional|Fonte:/i)[0];for(const raw of section.split(/\n+/)){const row=clean(raw);const m=row.match(/^(?:\d+\s*[ºo]?\s*\|\s*)?(?:Rua|Avenida|Av\.?|Rodovia|BR-)?\s*([^|]+?)\s*\|\s*(\d+)\s*\|\s*(?:Rua|Avenida|Av\.?|Rodovia|BR-)?\s*([^|]+?)\s*\|\s*(\d+)\s*$/i);if(m)out.push({road:clean(m[1]),value2024:number(m[2]),road2025:clean(m[3]),value2025:number(m[4])})}return out}
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
async function loadRenaest(force=false){if(!force&&cacheGet('renaest')&&cache.renaest.expiresAt>Date.now())return cache.renaest.data;const pkg=await getJson(RENAEST_CKAN);const resources=catalogResources(pkg,/RENAEST\\s*-?\\s*Mensal\\s*-?\\s*(0[1-9]|1[0-2])-2026/i);const months=resources.map(x=>{const m=String(x.name).match(/(0[1-9]|1[0-2])-2026/);return m?Number(m[1]):null}).filter(Boolean).sort((a,b)=>a-b);const latest=months.length?months[months.length-1]:null;const data={source:'RENAEST',sourceName:'Registro Nacional de Sinistros e Estatísticas de Trânsito',municipality:'Brasil / Joinville quando a competência possuir recorte municipal',retrievedAt:new Date().toISOString(),sourceStatus:resources.length?'online':'partial',latestCompleteYear:2026,latestAvailableMonth:latest,available2026Months:months,resourceCount:resources.length,resources,methodology:'Catálogo oficial consultado via API CKAN. O SIGES registra disponibilidade e atualidade da competência sem inventar dados ainda não publicados. A ingestão analítica por município será feita sobre os arquivos mensais disponíveis.',urls:{dataset:'https://dados.transportes.gov.br/dataset/renaest',api:RENAEST_CKAN}};cacheSet('renaest',data);return data}
async function loadHealth(force=false){if(!force&&cacheGet('health')&&cache.health.expiresAt>Date.now())return cache.health.data;const pkg=await getJson(SUS_HOSPITALS_CKAN);const resources=catalogResources(pkg,/2026/i);const latest=resources[0]||null;const data={source:'SAUDE',sourceName:'Ministério da Saúde — Hospitais e Leitos',municipality:'Brasil / recorte municipal quando disponível',retrievedAt:new Date().toISOString(),sourceStatus:resources.length?'online':'partial',latestCompleteYear:2026,latestResource:latest,resourceCount:resources.length,resources,methodology:'Catálogo oficial do Portal de Dados Abertos do SUS. Os dados agregados respeitam as limitações de privacidade da fonte; o SIGES não identifica cidadãos.',urls:{dataset:'https://dadosabertos.saude.gov.br/dataset/hospitais-e-leitos',api:SUS_HOSPITALS_CKAN}};cacheSet('health',data);return data}
async function loadSimgeo(force=false){
  if(!force&&cacheGet('simgeo')&&cache.simgeo.expiresAt>Date.now())return cache.simgeo.data;
  const monthQueries=Array.from({length:12},(_,i)=>{
    const m=String(i+1).padStart(2,'0'),next=String(i+2).padStart(2,'0');
    const endDate=i===11?'2026-01-01':`2025-${next}-01`;
    const where=encodeURIComponent(`data >= DATE '2025-${m}-01' AND data < DATE '${endDate}'`);
    return getJson(`${SIMGEO_ACCIDENTS}/query?where=${where}&returnCountOnly=true&f=json`);
  });
  const results=await Promise.allSettled([
    getJson(`${SIMGEO_SCHOOLS}/query?where=1%3D1&returnCountOnly=true&f=json`),
    getJson(`${SIMGEO_ROOT}/planejamento/MapServer/layers?f=json`),
    getJson(`${SIMGEO_CYCLE}/query?where=1%3D1&outFields=nome_logra,ciclo,extensao,categoria&returnGeometry=false&resultRecordCount=2000&f=json`),
    getJson(`${SIMGEO_ACCIDENTS}/query?where=ano%3D2025&returnCountOnly=true&f=json`),
    ...monthQueries
  ]);
  const value=(i,fallback)=>results[i]?.status==='fulfilled'?results[i].value:fallback;
  const schools=value(0,{count:null}),layersJson=value(1,{layers:[]}),cycleJson=value(2,{features:[]}),accidentYear2025=value(3,{count:null});
  const monthResults=results.slice(4);
  const layers=(layersJson.layers||[]).map(x=>({id:x.id,name:x.name,type:x.type}));
  const cycleCorridors=(cycleJson.features||[]).map(f=>f.attributes||{}).filter(x=>clean(x.nome_logra));
  const monthly=monthResults.map((r,i)=>({month:i+1,count:r.status==='fulfilled'?Number(r.value.count)||0:null,status:r.status==='fulfilled'?'ok':'unavailable'}));
  const successful=results.filter(r=>r.status==='fulfilled').length;
  const failed=results.length-successful;
  const data={
    source:'SIMGEO',
    sourceName:'Sistema de Informações Municipais Georreferenciadas',
    municipality:'Joinville',
    retrievedAt:new Date().toISOString(),
    latestCompleteYear:2025,
    latestPublicationDate:null,
    sourceStatus:failed===0?'online':successful>0?'partial':'offline',
    queryHealth:{requested:results.length,succeeded:successful,failed},
    methodology:'Leitura somente consulta das camadas públicas do SIMGeo. Quantidades são inventário de dados, não ocorrência de sinistros. A camada de Unidades Escolares inclui CEIs, escolas municipais, escolas estaduais, escolas conveniadas e escolas municipais rurais conforme o campo categoria da fonte oficial. A infraestrutura cicloviária somente é atribuída quando há correspondência nominal com o logradouro.',
    urls:{portal:SIMGEO_URL,rest:SIMGEO_ROOT,schools:SIMGEO_SCHOOLS,roads:SIMGEO_ROADS,cycle:SIMGEO_CYCLE,accidents:SIMGEO_ACCIDENTS},
    summary:{
      totalOccurrences:null,
      schoolUnits:schools.count==null?null:`${schools.count} (todas as categorias: municipais, estaduais, conveniadas e rurais/CEIs)`,
      schoolUnitsCount:schools.count??null,
      schoolUnitsScope:'CEIs + municipais + estaduais + conveniadas + rurais',
      planningLayers:layers.length,
      cycleSegments:cycleCorridors.length,
      accidents2025Count:accidentYear2025.count==null?null:Number(accidentYear2025.count)||0,
      accidents2025Monthly:monthly
    },
    corridors:cycleCorridors,
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