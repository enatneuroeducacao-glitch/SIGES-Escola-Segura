const express=require('express');

const CBVJ_2025_URL='https://www.cbvj.org.br/blog/bombeiros-voluntarios-de-joinville-atenderam-14-574-ocorrencias-em-2025/';
const CBVJ_2024_URL='https://www.cbvj.org.br/blog/bombeiros-voluntarios-de-joinville-atenderam-mais-de-11-mil-ocorrencias-em-2024/';

let cache={data:null,expiresAt:0};

function clean(v){return String(v||'').replace(/&nbsp;/gi,' ').replace(/\s+/g,' ').trim()}
function decodeHtml(v){return clean(String(v||'').replace(/<[^>]*>/g,' ').replace(/&amp;/g,'&').replace(/&#39;/g,"'").replace(/&quot;/g,'"').replace(/&ndash;/g,'–').replace(/&nbsp;/g,' '))}
function number(v){const n=Number(String(v||'').replace(/\./g,'').replace(',','.'));return Number.isFinite(n)?n:null}

function parseRanking(text){
  const out=[];
  const block=text.match(/Ranking[^\n]{0,120}As dez vias com mais acidentes([\s\S]{0,3000}?)(?:Operacional|Fonte:)/i);
  if(!block)return out;
  const rows=block[1].split(/\n+/).map(clean).filter(Boolean);
  for(const row of rows){
    const m=row.match(/^(?:\d+º?\s*\|\s*)?(?:Rua|Avenida|Av\.?|Rodovia|BR-)?\s*([^|]+?)\s*\|\s*(\d+)\s*\|\s*(?:Rua|Avenida|Av\.?|Rodovia|BR-)?\s*([^|]+?)\s*\|\s*(\d+)$/i);
    if(m)out.push({road:clean(m[1]),value2024:number(m[2]),road2025:clean(m[3]),value2025:number(m[4])});
  }
  return out;
}

function normalizeRanking(rows){
  const map=new Map();
  for(const r of rows){
    const road=clean(r.road2025||r.road);
    if(!road)continue;
    map.set(road.toLowerCase(),{road,value2024:r.value2024,value2025:r.value2025});
  }
  return [...map.values()].sort((a,b)=>(b.value2025||0)-(a.value2025||0)).map((x,i)=>({...x,rank2025:i+1,variation2024to2025:x.value2024?Number((((x.value2025-x.value2024)/x.value2024)*100).toFixed(2)):null}));
}

async function fetchArticle(url){
  const r=await fetch(url,{headers:{'User-Agent':'SIGES-Escola-Segura/3.3 public-source-reader'}});
  if(!r.ok)throw new Error(`Fonte externa respondeu HTTP ${r.status}`);
  return await r.text();
}

function htmlToText(html){return decodeHtml(html.replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<br\s*\/?\s*>/gi,'\n').replace(/<\/p>|<\/div>|<\/tr>|<\/li>/gi,'\n'))}

async function loadCbvj(){
  if(cache.data&&cache.expiresAt>Date.now())return cache.data;
  const html2025=await fetchArticle(CBVJ_2025_URL);
  const text2025=htmlToText(html2025);
  const html2024=await fetchArticle(CBVJ_2024_URL).catch(()=>null);
  const text2024=html2024?htmlToText(html2024):'';
  const ranking2025=parseRanking(text2025);
  const normalized=normalizeRanking(ranking2025);
  const data={source:'CBVJ',sourceName:'Corpo de Bombeiros Voluntários de Joinville',municipality:'Joinville',retrievedAt:new Date().toISOString(),latestCompleteYear:2025,latestPublicationDate:'2026-01-08',methodology:'Ranking publicado no Relatório Operacional 2025/CBVJ; o SIGES preserva a fonte e não substitui dados históricos de outras publicações.',urls:{2025:CBVJ_2025_URL,2024:CBVJ_2024_URL},summary:{totalOccurrences2025:14574,trafficCarVsMotorcycle2025:1923},corridors:normalized,raw:{ranking2025Count:normalized.length,has2024Publication:Boolean(text2024)}};
  cache={data,expiresAt:Date.now()+6*60*60*1000};
  return data;
}

module.exports=function buildPublicSourcesRouter({auth}){
  const router=express.Router();
  router.get('/health',auth,async(req,res)=>{res.json({ok:true,source:'public-sources',mode:'read-only'});});
  router.get('/cbvj',auth,async(req,res)=>{
    try{res.json(await loadCbvj());}
    catch(error){res.status(502).json({error:'Não foi possível consultar o CBVJ agora.',detail:error.message,source:'CBVJ',readOnly:true});}
  });
  return router;
};

module.exports.constants={CBVJ_2025_URL,CBVJ_2024_URL};
