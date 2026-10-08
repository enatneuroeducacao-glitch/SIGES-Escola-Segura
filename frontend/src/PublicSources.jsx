import React, { useEffect, useState } from 'react';
import { Database, RefreshCw, CheckCircle2, AlertTriangle, LocateFixed, Printer } from 'lucide-react';
import './public-sources.css';

const fmt = (value) => value == null ? '—' : typeof value === 'number' ? value.toLocaleString('pt-BR') : String(value);
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

function printTable(title, subtitle, headers, rows) {
  const win = window.open('', '_blank', 'width=1100,height=800');
  if (!win) { alert('Permita pop-ups para imprimir.'); return; }
  win.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(title)}</title><style>body{font:13px Arial,sans-serif;color:#182b39;margin:30px}h1{font-size:23px;margin-bottom:6px}p{color:#667782;font-size:11px}table{width:100%;border-collapse:collapse;font-size:10px}th,td{border:1px solid #ccd5da;padding:6px;text-align:left;vertical-align:top}th{background:#f0f3f5}a{color:#145f72}</style></head><body><h1>${esc(title)}</h1><p>${esc(subtitle)}</p><table><thead><tr>${headers.map((header) => `<th>${esc(header)}</th>`).join('')}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join('')}</tr>`).join('')}</tbody></table><script>window.onload=()=>setTimeout(()=>window.print(),300)</script></body></html>`);
  win.document.close();
}

const API_BASE = (import.meta.env.VITE_API_BASE || 'https://escola-segura-api-r51o.onrender.com/api').replace(/\/$/, '');

function SourceCard({ name, desc, active, onClick }) {
  return <div className={`source-card ${active ? 'active' : 'planned'}`}>
    <button type="button" className="source-card-main" onClick={onClick}>
      <div className="source-icon"><Database size={20} /></div>
      <div><b>{name}</b><span>{desc}</span></div>
      <em>{active ? <><CheckCircle2 size={14} /> DADO INCORPORADO</> : 'FONTE'}</em>
    </button>
  </div>;
}

export default function PublicSources() {
  const [tab, setTab] = useState('cbvj');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [retrievedAt, setRetrievedAt] = useState(null);

  const load = async (source) => {
    setLoading(true); setError('');
    try {
      const apiSource = source === 'detransSpatial' ? 'detrans-correlations' : source;
      const response = await fetch(`${API_BASE}/public-sources/${apiSource}?refresh=1`, { cache: 'no-store' });
      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) throw new Error('A API de fontes públicas não retornou JSON. Verifique a conexão com a API do SIGES.');
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || 'Falha na fonte pública');
      setData(json); setRetrievedAt(json.retrievedAt||new Date().toISOString());
    } catch (err) { setData(null); setError(err.message || 'Falha na consulta'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load('cbvj'); }, []);
  const select = (source) => { setTab(source); load(source); };

  const print = () => {
    if (!data) return;
    let headers; let rows;
    if (tab === 'cbvj') {
      headers = ['Rank', 'Corredor', '2024', '2025', 'Variação'];
      rows = (data.corridors || []).map((item) => [item.rank2025, item.road, item.value2024, item.value2025, item.variation2024to2025 == null ? '—' : `${item.variation2024to2025}%`]);
    } else if (tab === 'detrans') {
      headers = ['Rank', 'Corredor', 'Estudos'];
      rows = (data.corridors || []).slice(0, 50).map((item) => [item.rank, item.road, item.count]);
    } else if (tab === 'detransSpatial') {
      headers = ['Escola', 'Correspondência', 'Distância', 'Estudo'];
      rows = (data.records || []).map((item) => [item.school, item.correspondence, item.distanceMeters == null ? '—' : `${item.distanceMeters} m`, item.studyTitle || '—']);
    } else if(tab === 'renaest') {
      headers=['Competência','Recurso','Atualização']; rows=(data.resources||[]).map(x=>[x.name,x.format||'—',x.lastModified||'—']);
    } else if(tab === 'health') {
      headers=['Recurso','Formato','Atualização']; rows=(data.resources||[]).map(x=>[x.name,x.format||'—',x.lastModified||'—']);
    } else {
      headers = ['Indicador', 'Valor'];
      rows = [['Unidades escolares', data.summary?.schoolUnits], ['Camadas de planejamento', data.summary?.planningLayers]];
    }
    printTable(`SIGES — Fonte ${tab.toUpperCase()}`, `Consulta pública · ${data.retrievedAt ? new Date(data.retrievedAt).toLocaleString('pt-BR') : 'data não informada'}`, headers, rows.map((row) => row.map(esc)));
  };

  return <section>
    <div className="section-head">
      <div><small>CENTRAL DE FONTES · DADOS PÚBLICOS</small><h2>Fontes e Dados Externos</h2><p>Leitura somente consulta; fontes originais não são alteradas pelo SIGES.</p></div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="primary" type="button" onClick={() => load(tab)} disabled={loading}><RefreshCw size={15} /> {loading ? 'Consultando' : 'Atualizar fonte'}</button>
        <button className="primary" type="button" onClick={print} disabled={!data}><Printer size={15} /> Imprimir</button>
      </div>
    </div>

    {error && <div className="source-alert"><AlertTriangle size={18} /><div><b>Fonte temporariamente indisponível</b><span>{error}</span></div></div>}

    <div className="source-grid">
      <SourceCard name="CBVJ" desc="Ocorrências e ranking de corredores" active={tab === 'cbvj'} onClick={() => select('cbvj')} />
      <SourceCard name="DETRANS" desc="Estudos técnicos publicados" active={tab === 'detrans'} onClick={() => select('detrans')} />
      <SourceCard name="DETRANS ↔ SIMGeo" desc="Correlação espacial conservadora" active={tab === 'detransSpatial'} onClick={() => select('detransSpatial')} />
      <SourceCard name="SIMGEO" desc="Camadas geográficas públicas" active={tab === 'simgeo'} onClick={() => select('simgeo')} />
      <SourceCard name="RENAEST 2026" desc="Sinistros nacionais por competência" active={tab === 'renaest'} onClick={() => select('renaest')} />
      <SourceCard name="SAÚDE 2026" desc="Hospitais e leitos do SUS" active={tab === 'health'} onClick={() => select('health')} />
    </div>

    {data && tab === 'cbvj' && <div className="panel"><div className="section-head"><div><small>CBVJ</small><h3>Corredores com maior número de acidentes</h3></div><div><div className="source-meta"><div><small>STATUS</small><strong>{fmt(data.sourceStatus||'online').toUpperCase()}</strong></div><div><small>ÚLTIMA LEITURA</small><strong>{retrievedAt?new Date(retrievedAt).toLocaleString('pt-BR'):'—'}</strong></div><div><small>ANO</small><strong>{fmt(data.latestCompleteYear)}</strong></div><div><small>OCORRÊNCIAS 2025</small><strong>{fmt(data.summary?.totalOccurrences2025)}</strong></div></div><div className="table-wrap"><table><thead><tr><th>Rank</th><th>Corredor</th><th>2024</th><th>2025</th><th>Variação</th></tr></thead><tbody>{(data.corridors || []).map((item) => <tr key={`${item.rank2025}-${item.road}`}><td>{item.rank2025}</td><td><b>{item.road}</b></td><td>{fmt(item.value2024)}</td><td>{fmt(item.value2025)}</td><td>{item.variation2024to2025 == null ? '—' : `${item.variation2024to2025}%`}</td></tr>)}</tbody></table></div></div>}

    {data && tab === 'detrans' && <div className="panel"><div className="section-head"><div><small>DETRANS</small><h3>Estudos por corredor</h3></div><div><div className="table-wrap"><table><thead><tr><th>Rank</th><th>Corredor</th><th>Estudos</th></tr></thead><tbody>{(data.corridors || []).slice(0, 50).map((item) => <tr key={`${item.rank}-${item.road}`}><td>{item.rank}</td><td>{item.road}</td><td>{item.count}</td></tr>)}</tbody></table></div></div>}

    {data && tab === 'detransSpatial' && <div className="panel"><div className="section-head"><div><small>DETRANS ↔ SIMGeo</small><h3>Correspondência espacial</h3><p>Conector ativo. A classificação escola-estudo só é preenchida quando houver geometria confiável.</p></div><LocateFixed size={22} /></div><div className="source-meta"><div><small>STATUS</small><strong>{fmt(data.sourceStatus||'online').toUpperCase()}</strong></div><div><small>ÚLTIMA LEITURA</small><strong>{retrievedAt?new Date(retrievedAt).toLocaleString('pt-BR'):'—'}</strong></div><div><small>ESTUDOS DETRANS</small><strong>{fmt(data.summary?.detransStudies)}</strong></div><div><small>UNIDADES SIMGEO</small><strong>{fmt(data.summary?.simgeoSchoolUnits)}</strong></div></div><div className="source-note"><b>{data.note}</b></div><div className="table-wrap"><table><thead><tr><th>Escola</th><th>Correspondência</th><th>Distância</th><th>Estudo associado</th></tr></thead><tbody>{(data.records || []).length ? data.records.map((item) => <tr key={item.schoolId || item.school}><td><b>{item.school}</b><br /><small>{item.address}</small></td><td>{item.correspondence}</td><td>{item.distanceMeters == null ? '—' : `${item.distanceMeters} m`}</td><td>{item.studyTitle && item.studyUrl ? <a href={item.studyUrl} target="_blank" rel="noreferrer">{item.studyTitle} <ExternalLink size={11} /></a> : '—'}</td></tr>) : <tr><td colSpan="4">Conector ativo; nenhuma correspondência individual foi afirmada sem geometria confiável.</td></tr>}</tbody></table></div></div>}

    {data && tab === 'renaest' && <div className="panel"><div className="section-head"><div><small>RENAEST · TRÂNSITO 2026</small><h3>Dados incorporados ao SIGES</h3><p>O SIGES consulta a competência publicada e traz os registros disponíveis para dentro da aplicação.</p></div></div><div className="source-meta"><div><small>STATUS</small><strong>{fmt(data.sourceStatus||'online').toUpperCase()}</strong></div><div><small>ÚLTIMA LEITURA</small><strong>{retrievedAt?new Date(retrievedAt).toLocaleString('pt-BR'):'—'}</strong></div><div><small>MESES 2026</small><strong>{fmt(data.available2026Months?.length)}</strong></div><div><small>ÚLTIMA COMPETÊNCIA</small><strong>{data.latestAvailableMonth?String(data.latestAvailableMonth).padStart(2,'0')+'/2026':'—'}</strong></div></div><div className="cards"><div className="metric"><small>Registros Joinville</small><strong>{fmt(data.joinvilleRecords)}</strong><span>competência mais recente</span></div><div className="metric"><small>Ingestão</small><strong>{data.ingestion==='datastore'?'ATIVA':'CATÁLOGO'}</strong><span>{data.ingestion==='datastore'?'dados lidos pelo SIGES':'aguardando exposição analítica'}</span></div><div className="metric"><small>Campos municipais</small><strong>{data.detectedFields?.municipality?'OK':'—'}</strong><span>{data.detectedFields?.municipality||'não identificado'}</span></div></div><div className="source-note"><b>Joinville/SC:</b> {Object.entries(data.joinvilleAggregates||{}).slice(0,8).map(([k,v])=>`${k}: ${fmt(v)}`).join(' · ')||'Nenhum agregado numérico exposto no recurso atual.'}</div></div>}

    {data && tab === 'health' && <div className="panel"><div className="section-head"><div><small>SAÚDE · SUS 2026</small><h3>Infraestrutura hospitalar disponível</h3><p>Dados públicos consultados pelo SIGES e exibidos internamente.</p></div></div><div className="source-meta"><div><small>STATUS</small><strong>{fmt(data.sourceStatus||'online').toUpperCase()}</strong></div><div><small>ÚLTIMA LEITURA</small><strong>{retrievedAt?new Date(retrievedAt).toLocaleString('pt-BR'):'—'}</strong></div><div><small>RECURSOS 2026</small><strong>{fmt(data.resourceCount)}</strong></div><div><small>ÚLTIMO RECURSO</small><strong>{data.latestResource?.name||'—'}</strong></div></div><div className="source-note"><b>Privacidade:</b> o SIGES utiliza somente dados agregados/publicados e não cruza registros individuais de saúde com alunos.</div><div className="table-wrap"><table><thead><tr><th>Recurso</th><th>Formato</th><th>Atualização</th></tr></thead><tbody>{(data.resources||[]).map(x=><tr key={x.id||x.name}><td>{x.url?<a href={x.url} target="_blank" rel="noreferrer">{x.name} <ExternalLink size={11}/></a>:x.name}</td><td>{x.format||'—'}</td><td>{x.lastModified||'—'}</td></tr>)}</tbody></table></div></div>}

    {data && tab === 'simgeo' && <div className="panel"><div className="section-head"><div><small>SIMGEO</small><h3>Inventário geográfico incorporado</h3></div><div><div className="source-meta"><div><small>STATUS</small><strong>{fmt(data.sourceStatus||'online').toUpperCase()}</strong></div><div><small>ÚLTIMA LEITURA</small><strong>{retrievedAt?new Date(retrievedAt).toLocaleString('pt-BR'):'—'}</strong></div><div><small>CONSULTAS</small><strong>{fmt(data.queryHealth?.succeeded)}/{fmt(data.queryHealth?.requested)}</strong></div></div><div className="cards"><div className="metric"><small>Unidades escolares</small><strong>{fmt(data.summary?.schoolUnitsCount)}</strong><span>camada pública</span></div><div className="metric"><small>Sinistros 2025</small><strong>{fmt(data.summary?.accidents2025Count)}</strong><span>com vítimas</span></div><div className="metric"><small>Sinistros 2026</small><strong>{fmt(data.summary?.accidents2026Count)}</strong><span>até a competência disponível</span></div><div className="metric"><small>Corredores 2026</small><strong>{fmt(data.corridors2026?.length)}</strong><span>logradouros agrupados</span></div></div><div className="table-wrap" style={{marginTop:16}}><table><thead><tr><th>Mês</th><th>Sinistros com vítimas</th></tr></thead><tbody>{(data.summary?.accidents2025Monthly||[]).map(item=><tr key={item.month}><td>{String(item.month).padStart(2,'0')}/2025</td><td>{fmt(item.count)}</td></tr>)}</tbody></table></div><div className="table-wrap" style={{marginTop:16}}><table><thead><tr><th>Mês</th><th>Sinistros 2026</th></tr></thead><tbody>{(data.summary?.accidents2026Monthly||[]).map(item=><tr key={item.month}><td>{String(item.month).padStart(2,'0')}/2026</td><td>{fmt(item.count)}</td></tr>)}</tbody></table></div></div>}

    <div className="source-note"><span><b>Rastreabilidade:</b> fonte, data da leitura, método e competência permanecem visíveis. “—” significa ausência de série comparável, não zero.</span></div>
  </section>;
}
