import React,{useMemo,useState} from 'react';
import {ArrowLeft,CheckCircle2,ChevronRight,HeartHandshake,ShieldAlert,Users,Activity,LockKeyhole} from 'lucide-react';
import './hsi-bullying.css';

const dimensions=[
 {name:'Segurança percebida',value:66,desc:'Como os estudantes percebem proteção e respeito no cotidiano.'},
 {name:'Pertencimento',value:74,desc:'Vínculo, inclusão e sensação de fazer parte da comunidade escolar.'},
 {name:'Respeito',value:69,desc:'Percepção de tratamento respeitoso entre pares e adultos.'},
 {name:'Pressão dos pares',value:51,desc:'Sinal agregado de influência social que pode aumentar vulnerabilidades.'},
 {name:'Confiança para pedir ajuda',value:58,desc:'Percepção de acesso e confiança para buscar apoio.'}
];
const stages=[['BASELINE','Aplicação inicial'],['PERFIL','Leitura agregada'],['SINAIS','Prioridades'],['INTERVENÇÃO','Plano de resposta'],['REAVALIAÇÃO','Novo ciclo'],['EVOLUÇÃO','Antes × depois']];

function App(){
 const [stage,setStage]=useState(0);
 const [filter,setFilter]=useState('Todos');
 const avg=Math.round(dimensions.reduce((a,b)=>a+b.value,0)/dimensions.length);
 const signals=useMemo(()=>[
  {label:'Confiança para pedir ajuda',value:58,level:'ATENÇÃO',type:'Convivência'},
  {label:'Pressão dos pares',value:51,level:'ATENÇÃO',type:'Convivência'},
  {label:'Segurança percebida',value:66,level:'ACOMPANHAR',type:'HSI-DOTH-P'}
 ].filter(x=>filter==='Todos'||x.type===filter),[filter]);
 return <div className="hb-shell">
  <header className="hb-top"><button onClick={()=>location.href='/'} className="hb-back"><ArrowLeft size={17}/> Voltar ao SIGES</button><div className="hb-brand"><span>SIGES</span><small>Escola Segura</small></div><div className="hb-privacy"><LockKeyhole size={15}/> indicadores agregados</div></header>
  <main>
   <section className="hb-hero"><div><div className="eyebrow">HSI-DOTH-P · BULLYING E CONVIVÊNCIA</div><h1>Da percepção ao cuidado.</h1><p>Transforme evidências de convivência escolar em sinais compreensíveis, prioridades de intervenção e acompanhamento da evolução — sem transformar o instrumento em diagnóstico clínico.</p></div><div className="hb-score"><div className="score-ring"><strong>{avg}</strong><span>/100</span></div><small>Índice agregado de convivência</small></div></section>
   <section className="hb-flow">{stages.map((s,i)=><button key={s[0]} className={i===stage?'active':''} onClick={()=>setStage(i)}><span>{i+1}</span><b>{s[0]}</b><small>{s[1]}</small></button>)}</section>
   <section className="hb-panel"><div className="hb-panel-head"><div><div className="eyebrow">CICLO ATUAL</div><h2>{stages[stage][0]} <span>— {stages[stage][1]}</span></h2></div><div className="hb-cycle"><CheckCircle2 size={16}/> ciclo protegido e rastreável</div></div>
    {stage===0&&<div className="hb-intro"><div className="hb-icon"><HeartHandshake/></div><div><h3>Estabeleça uma linha de base</h3><p>O HSI-DOTH-P Bullying utiliza 30 questões exclusivamente voltadas à experiência de bullying e convivência. A aplicação inicial cria uma referência para acompanhar mudanças futuras.</p><div className="hb-note">A leitura é agregada e orientada à prevenção. O SIGES não classifica estudantes como “vítimas”, “agressores” ou pacientes.</div></div></div>}
    {stage===1&&<div className="hb-grid">{dimensions.map(d=><article className="hb-dim" key={d.name}><div><b>{d.name}</b><strong>{d.value}</strong></div><div className="bar"><i style={{width:`${d.value}%`}}/></div><p>{d.desc}</p></article>)}</div>}
    {stage>=2&&<div className="hb-signals"><div className="hb-filters">{['Todos','Convivência','HSI-DOTH-P'].map(f=><button className={filter===f?'sel':''} onClick={()=>setFilter(f)} key={f}>{f}</button>)}</div>{signals.map(s=><article className="hb-signal" key={s.label}><div className="sig-icon"><ShieldAlert size={18}/></div><div className="sig-main"><b>{s.label}</b><span>{s.type}</span></div><div className="sig-value">{s.value}<small>/100</small></div><div className="sig-level">{s.level}</div><ChevronRight size={18}/></article>)}<div className="hb-action"><div><div className="eyebrow">PRÓXIMA MELHOR AÇÃO</div><h3>Fortalecer os canais seguros de pedido de ajuda</h3><p>Combinar escuta protegida, orientação aos adultos responsáveis e nova medição após a intervenção.</p></div><button onClick={()=>setStage(Math.min(5,stage+1))}>Avançar no ciclo <ChevronRight size={17}/></button></div></div>}
   </section>
   <section className="hb-bottom"><div><Activity size={19}/><b>Evolução longitudinal</b><p>Compare ciclos, intervenções e evidências sem expor dados pessoais desnecessários.</p></div><div><Users size={19}/><b>Integração escolar</b><p>Os sinais podem orientar formação, convivência, gestão de riscos e planos de ação.</p></div><div><LockKeyhole size={19}/><b>Governança</b><p>Acesso por perfil, justificativas, histórico e trilha de auditoria.</p></div></section>
  </main><footer>ENAT · SIGES Escola Segura · HSI-DOTH-P Bullying · protótipo funcional de inteligência escolar</footer>
 </div>
}
export default App;
