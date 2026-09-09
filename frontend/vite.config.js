import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

function normalizePublicSourcesImport(){
  return {
    name:'normalize-siges-public-sources-import',
    enforce:'pre',
    transform(code,id){
      if(!id.endsWith('/frontend/src/siges-main.jsx')) return null;
      const statement="import PublicSources from './PublicSources';";
      const normalized=code.replace(/(?:import PublicSources from '\.\/PublicSources';\s*)+/g,statement+'\n');
      return normalized===code?null:{code:normalized,map:null};
    }
  };
}

function releaseLogin(){
  return {
    name:'siges-release-login',
    enforce:'post',
    transform(code,id){
      if(!id.endsWith('/frontend/src/siges-main.jsx')) return null;
      let next=code;
      next=next.replace("function Gate(){const[p,setP]=useState(''),[e,setE]=useState('');", "function Gate(){const[u,setU]=useState(''),[p,setP]=useState(''),[e,setE]=useState('');");
      next=next.replace("const enter=()=>{if(p!==", "const enter=()=>{if(!u.trim())return setE('Informe o login.');if(p!==");
      next=next.replace('<label>Senha de acesso<input', '<label>Login<input autoFocus value={u} onChange={x=>{setU(x.target.value);setE(\'\')}} onKeyDown={x=>x.key===\'Enter\'&&enter()}/></label><label>Senha de acesso<input');
      next=next.replace('autoFocus type="password" value={p}', 'type="password" value={p}');
      return next===code?null:{code:next,map:null};
    }
  };
}

function releaseGuideReport(){
  return {
    name:'siges-aluno-guia-school-report',
    enforce:'pre',
    transform(code,id){
      if(!id.endsWith('/frontend/src/siges-main.jsx')) return null;
      const re=/function Guide\(\{data\}\)\{[\\s\\S]*?\nfunction Reports/;
      const replacement=`function Guide({data}){const rows=data.matrix.filter(x=>['P1','P2'].includes(pri(x.Prioridade)));const report=(x)=>{const evid=relatedEvidence(data,x);const corr=clean(x['Corredor normalizado']||x.Corredor||'');const crashes=data.sinistros.filter(c=>{const v=clean(c.Via||c.Corredor||'');return corr&&v&&(v.includes(corr)||corr.includes(v))});const p=pri(x.Prioridade),h=num(x['HSI-DOTH-P']),ipe=num(x['IPE Territorial 3.2']),det=txt(x['Estudos DETRANS']),a25=num(x['Acidentes corredor 2025']);const rationale=p==='P1'?'A escola apresenta prioridade territorial crítica, recomendando atuação preventiva e acompanhamento mais próximo no entorno escolar.':'A escola apresenta prioridade territorial muito alta, indicando necessidade de reforço preventivo e de educação para segurança no entorno.';const body='<h2>1. Identificação</h2><table><tr><th>Escola</th><td>'+esc(x.Unidade)+'</td></tr><tr><th>Tipo</th><td>'+esc(txt(x.Tipo))+'</td></tr><tr><th>Bairro</th><td>'+esc(txt(x.Bairro))+'</td></tr><tr><th>Endereço</th><td>'+esc(txt(x.Endereço))+'</td></tr><tr><th>Corredor</th><td>'+esc(txt(x['Corredor normalizado']||x.Corredor))+'</td></tr></table><h2>2. Justificativa territorial para o Aluno Guia</h2><p>'+rationale+' O programa Aluno Guia é tratado aqui como uma medida de educação, orientação e prevenção, sem substituir agentes públicos, sinalização, fiscalização ou engenharia de tráfego.</p><h2>3. Indicadores que sustentam a priorização</h2><div class="grid"><div class="card"><div class="label">Prioridade</div><div class="value">'+esc(p)+'</div></div><div class="card"><div class="label">HSI-DOTH-P</div><div class="value">'+h+'</div></div><div class="card"><div class="label">IPE Territorial</div><div class="value">'+ipe.toFixed(1)+'</div></div><div class="card"><div class="label">Acidentes no corredor 2025</div><div class="value">'+a25+'</div></div></div><table><tr><th>Indicador/Fonte</th><th>Leitura</th></tr><tr><td>DETRANS</td><td>'+esc(det)+'</td></tr><tr><td>Sinistros/corredor</td><td>'+esc(txt(x['Acidentes corredor 2024']))+' em 2024 e '+esc(txt(x['Acidentes corredor 2025']))+' em 2025.</td></tr><tr><td>HSI-DOTH-P</td><td>Índice escolar-territorial utilizado pelo SIGES para organizar a prioridade.</td></tr><tr><td>IPE 3.2</td><td>Índice de exposição territorial utilizado na classificação da escola.</td></tr></table><h2>4. Evidências relacionadas</h2><p>'+evid.length+' evidência(s) vinculada(s) por escola, bairro, endereço ou corredor.</p><table><tr><th>Tipo</th><th>Ponto</th><th>Resultado</th><th>Ano</th><th>Fonte</th></tr>'+evid.map(e=>{const u=sourceLink(e['Fonte oficial']);return '<tr><td>'+esc(txt(e.Tipo))+'</td><td>'+esc(txt(e.Ponto))+'</td><td>'+esc(txt(e['Valor/resultado']))+'</td><td>'+esc(txt(e['Data/ano']))+'</td><td>'+(u?'<a href="'+u+'">'+esc(txt(e['Fonte oficial']))+'</a>':esc(txt(e['Fonte oficial'])))+'</td></tr>'}).join('')+'</table><h2>5. Sinistros e exposição do corredor</h2><table><tr><th>Via</th><th>2024</th><th>2025</th><th>Variação</th></tr>'+crashes.map(c=>'<tr><td>'+esc(txt(c.Via))+'</td><td>'+esc(txt(c['Acidentes 2024']))+'</td><td>'+esc(txt(c['Acidentes 2025']))+'</td><td>'+esc(txt(c['Variação 2024-2025']))+'</td></tr>').join('')+'</table><h2>6. Atuação recomendada</h2><ol><li>Orientação dos alunos sobre travessia, percepção de risco e comportamento seguro.</li><li>Identificação de pontos de conflito no percurso casa-escola.</li><li>Comunicação preventiva entre alunos, escola e comunidade.</li><li>Registro e encaminhamento de situações que exijam avaliação institucional ou do poder público.</li><li>Reavaliação periódica dos indicadores para verificar se a prioridade territorial mudou.</li></ol><h2>7. Conclusão</h2><p>Com base nos indicadores territoriais disponíveis no SIGES, esta escola está priorizada para o Programa Aluno Guia em razão da combinação entre '+esc(p)+', IPE '+ipe.toFixed(1)+', HSI-DOTH-P '+h+' e exposição de corredor. Esta conclusão é uma justificativa técnica de priorização do SIGES/ENAT e deve ser validada pela instituição responsável antes de qualquer implantação.</p>';printReport('SIGES — Justificativa do Aluno Guia — '+x.Unidade,txt(x.Tipo)+' · '+txt(x.Bairro)+' · '+p,body)};const printAll=()=>printReport('SIGES — Aluno Guia — Justificativas das escolas prioritárias',rows.length+' escolas P1/P2', '<h2>Finalidade</h2><p>Relatório consolidado das escolas priorizadas para análise do Programa Aluno Guia.</p><table><tr><th>Escola</th><th>Bairro</th><th>Prioridade</th><th>HSI</th><th>IPE</th><th>Acidentes 2025</th></tr>'+rows.map(x=>'<tr><td>'+esc(x.Unidade)+'</td><td>'+esc(x.Bairro)+'</td><td>'+esc(pri(x.Prioridade))+'</td><td>'+num(x['HSI-DOTH-P'])+'</td><td>'+num(x['IPE Territorial 3.2']).toFixed(1)+'</td><td>'+esc(txt(x['Acidentes corredor 2025']))+'</td></tr>').join('')+'</table>');return <section><div className="section-head"><div><small>PROGRAMA ALUNO GUIA</small><h2>Atuação recomendada</h2><p>Cada escola P1/P2 agora possui uma justificativa técnica individual, com opção de impressão/PDF.</p></div><span>{rows.length}</span></div><Toolbar onPrint={printAll}/><div className="panel">{rows.map(x=><div className="row" key={x.Rank}><div><b>{x.Unidade}</b><span>{x.Bairro} · IPE {num(x['IPE Territorial 3.2']).toFixed(1)} · DETRANS {txt(x['Estudos DETRANS'])} · acidentes 2025 {txt(x['Acidentes corredor 2025'])}</span></div><div style={{display:'flex',gap:8,alignItems:'center'}}><em className={pri(x.Prioridade).toLowerCase()}>{pri(x.Prioridade)}</em><button onClick={()=>report(x)}><Printer size={14}/> Relatório da escola</button></div></div>)}</div></section>}
function Reports`;
      const next=code.replace(re,replacement);
      return next===code?null:{code:next,map:null};
    }
  };
}

export default defineConfig({
  plugins:[normalizePublicSourcesImport(),releaseGuideReport(),releaseLogin(),react()],
  base: process.env.GITHUB_ACTIONS ? '/SIGES-Escola-Segura/' : '/',
  build:{outDir:'dist'}
});
