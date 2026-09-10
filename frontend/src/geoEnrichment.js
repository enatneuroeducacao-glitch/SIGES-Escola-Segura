const API='https://geo.joinville.sc.gov.br/server/rest/services';
const ENDPOINTS={
  schools:`${API}/SED/unidades_escolares_sed/FeatureServer/0/query`,
  accidents:`${API}/base_geo/acidentes/FeatureServer/0/query`,
  bus:`${API}/base_geo/Pontos_de_%C3%B4nibus/FeatureServer/0/query`,
  survey:`${API}/Hosted/survey123_f3ea329d2114411da56031a621ac5fd0_form/FeatureServer/0/query`
};
const clean=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\b(rua|r|av|av\.|avenida|rodovia|br[- ]?)\b/g,'').replace(/[^a-z0-9]+/g,' ').trim();
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function query(url,params={},timeout=18000){
  const qs=new URLSearchParams({f:'json',...params});
  const ctrl=new AbortController(); const t=setTimeout(()=>ctrl.abort(),timeout);
  try{const r=await fetch(`${url}?${qs}`,{cache:'no-store',signal:ctrl.signal});if(!r.ok)throw new Error(`HTTP ${r.status}`);const j=await r.json();if(j.error)throw new Error(j.error.message||'ArcGIS error');return j}
  finally{clearTimeout(t)}
}
async function allFeatures(url,baseParams={},pageSize=2000){
  const out=[];let offset=0;
  for(let i=0;i<30;i++){
    const j=await query(url,{...baseParams,resultOffset:offset,resultRecordCount:pageSize});const fs=j.features||[];out.push(...fs);
    if(!j.exceededTransferLimit&&fs.length<pageSize)break;if(!fs.length)break;offset+=fs.length;await sleep(50)
  }
  return out
}
const dist=(a,b)=>Math.hypot((a?.x??0)-(b?.x??0),(a?.y??0)-(b?.y??0));
const nearest=(p,arr,r=500)=>arr.filter(x=>dist(p,x.geometry)<r);
function schoolMatch(row,schools){
  const n=clean(row.Unidade),a=clean(row.Endereço);let best=schools.find(s=>clean(s.attributes?.escola)===n);
  if(!best)best=schools.find(s=>{const sn=clean(s.attributes?.escola);return sn&&n&&(sn.includes(n)||n.includes(sn))});
  if(!best&&a)best=schools.find(s=>{const sa=clean(s.attributes?.endereço);return sa&&a&&sa.includes(a.split(' ')[0])&&sa.includes(a.replace(/[^0-9]/g,''))});
  return best||null
}
function mode(vals){const a=vals.filter(v=>v!==null&&v!==undefined&&String(v).trim()!=='').map(String);if(!a.length)return null;const c={};a.forEach(v=>c[v]=(c[v]||0)+1);return Object.entries(c).sort((x,y)=>y[1]-x[1])[0][0]}
export async function enrichWithOfficialGeo(matrix){
  const meta={officialGeo:false,schoolMatches:0,accidentRecords:0,busRecords:0,surveyRecords:0,geoRadiusMeters:500,geoSources:[]};
  try{
    const [schools,accidents,bus,survey]=await Promise.all([
      allFeatures(ENDPOINTS.schools,{where:'1=1',outFields:'objectid,categoria,escola,endereço',returnGeometry:'true',outSR:'31982'},2000),
      allFeatures(ENDPOINTS.accidents,{where:'ano >= 2023 AND ano <= 2025',outFields:'objectid,ano,vitimas,logradouro,bairro',returnGeometry:'true',outSR:'31982'},2000),
      allFeatures(ENDPOINTS.bus,{where:'1=1',outFields:'objectid,bairro,observacao',returnGeometry:'true',outSR:'31982'},2000),
      allFeatures(ENDPOINTS.survey,{where:'1=1',outFields:'datahora,logradouro,velocidade,calcada,seguranca,iluminacao,seguranca_publica',returnGeometry:'true',outSR:'31982'},1000)
    ]);
    meta.officialGeo=true;meta.schoolMatches=0;meta.accidentRecords=accidents.length;meta.busRecords=bus.length;meta.surveyRecords=survey.length;
    meta.geoSources=[
      {id:'SED',label:'SED / unidades escolares',url:ENDPOINTS.schools},
      {id:'ACIDENTES',label:'Base oficial de acidentes com vítimas',url:ENDPOINTS.accidents},
      {id:'ONIBUS',label:'Pontos de ônibus georreferenciados',url:ENDPOINTS.bus},
      {id:'CAMPO',label:'Survey de segurança viária',url:ENDPOINTS.survey}
    ];
    const acc=accidents.map(f=>({geometry:f.geometry,ano:Number(f.attributes?.ano),vitimas:Number(f.attributes?.vitimas)||0}));
    const busPts=bus.filter(f=>f.geometry),surveyPts=survey.filter(f=>f.geometry);
    const enriched=matrix.map(row=>{
      const s=schoolMatch(row,schools),p=s?.geometry;if(p)meta.schoolMatches++;
      const nearAcc=p?nearest(p,acc,500):[],nearBus=p?nearest(p,busPts,500):[],nearSurvey=p?nearest(p,surveyPts,500):[];
      const byYear=y=>nearAcc.filter(x=>x.ano===y),y23=byYear(2023),y24=byYear(2024),y25=byYear(2025);
      const surveySpeeds=nearSurvey.map(x=>Number(x.attributes?.velocidade)).filter(x=>Number.isFinite(x)&&x>0&&x<150);
      const surveySidewalk=mode(nearSurvey.map(x=>x.attributes?.calcada)),surveyLighting=mode(nearSurvey.map(x=>x.attributes?.iluminacao)),surveySafety=mode(nearSurvey.map(x=>x.attributes?.seguranca));
      return {...row,'Correspondência SED':p?'CONFIRMADA':'NÃO LOCALIZADA','Categoria SED':s?.attributes?.categoria??null,'Acidentes com vítimas 500m 2023':y23.length,'Acidentes com vítimas 500m 2024':y24.length,'Acidentes com vítimas 500m 2025':y25.length,'Vítimas 500m 2023':y23.reduce((n,x)=>n+x.vitimas,0),'Vítimas 500m 2024':y24.reduce((n,x)=>n+x.vitimas,0),'Vítimas 500m 2025':y25.reduce((n,x)=>n+x.vitimas,0),'Pontos de ônibus 500m':nearBus.length,'Vistorias viárias 500m':nearSurvey.length,'Velocidade observada mediana 500m':surveySpeeds.length?surveySpeeds.sort((a,b)=>a-b)[Math.floor(surveySpeeds.length/2)]:null,'Calçada observada 500m':surveySidewalk,'Iluminação observada 500m':surveyLighting,'Segurança viária observada 500m':surveySafety,'Fonte geoespacial oficial':'SIMGeo / SED / bases municipais','Raio análise (m)':500}
    });
    return {matrix:enriched,meta}
  }catch(error){return {matrix,meta:{...meta,error:String(error?.message||error),officialGeo:false}}}
}
