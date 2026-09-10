"use client";
import {useEffect,useMemo,useState} from "react";
import Link from "next/link";
import {School,ShieldAlert,ClipboardCheck,Search,RefreshCw,Map,ArrowRight,Database,Users,Route,Building2} from "lucide-react";
import {supabase} from "@/lib/supabase";

type Unit={id:string;name:string;unit_type:string;neighborhood:string;address:string;rank:number;hsi:number;ipe:number;priority:string;confidence_score:number;technical_evidence_score:number;data_status:string};

const priorityClass=(p:string)=>p?.startsWith("P1")?"p1":p?.startsWith("P2")?"p2":p?.startsWith("P3")?"p3":"p4";

export default function Home(){
 const [units,setUnits]=useState<Unit[]>([]); const [q,setQ]=useState(""); const [loading,setLoading]=useState(true);
 async function load(){setLoading(true);const {data}=await supabase().from("units").select("*").order("rank",{ascending:true});setUnits(data||[]);setLoading(false)}
 useEffect(()=>{load()},[]);
 const filtered=useMemo(()=>units.filter(u=>`${u.name} ${u.neighborhood} ${u.address}`.toLowerCase().includes(q.toLowerCase())),[units,q]);
 const p1=units.filter(u=>u.priority?.startsWith("P1")).length,p2=units.filter(u=>u.priority?.startsWith("P2")).length,p3=units.filter(u=>u.priority?.startsWith("P3")).length,p4=units.filter(u=>u.priority?.startsWith("P4")).length;
 const tech=units.filter(u=>Number(u.technical_evidence_score)>=100).length;
 return <main className="min-h-screen p-4 md:p-8 max-w-[1600px] mx-auto">
  <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
   <div><div className="text-cyan-300 text-sm font-bold tracking-widest">ENAT • HSI • SIGES</div><h1 className="text-3xl md:text-4xl font-black mt-1">SIGES — Escola Segura</h1><p className="muted mt-1">Centro de inteligência escolar · HSI-DOTH-P Escolar 3.1</p></div>
   <button onClick={load} className="card px-4 py-3 flex gap-2 items-center justify-center"><RefreshCw size={17}/> Atualizar dados</button>
  </header>

  <section className="card p-4 md:p-5 mb-5">
   <div className="flex items-center gap-2 text-cyan-300 text-xs font-bold uppercase tracking-wider"><Database size={15}/> Navegação por contexto</div>
   <p className="muted text-sm mt-2">Comece por um indicador. Cada informação leva diretamente ao conjunto de dados que a explica.</p>
  </section>

  <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
   <Link href="/escolas" className="card p-4 md:p-5 hover:bg-[#102337] transition block"><School size={20} className="text-cyan-300"/><div className="text-3xl font-black mt-2">{units.length}</div><div className="font-semibold">Unidades</div><div className="muted text-xs mt-1">Abrir cadastro territorial <ArrowRight size={13} className="inline"/></div></Link>
   <Link href="/escolas?priority=P1" className="card p-4 md:p-5 hover:bg-[#102337] transition block"><ShieldAlert size={20}/><div className="text-3xl font-black mt-2">{p1}</div><div className="font-semibold">P1 críticas</div><div className="muted text-xs mt-1">Ver prioridades críticas <ArrowRight size={13} className="inline"/></div></Link>
   <Link href="/escolas?priority=P2" className="card p-4 md:p-5 hover:bg-[#102337] transition block"><ShieldAlert size={20}/><div className="text-3xl font-black mt-2">{p2}</div><div className="font-semibold">P2 muito altas</div><div className="muted text-xs mt-1">Ver prioridades altas <ArrowRight size={13} className="inline"/></div></Link>
   <Link href="/evidencias" className="card p-4 md:p-5 hover:bg-[#102337] transition block"><ClipboardCheck size={20} className="text-cyan-300"/><div className="text-3xl font-black mt-2">{tech}</div><div className="font-semibold">Evidência técnica</div><div className="muted text-xs mt-1">Abrir evidências <ArrowRight size={13} className="inline"/></div></Link>
  </section>

  <section className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
   {[['P1','Crítica',p1],['P2','Muito alta',p2],['P3','Alta',p3],['P4','Monitoramento',p4]].map(([code,label,value]:any)=><Link key={code} href={`/escolas?priority=${code}`} className={`card p-4 hover:bg-[#102337] transition flex items-center justify-between`}><div><span className={`pill ${priorityClass(code)}`}>{code}</span><div className="muted text-xs mt-2">{label}</div></div><strong className="text-2xl">{value}</strong></Link>)}
  </section>

  <section className="card p-4 mb-5"><div className="flex flex-col md:flex-row gap-3"><div className="flex-1 flex items-center gap-2 bg-[#07111f] rounded-xl px-3"><Search size={17}/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Encontrar uma escola, bairro ou endereço..." className="bg-transparent outline-none w-full py-3"/></div><Link href="/escolas" className="px-5 py-3 rounded-xl bg-[#18324a] hover:bg-[#21435f] font-semibold text-center">Ver todas as escolas</Link></div></section>

  <section className="grid lg:grid-cols-[1.45fr_.55fr] gap-5">
   <div className="card overflow-hidden">
    <div className="p-4 border-b border-[#1f3347] flex items-center justify-between"><div><h2 className="font-bold">Unidades prioritárias</h2><p className="muted text-xs mt-1">Clique em uma escola para abrir seu dossiê integrado.</p></div><Link href="/escolas" className="text-cyan-300 text-sm font-semibold">Explorar →</Link></div>
    <div className="overflow-auto"><table className="w-full text-sm"><thead><tr className="text-left muted border-b border-[#1f3347]"><th className="p-3">#</th><th className="p-3">Unidade</th><th className="p-3">Bairro</th><th className="p-3">HSI</th><th className="p-3">IPE</th><th className="p-3">Prioridade</th></tr></thead><tbody>{loading?<tr><td className="p-5" colSpan={6}>Carregando...</td></tr>:filtered.slice(0,12).map(u=><tr key={u.id} className="border-b border-[#132638] hover:bg-[#102337]"><td className="p-3">{u.rank}</td><td className="p-3"><Link href={`/escolas/${u.id}`} className="font-semibold hover:text-cyan-300">{u.name}<div className="muted text-xs">{u.unit_type}</div></Link></td><td className="p-3">{u.neighborhood}</td><td className="p-3 font-bold">{u.hsi}</td><td className="p-3 font-bold">{u.ipe}</td><td className="p-3"><span className={`pill ${priorityClass(u.priority)}`}>{u.priority}</span></td></tr>)}</tbody></table></div>
   </div>
   <div className="space-y-5">
    <Link href="/mapa" className="card p-5 min-h-[210px] block hover:bg-[#102337] transition"><div className="flex items-center gap-2 font-bold"><Map size={18} className="text-cyan-300"/> Mapa territorial</div><p className="muted text-sm mt-3">Acesse o território, unidades, corredores, estudos DETRANS e áreas de influência.</p><div className="mt-8 text-cyan-300 font-semibold">Abrir mapa →</div></Link>
    <div className="grid grid-cols-2 gap-3"><Link href="/aluno-guia" className="card p-4 hover:bg-[#102337]"><Users size={18} className="text-cyan-300"/><div className="font-semibold mt-2">Aluno Guia</div><div className="muted text-xs mt-1">Análises individuais</div></Link><Link href="/intervencoes" className="card p-4 hover:bg-[#102337]"><Building2 size={18} className="text-cyan-300"/><div className="font-semibold mt-2">Intervenções</div><div className="muted text-xs mt-1">Ações e acompanhamento</div></Link></div>
   </div>
  </section>

  <section className="mt-5 card p-4"><div className="flex items-center gap-2 font-bold"><Route size={17} className="text-cyan-300"/> Fluxo do SIGES</div><div className="grid grid-cols-1 sm:grid-cols-4 gap-2 mt-4 text-sm"><Link href="/escolas" className="p-3 rounded-xl bg-[#091624] hover:bg-[#102337]">1 · Unidade</Link><span className="p-3 rounded-xl bg-[#091624]">2 · Dossiê integrado</span><span className="p-3 rounded-xl bg-[#091624]">3 · Evidências e risco</span><span className="p-3 rounded-xl bg-[#091624]">4 · Intervenção</span></div></section>
 </main>
}
