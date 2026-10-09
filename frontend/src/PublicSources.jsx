import React,{useEffect,useState} from 'react';
import {Database,RefreshCw,CheckCircle2,AlertTriangle,LocateFixed,Printer} from 'lucide-react';
import './public-sources.css';

const fmt=v=>v==null?'—':typeof v==='number'?v.toLocaleString('pt-BR'):String(v);
const esc=v=>String(v??'').replace(/[&<>"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]));

function printTable(title,subtitle,headers,rows){
  const win=window.open('','_blank','width=1100,height=800');
  if(!win){alert('Permita pop-ups para imprimir.');return}
  win.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(title)}</title><style>body{font:13px Arial;color:#182b39;margin:30px}h1{font-size:23px}p{color:#667782;font-size:11px}table{width:100%;border-collapse:collapse;font-size:10px}th,td{border:1px solid #ccd5da;padding:6px;text-align:left}th{background:#f0f3f5}</style></head><body><h1>${esc(title)}</h1><p>${esc(subtitle)}</p><table><thead><tr>${headers.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map(c=>`<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table><script>window.onload=()=>setTimeout(()=>window.print(),300)</script></body></html>`);
  win.document.close();
}

const API_BASE=(import.meta.env.VITE_API_BASE||'https://escola-segura-api-r51o.onrender.com/api').replace(/\/$/,'');
const sourceNames={cbvj:'CBVJ',detrans:'DETRANS','detransSpatial':'DETRANS ↔ SIMGeo',simgeo:'SIMGEO',renaest:'RENAEST 2026',health:'SAÚDE 2026'};

function SourceCard({name,desc,active,onClick}){
  return <div className={`source-card ${active?'active':'planned'}`}>
    <button type="button" className="source-card-main" onClick={onClick}>
      <div className="source-icon"><Database size={20}/></div>
      <div><b>{name}</b><span>{desc}</span></div>
      <em>{active?<><CheckCircle2 size={14}/> FONTE SELECIONADA</>:'FONTE'}</em>
    </button>
  </div>
}

export default function PublicSources(){
  const[tab,setTab]=useState('cbvj'),[data,setData]=useState(null),[error,setError]=useState(''),[loading,setLoading]=useState(false),[retrievedAt,setRetrievedAt]=useState(null);
  const load=async(source,force=true)=>{
    setLoading(true);setError('');
    try{
      const apiSource=source==='detransSpatial'?'detrans-correlations':source;
      const response=await fetch(`${API_BASE}/public-sources/${apiSource}${force?'?refresh=1':''}`,{cache:'no-store'});
      const json=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(json.error||`Falha na fonte ${sourceNames[source]||source}`);
      setData(json);setRetrievedAt(json.retrievedAt||new Date().toISOString());
    }catch(err){setData(null);setError(err.message||'Falha na consulta')}
    finally{setLoading(false)}
  };
  useEffect(()=>{load('cbvj')},[]);
  useEffect(()=>{if(tab!=='renaest'||data?.ingestionStatus!=='processing')return;const timer=setTimeout(()=>load('renaest',false),5000);return()=>clearTimeout(timer)},[tab,data?.ingestionStatus,data?.progress?.processed]);
  const select=s=>{setTab(s);load(s)};
  const print=()=>{
    if(!data)return;
    let headers=[],rows=[];
    if(tab==='cbvj'){headers=['Rank','Corredor','2024','2025','Variação'];rows=(data.corridors||[]).map(x=>[x.rank2025,x.road,x.value2024,x.value2025,x.variation2024to2025==null?'—':`${x.variation2024to2025}%`])}
    else if(tab==='detrans'){headers=['Rank','Corredor','Estudos'];rows=(data.corridors||[]).slice(0,50).map(x=>[x.rank,x.road,x.count])}
    else if(tab==='renaest'){headers=['Competência','Registros Joinville'];rows=[[`${String(data.latestAvailableMonth||'—').padStart(2,'0')}/2026`,data.joinvilleRecords]]}
    else if(tab==='simgeo'){headers=['Mês','2025','2026'];rows=Array.from({length:12},(_,i)=>[String(i+1).padStart(2,'0'),data.summary?.accidents2025Monthly?.[i]?.count??'—',data.summary?.accidents2026Monthly?.[i]?.count??'—'])}
    else if(tab==='health'){headers=['Recurso','Formato','Atualização'];rows=(data.resources||[]).map(x=>[x.name,x.format||'—',x.lastModified||'—'])}
    else if(tab==='detransSpatial'){headers=['Escola','Correspondência','Distância'];rows=(data.records||[]).map(x=>[x.school,x.correspondence,x.distanceMeters==null?'—':`${x.distanceMeters} m`])}
    printTable(`SIGES — Fonte ${sourceNames[tab]||tab}`,`Dados incorporados em ${retrievedAt?new Date(retrievedAt).toLocaleString('pt-BR'):'—'}`,headers,rows.map(r=>r.map(esc)));
  };
  return <section>
    <div className="section-head">
      <div><small>CENTRAL DE FONTES · DADOS INCORPORADOS</small><h2>Fontes e Dados Externos</h2><p>As fontes são consultadas pelo backend e os dados são apresentados dentro do SIGES. Não é necessário sair do sistema.</p></div>
      <div style={{display:'flex',gap:8}}><button className="primary" onClick={()=>load(tab)} disabled={loading}><RefreshCw size={15}/>{loading?'Consultando':'Atualizar fonte'}</button><button className="primary" onClick={print} disabled={!data}><Printer size={15}/>Imprimir</button></div>
    </div>
    {error&&<div className="source-alert"><AlertTriangle size={18}/><div><b>Fonte temporariamente indisponível</b><span>{error}</span></div></div>}
    <div className="source-grid">
      <SourceCard name="CBVJ" desc="Ocorrências e ranking de corredores" active={tab==='cbvj'} onClick={()=>select('cbvj')}/>
      <SourceCard name="DETRANS" desc="Estudos técnicos publicados" active={tab==='detrans'} onClick={()=>select('detrans')}/>
      <SourceCard name="DETRANS ↔ SIMGeo" desc="Correlação espacial" active={tab==='detransSpatial'} onClick={()=>select('detransSpatial')}/>
      <SourceCard name="SIMGEO" desc="Sinistros e camadas territoriais" active={tab==='simgeo'} onClick={()=>select('simgeo')}/>
      <SourceCard name="RENAEST 2026" desc="Competências e registros disponíveis" active={tab==='renaest'} onClick={()=>select('renaest')}/>
      <SourceCard name="SAÚDE 2026" desc="Hospitais e leitos públicos" active={tab==='health'} onClick={()=>select('health')}/>
    </div>

    {data&&tab==='cbvj'&&<div className="panel"><div className="section-head"><div><small>CBVJ · DADO INCORPORADO</small><h3>Corredores 2025</h3></div></div><div className="source-meta"><div><small>STATUS</small><strong>{fmt(data.sourceStatus||'online').toUpperCase()}</strong></div><div><small>LEITURA</small><strong>{retrievedAt?new Date(retrievedAt).toLocaleString('pt-BR'):'—'}</strong></div><div><small>OCORRÊNCIAS 2025</small><strong>{fmt(data.summary?.totalOccurrences2025)}</strong></div></div><div className="table-wrap"><table><thead><tr><th>Rank</th><th>Corredor</th><th>2024</th><th>2025</th><th>Variação</th></tr></thead><tbody>{(data.corridors||[]).map(x=><tr key={x.rank2025+'-'+x.road}><td>{x.rank2025}</td><td><b>{x.road}</b></td><td>{fmt(x.value2024)}</td><td>{fmt(x.value2025)}</td><td>{x.variation2024to2025==null?'—':`${x.variation2024to2025}%`}</td></tr>)}</tbody></table></div></div>}

    {data&&tab==='detrans'&&<div className="panel"><div className="section-head"><div><small>DETRANS · DADO INCORPORADO</small><h3>Estudos por corredor</h3></div></div><div className="table-wrap"><table><thead><tr><th>Rank</th><th>Corredor</th><th>Estudos</th></tr></thead><tbody>{(data.corridors||[]).slice(0,50).map(x=><tr key={x.rank+'-'+x.road}><td>{x.rank}</td><td>{x.road}</td><td>{x.count}</td></tr>)}</tbody></table></div></div>}

    {data&&tab==='detransSpatial'&&<div className="panel"><div className="section-head"><div><small>DETRANS ↔ SIMGeo</small><h3>Correspondência espacial</h3><p>Os resultados são calculados e apresentados no próprio SIGES.</p></div><LocateFixed size={22}/></div><div className="source-meta"><div><small>STATUS</small><strong>{fmt(data.sourceStatus||'online').toUpperCase()}</strong></div><div><small>ESTUDOS</small><strong>{fmt(data.summary?.detransStudies)}</strong></div><div><small>UNIDADES</small><strong>{fmt(data.summary?.simgeoSchoolUnits)}</strong></div></div><div className="table-wrap"><table><thead><tr><th>Escola</th><th>Correspondência</th><th>Distância</th><th>Estudo</th></tr></thead><tbody>{(data.records||[]).length?data.records.map(x=><tr key={x.schoolId||x.school}><td><b>{x.school}</b><br/><small>{x.address}</small></td><td>{x.correspondence}</td><td>{x.distanceMeters==null?'—':`${x.distanceMeters} m`}</td><td>{x.studyTitle||'—'}</td></tr>):<tr><td colSpan="4">Nenhuma correspondência individual confirmada.</td></tr>}</tbody></table></div></div>}

    {data&&tab==='renaest'&&<div className="panel"><div className="section-head"><div><small>RENAEST · DADOS EXTRAÍDOS DOS ZIPs</small><h3>Ingestão mensal para o SIGES</h3><p>O sistema baixa os arquivos ZIP oficiais, extrai CSV/TXT e procura registros de Joinville/SC. A contagem de linhas não é confundida com quantidade de sinistros.</p></div></div><div className="source-meta"><div><small>STATUS DA EXTRAÇÃO</small><strong>{fmt(data.ingestionStatus||'—').toUpperCase()}</strong></div><div><small>ARQUIVOS PROCESSADOS</small><strong>{fmt(data.progress?.processed)}/{fmt(data.progress?.total)}</strong></div><div><small>COMPETÊNCIAS 2025</small><strong>{fmt(data.annual?.[2025]?.monthsProcessed)}/12</strong></div><div><small>COMPETÊNCIAS 2026</small><strong>{fmt(data.annual?.[2026]?.monthsProcessed)}/{fmt(data.available2026Months?.length)}</strong></div></div>{data.ingestionStatus==='processing'&&<div className="source-note"><b>Extração em andamento.</b> Esta tela atualizará o progresso automaticamente. Não feche a página até a conclusão.</div>}<div className="cards"><div className="metric"><small>Linhas Joinville encontradas</small><strong>{fmt(data.joinvilleRecords)}</strong><span>registros extraídos nos ZIPs processados</span></div><div className="metric"><small>Meses 2025 disponíveis</small><strong>{fmt(data.available2025Months?.length)}</strong><span>arquivos no catálogo oficial</span></div><div className="metric"><small>Meses 2026 disponíveis</small><strong>{fmt(data.available2026Months?.length)}</strong><span>competências publicadas</span></div><div className="metric"><small>Falhas de download/extração</small><strong>{fmt(data.errors?.length||0)}</strong><span>arquivos que precisam de nova tentativa</span></div></div><div className="source-note"><b>Agregados extraídos por campo:</b> {Object.entries(data.annual?.[2025]?.aggregates||{}).map(([k,v])=>'2025 · '+k+': '+fmt(v)).concat(Object.entries(data.annual?.[2026]?.aggregates||{}).map(([k,v])=>'2026 · '+k+': '+fmt(v))).join(' · ')||'Ainda não foi identificado campo numérico agregado para Joinville nos arquivos processados. Consulte as colunas detectadas abaixo para ajustar o mapeamento.'}</div><div className="table-wrap"><table><thead><tr><th>Ano</th><th>Mês</th><th>Arquivo oficial</th><th>Linhas Joinville</th><th>Total de sinistros identificado</th><th>Situação</th></tr></thead><tbody>{(data.monthly||[]).map((x,i)=><tr key={x.year+'-'+x.month+'-'+i}><td>{x.year}</td><td>{String(x.month||'—').padStart(2,'0')}</td><td>{x.resourceName}</td><td>{fmt(x.joinvilleRecords)}</td><td>{fmt(x.totalSinistros)}</td><td>{x.status}</td></tr>)}</tbody></table></div>{(data.archives||[]).slice(-1).map(a=><div className="source-note" key={a.name}><b>Diagnóstico do último ZIP extraído: {a.name}</b><p>Arquivos internos: {fmt(a.fileCount)} · Campo de total: {a.totalField||'não identificado'} · Colunas: {(a.fields||[]).join(', ')||'nenhuma detectada'}</p><pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere',fontSize:11}}>{JSON.stringify(a.sample||[],null,2)}</pre></div>)}{(data.errors||[]).length>0&&<div className="source-alert"><AlertTriangle size={18}/><div><b>Arquivos com falha</b><span>{data.errors.map(x=>x.name+': '+x.error).join(' · ')}</span></div></div>}</div>}

    {data&&tab==='health'&&<div className="panel"><div className="section-head"><div><small>SAÚDE · SUS 2026 · DADO INCORPORADO</small><h3>Infraestrutura hospitalar</h3><p>O SIGES apresenta o inventário público sem identificar cidadãos.</p></div></div><div className="source-meta"><div><small>STATUS</small><strong>{fmt(data.sourceStatus||'online').toUpperCase()}</strong></div><div><small>RECURSOS</small><strong>{fmt(data.resourceCount)}</strong></div><div><small>ÚLTIMO RECURSO</small><strong>{data.latestResource?.name||'—'}</strong></div></div><div className="table-wrap"><table><thead><tr><th>Recurso</th><th>Formato</th><th>Atualização</th></tr></thead><tbody>{(data.resources||[]).map(x=><tr key={x.id||x.name}><td>{x.name}</td><td>{x.format||'—'}</td><td>{x.lastModified||'—'}</td></tr>)}</tbody></table></div></div>}

    {data&&tab==='simgeo'&&<div className="panel"><div className="section-head"><div><small>SIMGEO · DADOS INCORPORADOS</small><h3>Sinistros e território</h3><p>As contagens abaixo são trazidas para o SIGES pelo backend, sem abrir o portal externo.</p></div></div><div className="source-meta"><div><small>STATUS</small><strong>{fmt(data.sourceStatus||'online').toUpperCase()}</strong></div><div><small>CONSULTAS</small><strong>{fmt(data.queryHealth?.succeeded)}/{fmt(data.queryHealth?.requested)}</strong></div><div><small>LEITURA</small><strong>{retrievedAt?new Date(retrievedAt).toLocaleString('pt-BR'):'—'}</strong></div></div><div className="cards"><div className="metric"><small>Unidades escolares</small><strong>{fmt(data.summary?.schoolUnitsCount)}</strong><span>camada pública</span></div><div className="metric"><small>Sinistros 2025</small><strong>{fmt(data.summary?.accidents2025Count)}</strong><span>com vítimas</span></div><div className="metric"><small>Sinistros 2026</small><strong>{fmt(data.summary?.accidents2026Count)}</strong><span>competências disponíveis</span></div><div className="metric"><small>Corredores 2026</small><strong>{fmt(data.corridors2026?.length)}</strong><span>logradouros agrupados</span></div></div><div className="table-wrap" style={{marginTop:16}}><table><thead><tr><th>Mês</th><th>2025</th><th>2026</th></tr></thead><tbody>{Array.from({length:12},(_,i)=><tr key={i}><td>{String(i+1).padStart(2,'0')}</td><td>{fmt(data.summary?.accidents2025Monthly?.[i]?.count)}</td><td>{fmt(data.summary?.accidents2026Monthly?.[i]?.count)}</td></tr>)}</tbody></table></div><div className="table-wrap" style={{marginTop:16}}><table><thead><tr><th>Corredor</th><th>2025</th><th>2026</th></tr></thead><tbody>{(data.corridors2026||data.corridors2025||[]).slice(0,30).map(x=><tr key={x.road}><td>{x.road}</td><td>{fmt((data.corridors2025||[]).find(y=>y.road===x.road)?.count)}</td><td>{fmt(x.count)}</td></tr>)}</tbody></table></div></div>}

    <div className="source-note"><span><b>Rastreabilidade:</b> fonte, competência, data da leitura e método permanecem registrados no SIGES. “—” significa ausência de dado, não zero.</span></div>
  </section>
}
