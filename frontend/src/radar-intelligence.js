export function normalizeCorridor(value=''){return String(value||'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/^rua\s+/,'').replace(/^avenida\s+/,'').replace(/^av\.\s+/,'').replace(/\s+/g,' ').trim()}

export function buildCorridorIntelligence(matrix=[]){
  const groups=new Map();
  for(const row of matrix){
    const corridor=String(row['Corredor normalizado']||'').trim()||normalizeCorridor(row.Endereço||'')||'sem corredor';
    if(!groups.has(corridor))groups.set(corridor,{corridor,schools:[],p1:0,p2:0,detransStudies:0,accident2023:null,accident2024:null,ranking2024:null,ipe:[],evidence:0,reliability:[]});
    const g=groups.get(corridor);g.schools.push(row);
    const p=String(row.Prioridade||'');if(p.startsWith('P1'))g.p1++;else if(p.startsWith('P2'))g.p2++;
    g.detransStudies=Math.max(g.detransStudies,Number(row['Nº estudos DETRANS corredor'])||0);
    const a23=Number(row['Acidentes corredor 2023']);const a24=Number(row['Acidentes corredor 2024']);
    if(Number.isFinite(a23))g.accident2023=g.accident2023===null? a23:Math.max(g.accident2023,a23);
    if(Number.isFinite(a24))g.accident2024=g.accident2024===null? a24:Math.max(g.accident2024,a24);
    const r=Number(row['Ranking acidentes 2024']);if(Number.isFinite(r))g.ranking2024=g.ranking2024===null?r:Math.min(g.ranking2024,r);
    const i=Number(row['IPE Territorial 3.2']);if(Number.isFinite(i))g.ipe.push(i);
    const e=Number(row['Evidência DETRANS (0-100)']);if(Number.isFinite(e)&&e>0)g.evidence++;
    const rel=Number(row['Confiabilidade territorial']);if(Number.isFinite(rel))g.reliability.push(rel);
  }
  return [...groups.values()].map(g=>({...g,avgIpe=g.ipe.length?g.ipe.reduce((a,b)=>a+b,0)/g.ipe.length:0,maxIpe=g.ipe.length?Math.max(...g.ipe):0,avgReliability=g.reliability.length?g.reliability.reduce((a,b)=>a+b,0)/g.reliability.length:0})).filter(g=>g.corridor!=='sem corredor').sort((a,b)=>(b.p1*4+b.p2*2+b.avgIpe/25+b.evidence)-(a.p1*4+a.p2*2+a.avgIpe/25+a.evidence));
}
