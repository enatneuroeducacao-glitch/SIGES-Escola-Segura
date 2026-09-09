import React,{useEffect,useState}from'react';
import{Database,RefreshCw,ExternalLink,CheckCircle2,AlertTriangle,Clock3}from'lucide-react';

export default function PublicSources(){
  const[data,setData]=useState(null),[loading,setLoading]=useState(true),[error,setError]=useState('');
  async function load(){setLoading(true);setError('');try{const r=await fetch('/api/public-sources/cbvj',{cache:'no-store'});const j=await r.json();if(!r.ok)throw new Error(j.error||'Falha na consulta');setData(j)}catch(e){setError(e.message)}finally{setLoading(false)}}
  useEffect(()=>{load()},[]);
  return <section>
    <div className="section-head"><div><small>CENTRAL DE FONTES · DADOS PÚBLICOS</small><h2>Fontes e Dados Externos</h2><p>Conectores somente leitura para enriquecer a inteligência territorial do SIGES sem alterar as fontes originais.</p></div><button className="primary" onClick={load} disabled={loading}><RefreshCw size={15}/> {loading?'Consultando':'Atualizar fonte'}</button></div>
    {error&&<div className="source-alert"><AlertTriangle size={18}/><div><b>Fonte temporariamente indisponível</b><span>{error}</span></div></div>}
    <div className="source-grid">
      <div className="source-card active"><div className="source-icon"><Database size={20}/></div><div><b>CBVJ</b><span>Corpo de Bombeiros Voluntários de Joinville</span></div><em><CheckCircle2 size={14}/> CONECTADO</em></div>
      <div className="source-card planned"><div className="source-icon"><Database size={20}/></div><div><b>DETRANS</b><span>Estudos e evidências territoriais</span></div><em>PRÓXIMO CONECTOR</em></div>
      <div className="source-card planned"><div className="source-icon"><Database size={20}/></div><div><b>SIMGEO</b><span>Camadas geográficas e território</span></div><em>PRÓXIMO CONECTOR</em></div>
    </div>
    {data&&<>
      <div className="source-meta"><div><small>ÚLTIMO ANO COMPLETO</small><strong>{data.latestCompleteYear}</strong></div><div><small>PUBLICAÇÃO</small><strong>{new Date(data.latestPublicationDate+'T12:00:00').toLocaleDateString('pt-BR')}</strong></div><div><small>OCORRÊNCIAS 2025</small><strong>{data.summary?.totalOccurrences2025?.toLocaleString('pt-BR')}</strong></div><div><small>LEITURA SIGES</small><strong>{new Date(data.retrievedAt).toLocaleString('pt-BR')}</strong></div></div>
      <div className="panel"><div className="section-head"><div><small>CBVJ · RANKING DE VIAS</small><h3>Corredores com maior número de acidentes</h3></div><a href={data.urls?.2025} target="_blank" rel="noreferrer">Abrir publicação <ExternalLink size={14}/></a></div>
        <div className="table-wrap"><table><thead><tr><th>Rank 2025</th><th>Corredor</th><th>2024 · publicação 2025</th><th>2025</th><th>Variação</th></tr></thead><tbody>{(data.corridors||[]).map(x=><tr key={x.road}><td>{x.rank2025}</td><td><b>{x.road}</b></td><td>{x.value2024??'—'}</td><td>{x.value2025??'—'}</td><td>{x.variation2024to2025==null?'—':`${x.variation2024to2025>0?'+':''}${x.variation2024to2025.toFixed(2)}%`}</td></tr>)}</tbody></table></div>
      </div>
      <div className="source-note"><Clock3 size={16}/><span><b>Rastreabilidade:</b> o SIGES guarda a fonte, publicação, data de leitura e metodologia. Diferenças entre publicações não são sobrescritas automaticamente; cada metodologia deve permanecer identificável.</span></div>
    </>}
  </section>
}
