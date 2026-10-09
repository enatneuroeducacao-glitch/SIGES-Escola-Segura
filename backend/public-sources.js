const express=require('express');
const AdmZip=require('adm-zip');
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
async function loadCbvj(force=false){if(!force&&cacheGet('cbvj')&&cache.cbvj.expiresAt>Date.now())return cache.cbvj.data;const text=htmlToText(await fetchText(CBVJ_2025_URL));const text24=await fetchText(CBVJ_2024_URL).catch(()=>null);let corridors=normalizeRanking(parseRanking(text));if(!corridors.length){const published2025=[{road:'Monsenhor Gercino',value2024:246,value2025:221},{road:'Dona Francisca',value2024:203,value2025:218},{road:'15 de Novembro',value2024:172,value2025:217},{road:'Albano Schmidt',value2024:151,value2025:191},{road:'Tuiuti',value2024:138,value2025:153},{road:'Santos Dumont',value2024:136,value2025:166},{road:'Florianópolis',value2024:116,value2025:130},{road:'Santa Catarina',value2024:116,value2025:127},{road:'Minas Gerais',value2024:106,value2025:106},{road:'Guanabara',value2024:null,value2025:98}];corridors=normalizeRanking(published2025.map(x=>({...x,road2025:x.road})));}const data={source:'CBVJ',sourceName:'Corpo de Bombeiros Voluntários de Joinville',municipality:'Joinville',retrievedAt:new Date().toISOString(),latestCompleteYear:2025,latestPublicationDate:'2026-01-08',methodology:'Ranking do Relatório Operacional 2025/CBVJ extraído da publicação oficial. Se a estrutura HTML mudar e impedir a leitura automática, o SIGES usa a tabela publicada no artigo de 08/01/2026 como contingência explícita; não representa a totalidade dos acidentes municipais.',urls:{2025:CBVJ_2025_URL,2024:CBVJ_2024_URL},summary:{totalOccurrences2025:14574,trafficCarVsMotorcycle2025:1923},corridors,raw:{ranking2025Count:corridors.length,has2024Publication:Boolean(text24)}};cacheSet('cbvj',data);return data}
function extractRoad(title){let s=clean(title.replace(/^Estudo Técnico(?: Redutor de Velocidade 40 kmh| Controlador de Velocidade 60km\/h| Controlador de Velocidade Semafórico)?\s*/i,''));const m=s.match(/(?:Rua|Av\.?|Avenida|Rodovia|BR-)[^,–]+/i);if(!m)return'Outros';s=m[0].replace(/\s+\d+[\wºª.-]*(?:\s*(?:e|,|\/|com|próx\.?|prox\.?|nº?|n°).*)?$/i,'');return clean(s).replace(/\s+(?:N-S|S-N|L-O|O-L)$/i,'')||clean(m[0])}
function extractSpeed(title){const m=String(title||'').match(/(?:redutor|controlador).*?(30|40|50|60|70|80)\s*km\/?h/i);return m?Number(m[1]):null}
function parseDetrans(html){const items=[];const re=/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>([\s\S]{0,900}?)(?=<a\s|<\/section|$)/gi;let m;while((m=re.exec(html))){const title=decode(m[2]);if(!/Estudo Técnico|Atualização Bienal/i.test(title))continue;const tail=decode(m[3]);const dateMatch=tail.match(/Documento disponibilizado em\s*(\d{2}\/\d{2}\/\d{4})/i);items.push({title,url:new URL(m[1],DETRANS_URL).href,date:dateMatch?dateMatch[1]:null,year:dateMatch?Number(dateMatch[1].slice(-4)):null,road:extractRoad(title),speedKmh:extractSpeed(title)})}const unique=[];const seen=new Set();for(const x of items){if(!seen.has(x.url)){seen.add(x.url);unique.push(x)}}const years={};for(const x of unique){const y=x.year||'indefinido';years[y]=(years[y]||0)+1}const corridors={};for(const x of unique){if(x.road&&x.road!=='Outros')corridors[x.road]=(corridors[x.road]||0)+1}const ranking=Object.entries(corridors).map(([road,count])=>({road,count})).sort((a,b)=>b.count-a.count).map((x,i)=>({...x,rank:i+1}));const latestYear=Math.max(...unique.map(x=>x.year||0));const latestDate=unique.map(x=>x.date).filter(Boolean).sort((a,b)=>b.split('/').reverse().join('').localeCompare(a.split('/').reverse().join('')))[0]||null;return{source:'DETRANS',sourceName:'Departamento de Trânsito de Joinville',municipality:'Joinville',retrievedAt:new Date().toISOString(),latestCompleteYear:latestYear||null,latestPublicationDate:latestDate?latestDate.split('/').reverse().join('-'):null,methodology:'Inventário somente leitura dos estudos técnicos publicados oficialmente pelo DETRANS. O ranking representa quantidade de estudos por corredor, não acidentes. Não se calcula variação 2024→2025 quando a fonte não fornece série anual homogênea.',urls:{publication:DETRANS_URL},summary:{totalOccurrences:null,totalStudies:unique.length,studiesByYear:years},corridors:ranking,documents:unique.slice(0,120)}}
async function loadDetrans(force=false){if(!force&&cacheGet('detrans')&&cache.detrans.expiresAt>Date.now())return cache.detrans.data;const data=parseDetrans(await fetchText(DETRANS_URL));cacheSet('detrans',data);return data}
async function getJson(url){const r=await withTimeout(fetch(url,{headers:{'User-Agent':'SIGES-Escola-Segura/3.7 public-data-reader'}}));if(!r.ok)throw new Error(`Fonte pública respondeu HTTP ${r.status}`);const data=await r.json();if(data&&data.error)throw new Error(data.error.message||'A fonte pública rejeitou a consulta.');return data}
function catalogResources(pkg,yearPattern){const resources=Array.isArray(pkg?.result?.resources)?pkg.result.resources:[];return resources.filter(x=>yearPattern.test(String(x.name||x.description||''))).map(x=>({id:x.id,name:x.name||x.description||'Recurso',format:x.format||null,url:x.url||null,lastModified:x.last_modified||x.metadata_modified||null,size:x.size||null})).sort((a,b)=>String(b.name).localeCompare(String(a.name),undefined,{numeric:true}));}
function csvRows(text){
  const sample=String(text||'').slice(0,5000);
  const delimiters=[';',',','\t'];
  const delimiter=delimiters.map(d=>({d,n:(sample.split(/\r?\n/)[0]||'').split(d).length})).sort((a,b)=>b.n-a.n)[0].d;
  const rows=[];let row=[],field='',quoted=false;
  const s=String(text||'').replace(/^\uFEFF/,'');
  for(let i=0;i<s.length;i++){
    const ch=s[i];
    if(ch==='"'&&quoted&&s[i+1]==='"'){field+='"';i++}
    else if(ch==='"'){quoted=!quoted}
    else if(ch===delimiter&&!quoted){row.push(field);field=''}
    else if((ch==='\n'||ch==='\r')&&!quoted){if(ch==='\r'&&s[i+1]==='\n')i++;row.push(field);field='';if(row.some(x=>String(x).trim()!==''))rows.push(row);row=[]}
    else field+=ch;
  }
  if(field!==''||row.length){row.push(field);rows.push(row)}
  if(!rows.length)return[];
  const headers=rows.shift().map((h,i)=>String(h||'').trim()||('campo_'+(i+1)));
  return rows.map(values=>Object.fromEntries(headers.map((h,i)=>[h,String(values[i]??'').trim()])));
}
function normalizeField(v){return String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'')}
function numericValue(v){if(v==null||String(v).trim()==='')return null;const s=String(v).trim().replace(/\s/g,'');const n=Number(s.includes(',')?s.replace(/\./g,'').replace(',','.'):s);return Number.isFinite(n)?n:null}
function parseRenaestZip(buffer,resource){
  const zip=new AdmZip(buffer);
  const entries=zip.getEntries().filter(e=>!e.isDirectory&&!e.entryName.split('/').pop().startsWith('.')&&/\.(csv|txt)$/i.test(e.entryName));
  const chosen=entries;
  const files=[];const municipalityRows=[];
  for(const entry of chosen){
    const raw=entry.getData();
    let content;
    try{content=new TextDecoder('utf-8').decode(raw)}catch{content=raw.toString('latin1')}
    if(content.includes('\u0000'))content=raw.toString('latin1');
    const rows=csvRows(content);
    const headers=rows.length?Object.keys(rows[0]):[];
    const municipalityKey=headers.find(k=>/(municipio|nomemunicipio|cidade|localidade)/.test(normalizeField(k)));
    const ufKey=headers.find(k=>['uf','siglauf','unidadefederativa','ufacidente'].includes(normalizeField(k)));
    const codeKey=headers.find(k=>/codigoibge|codigomunicipio|municipioibge|codmunicipio|codibge/.test(normalizeField(k)));
    const filtered=rows.filter(row=>{
      if(!municipalityKey&&!codeKey)return false;
      const name=municipalityKey?normalizeField(row[municipalityKey]):'';
      const uf=ufKey?normalizeField(row[ufKey]):'';
      const code=codeKey?String(row[codeKey]||'').replace(/\D/g,''):'';
      return (name==='joinville'&&(uf===''||uf==='sc'||uf==='santacatarina'))||code==='4209102';
    });
    if(/acidente|sinistro/i.test(entry.entryName)) municipalityRows.push(...filtered.map(row=>({...row,__file:entry.entryName})));
    files.push({name:entry.entryName,rows:rows.length,columns:headers,joinvilleRows:filtered.length,municipalityField:municipalityKey||null});
  }
  const fields=municipalityRows.length?Object.keys(municipalityRows[0]).filter(k=>!k.startsWith('__')):[];
  const metricFields=fields.filter(k=>/(sinistro|acidente|ocorrencia|quantidade|total|morto|obito|ferido|vitima)/.test(normalizeField(k)));
  const aggregates={};
  for(const key of metricFields){
    const vals=municipalityRows.map(r=>numericValue(r[key])).filter(v=>v!==null);
    if(vals.length)aggregates[key]=vals.reduce((a,b)=>a+b,0);
  }
  const totalField=metricFields.find(k=>['qtdeacidente','qtdeacidentes','qtdesinistro','qtdesinistros','totalacidentes','totalsinistros'].includes(normalizeField(k))||/total.*(sinistro|acidente)|(sinistro|acidente).*total|quantidade.*(sinistro|acidente)|(sinistro|acidente).*quantidade/.test(normalizeField(k)));
  const total=totalField?aggregates[totalField]:null;
  const match=String(resource.name||'').match(/(0[1-9]|1[0-2])[- ]?(20(?:25|26))/i);
  return {month:match?Number(match[1]):null,year:match?Number(match[2]):null,resourceName:resource.name,resourceUrl:resource.url,downloadedAt:new Date().toISOString(),fileCount:entries.length,csvFiles:files,joinvilleRecords:municipalityRows.length,joinvilleAggregates:aggregates,totalSinistros:total,totalField:totalField||null,fields:fields.slice(0,80),sample:municipalityRows.slice(0,10).map(({__file,...row})=>row)};
}
async function downloadRenaestResource(resource){
  if(!resource.url)throw new Error('Recurso sem URL de download');
  const response=await withTimeout(fetch(resource.url,{headers:{'User-Agent':'SIGES-Escola-Segura/4.0 archive-ingestion'}}),45000);
  if(!response.ok)throw new Error('Download HTTP '+response.status);
  const declared=Number(response.headers.get('content-length')||0);
  if(declared>50*1024*1024)throw new Error('Arquivo ZIP excede o limite de segurança de 50 MB');
  const bytes=Buffer.from(await response.arrayBuffer());
  if(bytes.length>50*1024*1024)throw new Error('Arquivo ZIP excede o limite de segurança de 100 MB');
  return parseRenaestZip(bytes,resource);
}
let renaestJob=null;
async function runRenaestIngestion(resources,base){
  const pending=[...resources];let cursor=0;
  const results=[];
  const worker=async()=>{
    while(cursor<pending.length){
      const resource=pending[cursor++];
      try{results.push({ok:true,data:await downloadRenaestResource(resource)})}
      catch(error){results.push({ok:false,name:resource.name,error:error.message})}
      const good=results.filter(x=>x.ok).map(x=>x.data).sort((a,b)=>(a.year-b.year)||(a.month-b.month));
      const failures=results.filter(x=>!x.ok);
      const monthly=good.map(x=>({year:x.year,month:x.month,resourceName:x.resourceName,joinvilleRecords:x.joinvilleRecords,totalSinistros:x.totalSinistros,totalField:x.totalField,joinvilleAggregates:x.joinvilleAggregates,status:x.joinvilleRecords?'dados extraídos':x.csvFiles.length?'sem linha Joinville':'sem CSV compatível'}));
      const byYear={};
      for(const y of [2025,2026]){
        const ms=good.filter(x=>x.year===y);
        const metrics={};
        for(const m of ms)for(const [k,v] of Object.entries(m.joinvilleAggregates||{}))metrics[k]=(metrics[k]||0)+v;
        const totalCandidates=ms.filter(m=>m.totalSinistros!==null);
        byYear[y]={monthsProcessed:ms.length,monthsExpected:resources.filter(r=>String(r.name).includes(String(y))).length,records:ms.reduce((n,m)=>n+m.joinvilleRecords,0),aggregates:metrics,totalSinistros:totalCandidates.length?totalCandidates.reduce((n,m)=>n+m.totalSinistros,0):null};
      }
      const next={...base,sourceStatus:failures.length?(good.length?'partial':'offline'):'online',ingestionStatus:results.length!==pending.length?'processing':failures.length===0?'complete':good.length?'partial':'failed',progress:{processed:results.length,total:pending.length,successful:good.length,failed:failures.length},monthly,annual:byYear,archives:good.map(x=>({name:x.resourceName,year:x.year,month:x.month,fileCount:x.fileCount,joinvilleRecords:x.joinvilleRecords,totalSinistros:x.totalSinistros,totalField:x.totalField,csvFiles:x.csvFiles,fields:x.fields,sample:x.sample})),errors:failures,latestAvailableMonth:good.filter(x=>x.year===2026).sort((a,b)=>b.month-a.month)[0]?.month||null,joinvilleRecords:good.reduce((n,x)=>n+x.joinvilleRecords,0),joinvilleAggregates:Object.assign({},...good.map(x=>x.joinvilleAggregates))};
      cacheSet('renaest',next);
    }
  };
  await Promise.all(Array.from({length:Math.min(2,pending.length)},worker));
  const current=cacheGet('renaest')||base;
  const successful=results.filter(x=>x.ok).length;const failed=results.length-successful;cacheSet('renaest',{...current,sourceStatus:failed?(successful?'partial':'offline'):'online',ingestionStatus:failed?(successful?'partial':'failed'):'complete',progress:{processed:pending.length,total:pending.length,successful,failed}});
  renaestJob=null;
}
async function loadRenaest(force=false){
  if(!force&&cacheGet('renaest')&&cache.renaest.expiresAt>Date.now())return cache.renaest.data;
  if(renaestJob&&cacheGet('renaest'))return cache.renaest.data;
  const pkg=await getJson(RENAEST_CKAN);
  const resources=catalogResources(pkg,/RENAEST\s*-?\s*Mensal\s*-?\s*(0[1-9]|1[0-2])\s*-?20(?:25|26)/i)
    .map(x=>{const m=String(x.name).match(/(0[1-9]|1[0-2])\s*-?\s*(20(?:25|26))/i);return {...x,month:m?Number(m[1]):null,year:m?Number(m[2]):null}})
    .filter(x=>x.year&&x.month)
    .sort((a,b)=>(a.year-b.year)||(a.month-b.month));
  const initial={source:'RENAEST',sourceName:'Registro Nacional de Sinistros e Estatísticas de Trânsito',municipality:'Joinville/SC',retrievedAt:new Date().toISOString(),sourceStatus:resources.length?'partial':'offline',latestCompleteYear:2026,latestAvailableMonth:null,available2025Months:resources.filter(x=>x.year===2025).map(x=>x.month),available2026Months:resources.filter(x=>x.year===2026).map(x=>x.month),resourceCount:resources.length,resources,ingestion:'zip-csv',ingestionStatus:resources.length?'processing':'unavailable',progress:{processed:0,total:resources.length,successful:0,failed:0},monthly:[],annual:{},archives:[],errors:[],joinvilleRecords:0,joinvilleAggregates:{},methodology:'O SIGES baixa os ZIPs mensais do catálogo oficial RENAEST, extrai os arquivos CSV/TXT no backend e tenta identificar linhas de Joinville/SC. Totais só são exibidos quando existe campo numérico de sinistros/acidentes na planilha; a quantidade de linhas nunca é tratada como quantidade de acidentes.',urls:{dataset:'https://dados.transportes.gov.br/dataset/renaest',api:RENAEST_CKAN}};
  cacheSet('renaest',initial);
  if(resources.length){renaestJob=runRenaestIngestion(resources,initial).catch(error=>{const current=cacheGet('renaest')||initial;cacheSet('renaest',{...current,sourceStatus:'offline',ingestionStatus:'failed',errors:[...(current.errors||[]),{error:error.message}]});renaestJob=null});}
  return initial;
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
  const monthly2025=month2025Results.map((r,i)=>{const count=r.status==='fulfilled'?Number(r.value?.count):NaN;return{month:i+1,count:Number.isFinite(count)?count:null,status:Number.isFinite(count)?'ok':'unavailable'}});
  const monthly2026=month2026Results.map((r,i)=>{const count=r.status==='fulfilled'?Number(r.value?.count):NaN;return{month:i+1,count:Number.isFinite(count)?count:null,status:Number.isFinite(count)?'ok':'unavailable'}});
  const layers=(layersJson.layers||[]).map(x=>({id:x.id,name:x.name,type:x.type}));
  const cycleCorridors=(cycleJson.features||[]).map(f=>f.attributes||{}).filter(x=>clean(x.nome_logra));
  const successful=baseResults.filter(r=>r.status==='fulfilled').length+roadResults.filter(r=>r.status==='fulfilled').length;
  const requested=baseResults.length+roadResults.length;
  const failed=requested-successful;
  const accidents2025Count=monthly2025.some(x=>x.status==='ok')?monthly2025.reduce((sum,x)=>sum+(Number.isFinite(x.count)?x.count:0),0):null;
  const accidents2026Count=monthly2026.some(x=>x.status==='ok')?monthly2026.reduce((sum,x)=>sum+(Number.isFinite(x.count)?x.count:0),0):null;
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
router.get('/status',(req,res)=>res.json({ok:true,retrievedAt:new Date().toISOString(),sources:Object.fromEntries(['cbvj','detrans','simgeo','renaest','health'].map(key=>[key,{cached:Boolean(cacheGet(key)),expiresAt:cache[key]?.expiresAt||null,lastSuccessAt:cache[key]?.lastSuccessAt||null,status:key==='renaest'&&cacheGet(key)?.ingestionStatus==='processing'?'processing':cacheGet(key)?(cache[key].expiresAt>Date.now()?'cached':'stale'):'not_loaded',progress:cacheGet(key)?.progress||null}]))}));router.get('/cbvj',async(req,res)=>{try{res.json(await loadCbvj(req.query.refresh==='1'))}catch(error){res.status(502).json({error:'Não foi possível consultar o CBVJ agora.',detail:error.message,source:'CBVJ',readOnly:true})}});router.get('/detrans',async(req,res)=>{try{res.json(await loadDetrans(req.query.refresh==='1'))}catch(error){res.status(502).json({error:'Não foi possível consultar o DETRANS agora.',detail:error.message,source:'DETRANS',readOnly:true})}});router.get('/detrans-correlations',async(req,res)=>{try{res.json(await buildDetransSpatial())}catch(error){res.status(502).json({error:'Não foi possível calcular as correspondências espaciais DETRANS/SIMGEO agora.',detail:error.message,source:'DETRANS+SIMGEO',readOnly:true})}});router.get('/simgeo',async(req,res)=>{try{res.json(await loadSimgeo(req.query.refresh==='1'))}catch(error){res.status(502).json({error:'Não foi possível consultar o SIMGeo agora.',detail:error.message,source:'SIMGEO',readOnly:true})}});
router.get('/renaest',async(req,res)=>{try{res.json(await loadRenaest(req.query.refresh==='1'))}catch(error){res.status(502).json({error:'Não foi possível consultar o catálogo RENAEST agora.',detail:error.message,source:'RENAEST',readOnly:true})}});
router.get('/health-data',async(req,res)=>{try{res.json(await loadHealth(req.query.refresh==='1'))}catch(error){res.status(502).json({error:'Não foi possível consultar o catálogo de Saúde agora.',detail:error.message,source:'SAUDE',readOnly:true})}});return router}
module.exports.constants={CBVJ_2025_URL,CBVJ_2024_URL,DETRANS_URL,SIMGEO_URL,SIMGEO_ROOT,SIMGEO_SCHOOLS,SIMGEO_ROADS,SIMGEO_CYCLE,SIMGEO_ACCIDENTS,RENAEST_CKAN,SUS_HOSPITALS_CKAN};