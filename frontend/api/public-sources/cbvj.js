const CBVJ_2025_URL='https://www.cbvj.org.br/blog/bombeiros-voluntarios-de-joinville-atenderam-14-574-ocorrencias-em-2025/';
const CBVJ_2024_URL='https://www.cbvj.org.br/blog/bombeiros-voluntarios-de-joinville-atenderam-mais-de-11-mil-ocorrencias-em-2024/';

const clean=v=>String(v??'').replace(/&nbsp;/gi,' ').replace(/\s+/g,' ').trim();
const decode=v=>clean(String(v??'').replace(/<[^>]*>/g,' ').replace(/&amp;/g,'&').replace(/&#39;/g,"'").replace(/&quot;/g,'"').replace(/&ndash;/g,'–').replace(/&nbsp;/g,' '));
const number=v=>{const n=Number(String(v??'').replace(/\./g,'').replace(',','.'));return Number.isFinite(n)?n:null};

async function fetchText(url){
  const r=await fetch(url,{headers:{'User-Agent':'SIGES-Escola-Segura/4.0 public-source-reader'}});
  if(!r.ok)throw new Error(`Fonte externa respondeu HTTP ${r.status}`);
  return r.text();
}

function parseRanking(html){
  const out=[];
  const heading=html.search(/As dez vias com mais acidentes/i);
  if(heading<0)return out;
  const section=html.slice(heading).split(/Operacional|Fonte:/i)[0];
  const rows=section.match(/<tr[\s\S]*?<\/tr>/gi)||[];
  for(const row of rows){
    const cells=[];const re=/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;let m;
    while((m=re.exec(row)))cells.push(decode(m[1]));
    if(cells.length<5)continue;
    const pos=cells[0].match(/^(\d{1,2})º?$/);if(!pos)continue;
    const v24=number(cells[2]),v25=number(cells[4]);
    if(v24==null||v25==null)continue;
    out.push({rank:Number(pos[1]),road2024:clean(cells[1]),value2024:v24,road2025:clean(cells[3]),value2025:v25});
  }
  if(out.length)return out;
  const text=decode(section.replace(/<\/td>|<\/th>/gi,' | ').replace(/<\/tr>|<br\s*\/?>/gi,'\n'));
  for(const raw of text.split(/\n+/)){
    const row=clean(raw);const m=row.match(/^(?:\d+\s*[ºo]?\s*\|\s*)?(?:Rua|Avenida|Av\.?|Rodovia|BR-)?\s*([^|]+?)\s*\|\s*(\d+)\s*\|\s*(?:Rua|Avenida|Av\.?|Rodovia|BR-)?\s*([^|]+?)\s*\|\s*(\d+)\s*$/i);
    if(!m)continue;
    out.push({road:clean(m[1]),value2024:number(m[2]),road2025:clean(m[3]),value2025:number(m[4])});
  }
  return out;
}

function normalize(rows){
  const map=new Map();
  for(const r of rows){const road=clean(r.road2025||r.road);if(road)map.set(road.toLowerCase(),{road,road2024:clean(r.road2024||''),value2024:r.value2024,value2025:r.value2025});}
  return [...map.values()].sort((a,b)=>(b.value2025||0)-(a.value2025||0)).map((x,i)=>({...x,rank2025:i+1,variation2024to2025:x.value2024?Number((((x.value2025-x.value2024)/x.value2024)*100).toFixed(2)):null}));
}

let cache=null;let expiresAt=0;
export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  try{
    if(cache&&expiresAt>Date.now())return res.status(200).json(cache);
    const html=await fetchText(CBVJ_2025_URL);
    const html24=await fetchText(CBVJ_2024_URL).catch(()=>null);
    const corridors=normalize(parseRanking(html));
    const data={source:'CBVJ',sourceName:'Corpo de Bombeiros Voluntários de Joinville',municipality:'Joinville',retrievedAt:new Date().toISOString(),latestCompleteYear:2025,latestPublicationDate:'2026-01-08',methodology:'Ranking oficial das dez vias com mais acidentes publicado no Relatório Operacional 2025/CBVJ. O SIGES preserva a fonte e não substitui os dados históricos.',urls:{2025:CBVJ_2025_URL,2024:CBVJ_2024_URL},summary:{totalOccurrences2025:14574,trafficCarVsMotorcycle2025:1923},corridors,raw:{ranking2025Count:corridors.length,has2024Publication:Boolean(html24)}};
    cache=data;expiresAt=Date.now()+15*60*1000;
    return res.status(200).json(data);
  }catch(error){
    return res.status(502).json({error:'Não foi possível consultar o CBVJ agora.',detail:error?.message||'Erro desconhecido',source:'CBVJ',readOnly:true});
  }
}
