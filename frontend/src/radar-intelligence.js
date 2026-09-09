export function normalizeCorridor(value=''){return String(value||'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/^rua\s+/,'').replace(/^avenida\s+/,'').replace(/^av\.\s+/,'').replace(/\s+/g,' ').trim()}

const finite=(v)=>{const n=Number(v);return Number.isFinite(n)?n:null};
const avg=(a)=>a.length?a.reduce((s,v)=>s+v,0)/a.length:null;

export function buildCorridorIntelligence(matrix=[]){
 const groups=new Map();
 for(const row of matrix){
  const corridor=String(row['Corredor normalizado']||'').trim()||normalizeCorridor(row.Endereço||'')||'sem corredor';
  if(!groups.has(corridor))groups.set(corridor,{corridor,schools:[],p1:0,p2:0,detransStudies:0,accident2023:null,accident2024:null,ranking2024:null,ipe:[],evidence:0,reliability:[],territorialEvidence:[],sources:new Set()});
  const g=groups.get(corridor);g.schools.push(row);
  const p=String(row.Prioridade||'');if(p.startsWith('P1'))g.p1++;else if(p.startsWith('P2'))g.p2++;
  g.detransStudies=Math.max(g.detransStudies,finite(row['Nº estudos DETRANS corredor'])||0);
  const a23=finite(row['Acidentes corredor 2023']),a24=finite(row['Acidentes corredor 2024']);
  if(a23!==null)g.accident2023=g.accident2023===null?a23:Math.max(g.accident2023,a23);
  if(a24!==null)g.accident2024=g.accident2024===null?a24:Math.max(g.accident2024,a24);
  const r=finite(row['Ranking acidentes 2024']);if(r!==null)g.ranking2024=g.ranking2024===null?r:Math.min(g.ranking2024,r);
  const i=finite(row['IPE Territorial 3.2']);if(i!==null)g.ipe.push(i);
  const e=finite(row['Evidência DETRANS (0-100)']);if(e!==null&&e>0){g.evidence++;g.territorialEvidence.push(e)}
  const rel=finite(row['Confiabilidade territorial']);if(rel!==null)g.reliability.push(rel);
  const source=String(row['Fonte territorial principal']||row['Fonte principal']||'').trim();if(source)g.sources.add(source);
 }
 return [...groups.values()].map(g=>({...g,avgIpe:avg(g.ipe)||0,maxIpe:g.ipe.length?Math.max(...g.ipe):0,avgReliability:avg(g.reliability)||0,evidenceScore:avg(g.territorialEvidence)||0,sources:[...g.sources]})).filter(g=>g.corridor!=='sem corredor').sort((a,b)=>{const sa=b.p1*4+b.p2*2+b.avgIpe/25+b.evidenceScore/25;const sb=a.p1*4+a.p2*2+a.avgIpe/25+a.evidenceScore/25;return sa-sb});
}
