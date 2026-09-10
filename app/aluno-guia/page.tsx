"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ClipboardCheck, FileText, RefreshCw, Search, ShieldAlert, UserRound } from "lucide-react";
import { supabase } from "@/lib/supabase";

type Guide = {
  id: string;
  unit_id: string;
  student_code: string;
  display_name: string;
  school_class: string | null;
  assessment_date: string | null;
  status: string;
  d: number | null;
  o: number | null;
  t: number | null;
  h: number | null;
  p: number | null;
  hsi_global: number | null;
  risk_level: string | null;
  risk_text: string | null;
  priority_need: string | null;
  recommendations: string | null;
  units?: { name: string; neighborhood: string | null } | null;
};

const levelClass: Record<string, string> = {
  "MUITO ALTO": "bg-red-950/70 text-red-200 border-red-800",
  ALTO: "bg-orange-950/70 text-orange-200 border-orange-800",
  MODERADO: "bg-yellow-950/70 text-yellow-200 border-yellow-800",
  BAIXO: "bg-emerald-950/70 text-emerald-200 border-emerald-800",
};

function score(v: number | null) {
  return v == null ? "—" : Number(v).toFixed(1);
}

export default function AlunoGuiaPage() {
  const [guides, setGuides] = useState<Guide[]>([]);
  const [q, setQ] = useState("");
  const [risk, setRisk] = useState("TODOS");
  const [selected, setSelected] = useState<Guide | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase()
      .from("student_guide_assessments")
      .select("*, units(name, neighborhood)")
      .order("assessment_date", { ascending: false });
    if (!error) setGuides((data as Guide[]) || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => guides.filter(g => {
    const hay = `${g.display_name} ${g.student_code} ${g.school_class || ""} ${g.units?.name || ""}`.toLowerCase();
    return (risk === "TODOS" || g.risk_level === risk) && hay.includes(q.toLowerCase());
  }), [guides, q, risk]);

  return (
    <main className="min-h-screen p-4 md:p-8 max-w-[1600px] mx-auto">
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <Link href="/" className="muted text-sm flex items-center gap-2 mb-3"><ArrowLeft size={15}/> Voltar ao SIGES</Link>
          <div className="text-cyan-300 text-sm font-bold tracking-widest">SIGES • ALUNO GUIA</div>
          <h1 className="text-3xl md:text-4xl font-black mt-1">Análise de Necessidade do Aluno Guia</h1>
          <p className="muted mt-1">Fonte estruturada para acompanhamento e tomada de decisão da gestão municipal.</p>
        </div>
        <button onClick={load} className="card px-4 py-3 flex gap-2 items-center justify-center"><RefreshCw size={17}/> Atualizar</button>
      </header>

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        {[
          [guides.length, "Avaliações"],
          [guides.filter(g => g.risk_level === "MUITO ALTO").length, "Muito alto"],
          [guides.filter(g => g.risk_level === "ALTO").length, "Alto"],
          [guides.filter(g => g.status === "VALIDADO").length, "Validadas"],
        ].map(([v, l]) => <div className="card p-4" key={l as string}><ClipboardCheck size={18} className="text-cyan-300"/><div className="text-2xl font-black mt-2">{v}</div><div className="muted text-sm">{l}</div></div>)}
      </section>

      <section className="card p-4 mb-5">
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="flex-1 flex items-center gap-2 bg-[#07111f] rounded-xl px-3"><Search size={17}/><input value={q} onChange={e => setQ(e.target.value)} placeholder="Pesquisar aluno, código, turma ou escola..." className="bg-transparent outline-none w-full py-3"/></div>
          <select value={risk} onChange={e => setRisk(e.target.value)} className="bg-[#07111f] rounded-xl px-3 py-3"><option>TODOS</option><option>BAIXO</option><option>MODERADO</option><option>ALTO</option><option>MUITO ALTO</option></select>
        </div>
      </section>

      <section className="grid lg:grid-cols-[1.15fr_.85fr] gap-5">
        <div className="card overflow-hidden">
          <div className="p-4 border-b border-[#1f3347]"><h2 className="font-bold">Registros de análise</h2><p className="muted text-xs mt-1">HSI-DOTH-P Escolar • dados mensurados e nível de necessidade</p></div>
          <div className="overflow-auto"><table className="w-full text-sm"><thead><tr className="text-left muted border-b border-[#1f3347]"><th className="p-3">Aluno/código</th><th className="p-3">Escola</th><th className="p-3">HSI</th><th className="p-3">Nível</th><th className="p-3">Data</th></tr></thead><tbody>{loading ? <tr><td className="p-5" colSpan={5}>Carregando...</td></tr> : filtered.map(g => <tr key={g.id} onClick={() => setSelected(g)} className="border-b border-[#132638] hover:bg-[#102337] cursor-pointer"><td className="p-3 font-semibold">{g.display_name}<div className="muted text-xs">{g.student_code} • {g.school_class || "sem turma"}</div></td><td className="p-3">{g.units?.name || "—"}</td><td className="p-3 font-bold">{score(g.hsi_global)}</td><td className="p-3"><span className={`inline-flex px-2 py-1 rounded-full border text-xs font-bold ${levelClass[g.risk_level || ""] || "border-slate-700 text-slate-300"}`}>{g.risk_level || "Pendente"}</span></td><td className="p-3">{g.assessment_date ? new Date(g.assessment_date).toLocaleDateString("pt-BR") : "—"}</td></tr>)}</tbody></table></div>
        </div>

        <div className="space-y-5">
          {!selected ? <div className="card p-6 min-h-[420px] flex flex-col items-center justify-center text-center"><UserRound size={34} className="text-cyan-300 mb-3"/><h2 className="font-bold text-lg">Selecione uma avaliação</h2><p className="muted text-sm mt-2 max-w-md">O painel exibirá os cinco escores D-O-T-H-P, o resultado global, o nível de risco/necessidade e a justificativa textual para a gestão.</p></div> : <>
            <div className="card p-5"><div className="flex items-start justify-between gap-3"><div><div className="text-cyan-300 text-xs font-bold tracking-widest">RELATÓRIO INDIVIDUAL</div><h2 className="text-xl font-black mt-1">{selected.display_name}</h2><p className="muted text-sm">{selected.student_code} • {selected.units?.name || "escola não informada"}</p></div><span className={`px-3 py-2 rounded-full border text-xs font-bold ${levelClass[selected.risk_level || ""] || "border-slate-700 text-slate-300"}`}>{selected.risk_level || "PENDENTE"}</span></div>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mt-5">{[["D",selected.d],["O",selected.o],["T",selected.t],["H",selected.h],["P",selected.p]].map(([k,v]) => <div className="rounded-xl bg-[#07111f] border border-[#20364a] p-3 text-center" key={k as string}><div className="muted text-xs">{k as string}</div><div className="text-xl font-black mt-1">{score(v as number | null)}</div></div>)}</div>
              <div className="mt-4 grid grid-cols-2 gap-3"><div className="rounded-xl bg-[#07111f] p-4"><div className="muted text-xs">HSI-DOTH-P global</div><div className="text-3xl font-black">{score(selected.hsi_global)}</div></div><div className="rounded-xl bg-[#07111f] p-4"><div className="muted text-xs">Status</div><div className="text-lg font-bold">{selected.status}</div></div></div>
            </div>
            <div className="card p-5"><div className="flex gap-2 items-center font-bold"><ShieldAlert size={18} className="text-cyan-300"/> Interpretação do nível de risco</div><p className="mt-3 text-sm leading-6">{selected.risk_text || "Não há texto de interpretação registrado para esta avaliação."}</p></div>
            <div className="card p-5"><div className="flex gap-2 items-center font-bold"><FileText size={18} className="text-cyan-300"/> Necessidade e recomendação</div><p className="mt-3 text-sm leading-6"><strong>Necessidade prioritária:</strong> {selected.priority_need || "Não informada."}</p><p className="mt-3 text-sm leading-6"><strong>Recomendação:</strong> {selected.recommendations || "Não informada."}</p></div>
            <div className="card p-5 text-xs muted">Uso institucional: relatório destinado a planejamento, acompanhamento e avaliação de políticas de segurança escolar. A interpretação não constitui diagnóstico clínico ou psicológico isolado.</div>
          </>}
        </div>
      </section>
    </main>
  );
}
