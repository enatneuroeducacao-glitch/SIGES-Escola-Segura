import React,{useEffect,useState}from'react';
import{createRoot}from'react-dom/client';
import{ShieldCheck,BookOpen,Map,Flag,Target,LogOut,School,Users,CheckCircle2,AlertTriangle,Send,Home,Trophy,Eye}from'lucide-react';
import'./styles.css';
const API=(import.meta.env.VITE_API_BASE||'/api').replace(/\/$/,'');
const api=async(path,opts={})=>{const token=localStorage.getItem('siges_portal_token');const r=await fetch(API+path,{...opts,headers:{'Content-Type':'application/json',...(opts.headers||{}),...(token?{Authorization:'Bearer '+token}:{})}});const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error||'Não foi possível concluir a operação.');return j;};
const studentMenu=[['home','Início',Home],['learn','Aprender',BookOpen],['territory','Meu Entorno',Map],['observe','Eu Identifico',Eye],['claim','Minha Reivindicação',Flag],['journey','Minha Jornada',Trophy]];
const schoolMenu=[['home','Dashboard',Home],['students','Alunos',Users],['learning','Aprendizagem',BookOpen],['claims','Reivindicações',Flag],['territory','Território',Map]];
function Auth({role,onDone}){
  const[mode,setMode]=useState('login');
  const[validationMethod,setValidationMethod]=useState('email');
  const[form,setForm]=useState({});
  const[schools,setSchools]=useState([]);
  const[schoolSearch,setSchoolSearch]=useState('');
  const[busy,setBusy]=useState(false);
  const[error,setError]=useState('');
  const[message,setMessage]=useState('');
  const[pendingEmail,setPendingEmail]=useState('');
  const[accessCode,setAccessCode]=useState('');

  useEffect(()=>{if(mode==='register')api('/public-schools').then(x=>setSchools(x.schools||[])).catch(()=>{})},[mode,role]);

  const filteredSchools=schools.filter(s=>{
    const q=schoolSearch.trim().toLocaleLowerCase('pt-BR');
    return !q||[s.name,s.bairro,s.address,s.municipality].join(' ').toLocaleLowerCase('pt-BR').includes(q);
  });

  const set=(k,v)=>setForm(f=>({...f,[k]:v}));

  const submit=async e=>{
    e.preventDefault();
    setError('');
    setMessage('');
    setAccessCode('');
    setBusy(true);
    try{
      if(mode==='login'){
        const x=await api('/login',{method:'POST',body:JSON.stringify({token:form.token,password:form.password})});
        localStorage.setItem('siges_portal_token',x.token);
        localStorage.setItem('siges_portal_user',JSON.stringify(x.user));
        onDone(x.user);
      }else{
        const profile=role==='aluno'
          ?{schoolId:form.schoolId,birthDate:form.birthDate,grade:form.grade,className:form.className,shift:form.shift,responsibleName:form.responsibleName,responsibleContact:form.responsibleContact}
          :{sigesSchoolId:form.sigesSchoolId,schoolName:form.schoolName,inep:form.inep,municipality:form.municipality,uf:form.uf,bairro:form.bairro,address:form.address};

        const x=await api('/register',{
          method:'POST',
          body:JSON.stringify({
            role,
            name:form.name,
            email:form.email,
            password:form.password,
            profile
          })
        });

        setAccessCode(x.accessToken||x.accessCode||'');
        setMessage(x.message||'Cadastro realizado.');
        setMode('login');
        setForm({token:x.accessToken||x.accessCode||'',password:form.password||''});
        setPendingEmail(x.emailVerificationSent?form.email||'':'');
      }
    }catch(e){
      setError(e.message);
      if(/e-mail|email|confirm/i.test(e.message))setPendingEmail(form.email||'');
    }finally{
      setBusy(false);
    }
  };

  const resend=async()=>{
    if(!pendingEmail)return;
    setBusy(true);
    try{
      const x=await api('/resend-verification',{method:'POST',body:JSON.stringify({email:pendingEmail})});
      if(x.sent){
        setError('');
        setMessage(x.message||'Nova confirmação enviada. Verifique seu e-mail.');
      }else{
        setMessage('');
        setError(x.message||'Não foi possível enviar a confirmação agora. Tente novamente mais tarde.');
      }
    }catch(e){setError(e.message)}
    finally{setBusy(false)}
  };

  const switchToSchoolValidation=async()=>{
    if(role!=='aluno'||!form.email||!form.password)return;
    setBusy(true);
    setError('');
    try{
      const x=await api('/use-school-validation',{method:'POST',body:JSON.stringify({email:form.email,password:form.password})});
      setAccessCode(x.accessCode||'');
      setMessage(x.message);
      setPendingEmail('');
    }catch(e){setError(e.message)}
    finally{setBusy(false)}
  };

  return <div className="portal-auth">
    <div className="portal-auth-card">
      <div className="portal-logo"><ShieldCheck size={30}/></div>
      <small>ENAT · ESCOLA SEGURA</small>
      <h1>{role==='aluno'?'Área do Aluno':'Portal da Escola'}</h1>
      <p>{mode==='login'?'Entre para continuar sua jornada.':'Crie seu acesso institucional.'}</p>

      <div className="auth-role-tabs">
        <button type="button" className={role==='aluno'?'on':''} onClick={()=>{window.location.href='/aluno'}}>🎓 Aluno</button>
        <button type="button" className={role==='escola'?'on':''} onClick={()=>{window.location.href='/escola'}}>🏫 Escola</button>
      </div>

      <div className="auth-tabs">
        <button type="button" className={mode==='login'?'on':''} onClick={()=>{setMode('login');setError('');setMessage('');setAccessCode('')}}>Entrar</button>
        <button type="button" className={mode==='register'?'on':''} onClick={()=>{setMode('register');setError('');setMessage('');setAccessCode('')}}>Cadastrar</button>
      </div>

      {error&&<div className="portal-error">{error}</div>}
      {message&&<div className="portal-ok">{message}</div>}

      {accessCode&&<div className="portal-panel" style={{margin:'12px 0',textAlign:'left'}}>
        <strong>🔐 Token de acesso</strong>
        <div style={{fontSize:22,fontWeight:900,letterSpacing:1,margin:'8px 0',wordBreak:'break-all'}}>{accessCode}</div>
        <p style={{margin:0}}>Guarde este token e a senha criada no cadastro. O token será usado para entrar na Área do Aluno.</p>
      </div>}

      {mode==='register'&&role==='aluno'&&<div className="portal-note" style={{textAlign:'left',marginBottom:10}}>
        O sistema gera um token individual de acesso. A validação pela escola será solicitada somente quando o cadastro for identificado como suspeito ou quando não houver e-mail para confirmação.
      </div>}

      <form onSubmit={submit}>
        {mode==='register'&&<>
          <input className={role==='aluno'?'student-name-field':''} required placeholder={role==='aluno'?'Nome completo do aluno':'Nome do responsável pela escola'} value={form.name||''} onChange={e=>set('name',e.target.value)}/>

          {role==='aluno'
            ? <div className="portal-student-grid">
                <div className="portal-school-search">
                  <input placeholder="🔎 Buscar sua escola no SIGES" value={schoolSearch} onChange={e=>setSchoolSearch(e.target.value)}/>
                  <small>{filteredSchools.length} escolas encontradas no SIGES</small>
                </div>
                <select required value={form.schoolId||''} onChange={e=>set('schoolId',e.target.value)}>
                  <option value="">Selecione sua escola</option>
                  {filteredSchools.map(s=><option key={s.id} value={s.id}>{s.name} — {s.bairro||s.municipality}/{s.uf}</option>)}
                </select>
                <label className="portal-field-label">Data de nascimento do aluno</label>
                <input required type="date" aria-label="Data de nascimento do aluno" value={form.birthDate||''} onChange={e=>set('birthDate',e.target.value)}/>
                <input required placeholder="Série / etapa" value={form.grade||''} onChange={e=>set('grade',e.target.value)}/>
                <input required placeholder="Turma" value={form.className||''} onChange={e=>set('className',e.target.value)}/>
                <input placeholder="Nome do responsável" value={form.responsibleName||''} onChange={e=>set('responsibleName',e.target.value)}/>
                <input placeholder="Contato do responsável" value={form.responsibleContact||''} onChange={e=>set('responsibleContact',e.target.value)}/>
              </div>
            : <div className="portal-school-grid">
                <div className="school-search-wide">
                  <input required placeholder="🔎 Buscar e selecionar sua escola no SIGES" value={schoolSearch} onChange={e=>setSchoolSearch(e.target.value)}/>
                  <small>{filteredSchools.length} unidades escolares encontradas</small>
                </div>
                <select className="school-search-select" required value={form.sigesSchoolId||''} onChange={e=>{const v=e.target.value;const sc=schools.find(x=>x.id===v);set('sigesSchoolId',v);if(sc){set('schoolName',sc.name);set('municipality',sc.municipality);set('uf',sc.uf);set('bairro',sc.bairro||'');set('address',sc.address||'')}}}>
                  <option value="">Selecione a escola cadastrada no SIGES</option>
                  {filteredSchools.map(sc=><option key={sc.id} value={sc.id}>{sc.name} — {sc.bairro||sc.municipality}/{sc.uf}</option>)}
                </select>
                <input placeholder="INEP (opcional)" value={form.inep||''} onChange={e=>set('inep',e.target.value)}/>
                <input readOnly placeholder="Município" value={form.municipality||''}/>
                <input readOnly placeholder="UF" maxLength="2" value={form.uf||''}/>
                <input readOnly placeholder="Bairro" value={form.bairro||''}/>
                <input readOnly className="school-address" placeholder="Endereço" value={form.address||''}/>
              </div>}
        </>}

        <input required={mode==='login'} type={mode==='login'?'text':'email'} placeholder={mode==='login'?'Token de acesso':'E-mail (opcional)'} value={mode==='login'?(form.token||''):(form.email||'')} onChange={e=>set(mode==='login'?'token':'email',e.target.value)}/>
        <input required minLength="6" type="password" placeholder="Senha" value={form.password||''} onChange={e=>set('password',e.target.value)}/>
        <button className="portal-primary" disabled={busy}>{busy?'Processando…':mode==='login'?'Entrar':'Criar cadastro'}</button>
      </form>

      {mode==='login'&&pendingEmail&&<button type="button" className="portal-secondary" onClick={resend} disabled={busy}>✉️ Reenviar confirmação para {pendingEmail}</button>}

      <div className="portal-note">{mode==='login'?'Acesso protegido por token individual + senha. Cadastros classificados como suspeitos aguardam validação do vínculo pela escola.':'O token será usado no próximo acesso. Cadastros sem e-mail ou classificados como suspeitos passam por validação escolar adicional.'}</div>
    </div>
  </div>
}

function VerifyEmail(){const[status,setStatus]=useState('loading'),[message,setMessage]=useState('Confirmando seu e-mail…');useEffect(()=>{const token=new URLSearchParams(location.search).get('token');if(!token){setStatus('error');setMessage('Link de confirmação inválido.');return}api('/verify-email?token='+encodeURIComponent(token)).then(x=>{setStatus('ok');setMessage(x.message)}).catch(e=>{setStatus('error');setMessage(e.message)})},[]);return <div className="portal-auth"><div className="portal-auth-card"><div className="portal-logo"><ShieldCheck size={30}/></div><small>ENAT · ESCOLA SEGURA</small><h1>{status==='ok'?'E-mail confirmado':'Confirmação de e-mail'}</h1><div className={status==='ok'?'portal-ok':'portal-error'}>{message}</div><button className="portal-primary" onClick={()=>{window.location.href='/aluno'}}>Ir para o acesso do aluno</button><button className="portal-secondary" onClick={()=>{window.location.href='/escola'}}>Ir para o acesso da escola</button></div></div>}
function Frame({role,tab,setTab,logout,children}){const menu=role==='aluno'?studentMenu:schoolMenu;const u=JSON.parse(localStorage.getItem('siges_portal_user')||'{}');return <div className="portal"><aside className="portal-side"><div className="portal-brand"><ShieldCheck size={24}/><b>ESCOLA SEGURA<small>{role==='aluno'?'ALUNO':'ESCOLA'}</small></b></div><nav>{menu.map(([id,l,I])=><button key={id} className={tab===id?'active':''} onClick={()=>setTab(id)}><I size={17}/>{l}</button>)}</nav><div className="portal-side-foot"><span>{u.name||'Usuário'}</span><button onClick={logout}><LogOut size={15}/> Sair</button></div></aside><main className="portal-main"><header className="portal-header"><div><small>PLATAFORMA ESCOLA SEGURA</small><h2>{role==='aluno'?'Jornada do Aluno':'Painel da Escola'}</h2></div><div className="portal-user"><b>{u.name||'Usuário'}</b><span>{role==='aluno'?'Aluno':'Gestão escolar'}</span></div></header>{children}</main></div>}
function Portal({role}){const[user,setUser]=useState(()=>{try{return JSON.parse(localStorage.getItem('siges_portal_user')||'null')}catch{return null}}),[tab,setTab]=useState('home');const logout=()=>{localStorage.removeItem('siges_portal_token');localStorage.removeItem('siges_portal_user');setUser(null)};if(!user)return <Auth role={role} onDone={setUser}/>;return role==='aluno'?<StudentPortal tab={tab} setTab={setTab} logout={logout}/>:<SchoolPortal tab={tab} setTab={setTab} logout={logout}/>}
function StudentPortal({tab,setTab,logout}){const[d,setD]=useState(null),[error,setError]=useState(''),load=()=>api('/student/dashboard').then(setD).catch(e=>setError(e.message));useEffect(load,[]);if(error)return <div className="portal-error page-error">{error} <button onClick={logout}>Sair</button></div>;if(!d)return <div className="portal-loading">Carregando sua jornada…</div>;return <Frame role="aluno" tab={tab} setTab={setTab} logout={logout}>{tab==='home'?<StudentHome d={d} setTab={setTab}/>:tab==='learn'?<Learning d={d} reload={load}/>:tab==='territory'?<Territory d={d}/>:tab==='observe'?<Observe/>:tab==='claim'?<Claim/>:<Journey d={d}/>}</Frame>}
function StudentHome({d,setTab}){return <section className="portal-section"><div className="portal-hero"><div><small>BEM-VINDO À SUA JORNADA</small><h1>Olá, {d.student.name.split(' ')[0]}.</h1><p>Aprenda a perceber riscos, cuidar de si e ajudar a melhorar o caminho até a escola.</p></div><div className="hero-shield"><ShieldCheck size={42}/></div></div><div className="portal-cards">{[['Aprendizagem',d.summary.completedLessons,'aulas concluídas',BookOpen],['Observações',d.summary.observations,'situações identificadas',Eye],['Reivindicações',d.summary.claims,'pedidos registrados',Flag],['Jornada',d.summary.courseProgress+'%','progresso Aluno Guia',Trophy]].map(([a,b,c,I])=><div className="portal-metric" key={a}><I/><small>{a}</small><strong>{b}</strong><span>{c}</span></div>)}</div><div className="portal-grid2"><div className="portal-panel"><small>PRÓXIMO PASSO</small><h3>Aprender a perceber o risco</h3><p>Comece pelos cenários NEXUS 12 e transforme situações reais em decisões mais seguras.</p><button className="portal-primary" onClick={()=>setTab('learn')}>Começar a aprender <BookOpen size={16}/></button></div><div className="portal-panel"><small>MEU ENTORNO · SIGES</small><h3>{d.school?.name||'Minha escola'}</h3><p>{d.school?.bairro||''} · {d.school?.municipality||''}/{d.school?.uf||''}</p><p>{d.siges?.available?`O SIGES indica ${d.siges.territory.prioridade} neste entorno.`:'Contexto territorial ainda não disponível para esta escola.'}</p><button onClick={()=>setTab('territory')}>Conhecer meu território <Map size={16}/></button></div></div></section>}
function Learning({reload}){const[courses,setCourses]=useState([]),[open,setOpen]=useState(null),[busy,setBusy]=useState(false);useEffect(()=>{api('/courses').then(x=>setCourses(x.courses||[]))},[]);const complete=async(course,lesson)=>{setBusy(true);try{await api('/student/progress',{method:'POST',body:JSON.stringify({courseId:course.id,lessonId:lesson.id,completed:true})});await reload()}catch(e){alert(e.message)}finally{setBusy(false)}};return <section className="portal-section"><div className="section-title"><small>APRENDER</small><h2>Conhecimento que vira comportamento</h2><p>Conteúdos curtos, cenários e desafios ligados à segurança no caminho escolar.</p></div><div className="course-grid">{courses.map(c=><div className="course-card" key={c.id}><div className="course-icon"><BookOpen/></div><small>{c.type} · {c.hours}h</small><h3>{c.name}</h3><p>{c.description}</p><button onClick={()=>setOpen(open===c.id?null:c.id)}>Ver formação</button>{open===c.id&&<div className="lessons">{(c.modules||[]).slice(0,4).map(m=>(m.lessons||[]).slice(0,3).map(l=><div className="lesson" key={l.id}><div><b>{l.title}</b><span>{l.objective}</span></div><button disabled={busy} onClick={()=>complete(c,l)}><CheckCircle2 size={15}/> Concluir</button></div>))}</div>}</div>)}</div></section>}
function Territory({d}){return <section className="portal-section"><div className="section-title"><small>MEU ENTORNO</small><h2>Entender o lugar onde eu estudo</h2><p>O SIGES transforma inteligência territorial em aprendizagem. Você vê contexto, não dados pessoais de outros alunos.</p></div><div className="territory-card"><Map size={28}/><div><h3>{d.school?.name}</h3><p>{d.school?.address||'Endereço cadastrado'} · {d.school?.bairro||'Bairro não informado'} · {d.school?.municipality||''}/{d.school?.uf||''}</p>{d.siges?.available&&<p><b>SIGES:</b> {d.siges.territory.prioridade} · corredor: {d.siges.territory.corredor||'não identificado'} · {d.siges.territory.evidenciasCount} evidências territoriais.</p>}</div></div><div className="portal-grid3"><InfoCard icon={Eye} title="Observe" text="Visibilidade, travessia, calçada, sinalização, velocidade percebida e comportamento ao redor da escola."/><InfoCard icon={AlertTriangle} title="Perceba" text="Pergunte: o que pode dar errado? Quem está mais vulnerável? Qual seria a decisão mais segura?"/><InfoCard icon={Target} title="Aja" text="Registre uma observação ou construa uma reivindicação qualificada com a escola."/></div></section>}
function InfoCard({icon:I,title,text}){return <div className="portal-panel"><I/><h3>{title}</h3><p>{text}</p></div>}
function Observe(){const[category,setCategory]=useState('Travessia'),[description,setDescription]=useState(''),[location,setLocation]=useState(''),[ok,setOk]=useState('');const send=async e=>{e.preventDefault();try{await api('/student/observations',{method:'POST',body:JSON.stringify({category,description,location})});setDescription('');setLocation('');setOk('Observação enviada ao SIGES para qualificação.')}catch(e){setOk(e.message)}};return <section className="portal-section"><div className="section-title"><small>EU IDENTIFICO</small><h2>O território também ensina</h2><p>Você registra o que percebe. O SIGES faz a qualificação técnica.</p></div><form className="portal-form" onSubmit={send}><select value={category} onChange={e=>setCategory(e.target.value)}>{['Travessia','Velocidade percebida','Estacionamento','Visibilidade','Calçada','Sinalização','Iluminação','Bicicleta','Motocicleta','Transporte escolar','Outro'].map(x=><option key={x}>{x}</option>)}</select><input value={location} onChange={e=>setLocation(e.target.value)} placeholder="Onde você percebeu?"/><textarea required value={description} onChange={e=>setDescription(e.target.value)} placeholder="Descreva o que você observou…"/><button className="portal-primary"><Send size={16}/> Enviar observação</button>{ok&&<div className="portal-ok">{ok}</div>}</form></section>}
function Claim(){const[category,setCategory]=useState('Infraestrutura'),[title,setTitle]=useState(''),[description,setDescription]=useState(''),[location,setLocation]=useState(''),[ok,setOk]=useState('');const send=async e=>{e.preventDefault();try{await api('/student/claims',{method:'POST',body:JSON.stringify({category,title,description,location})});setTitle('');setDescription('');setLocation('');setOk('Reivindicação registrada e encaminhada para análise da escola.')}catch(e){setOk(e.message)}};return <section className="portal-section"><div className="section-title"><small>PARTICIPAR</small><h2>Minha reivindicação</h2><p>Descreva o problema, o local e por que ele importa para a segurança.</p></div><form className="portal-form" onSubmit={send}><select value={category} onChange={e=>setCategory(e.target.value)}><option>Infraestrutura</option><option>Sinalização</option><option>Travessia</option><option>Calçada</option><option>Transporte</option><option>Segurança</option><option>Outro</option></select><input required value={title} onChange={e=>setTitle(e.target.value)} placeholder="Título da reivindicação"/><input value={location} onChange={e=>setLocation(e.target.value)} placeholder="Local"/><textarea required value={description} onChange={e=>setDescription(e.target.value)} placeholder="Explique o que deveria melhorar…"/><button className="portal-primary"><Send size={16}/> Registrar reivindicação</button>{ok&&<div className="portal-ok">{ok}</div>}</form></section>}
function Journey({d}){return <section className="portal-section"><div className="section-title"><small>MINHA JORNADA</small><h2>Aprender → perceber → participar</h2></div><div className="journey-line"><div className="journey-step done"><CheckCircle2/><b>Entrar</b><span>Perfil escolar vinculado</span></div><div className={d.summary.completedLessons?'journey-step done':'journey-step'}><BookOpen/><b>Aprender</b><span>{d.summary.completedLessons} aulas</span></div><div className={d.summary.observations?'journey-step done':'journey-step'}><Eye/><b>Perceber</b><span>{d.summary.observations} observações</span></div><div className={d.summary.claims?'journey-step done':'journey-step'}><Flag/><b>Participar</b><span>{d.summary.claims} reivindicações</span></div></div><div className="portal-panel"><h3>Aluno Guia</h3><p>{d.training?('Formação em andamento · '+d.training.progress+'%'):'Quando a escola indicar você, sua formação de Aluno Guia aparecerá aqui.'}</p></div></section>}
function SchoolPortal({tab,setTab,logout}){const[d,setD]=useState(null),[error,setError]=useState('');const load=()=>api('/school/dashboard').then(setD).catch(e=>setError(e.message));useEffect(load,[]);if(error)return <div className="portal-error page-error">{error} <button onClick={logout}>Sair</button></div>;if(!d)return <div className="portal-loading">Carregando painel escolar…</div>;return <Frame role="escola" tab={tab} setTab={setTab} logout={logout}>{tab==='home'?<SchoolHome d={d}/>:tab==='students'?<SchoolStudents d={d}/>:tab==='learning'?<SchoolLearning d={d}/>:tab==='claims'?<SchoolClaims d={d}/>:<SchoolTerritory d={d}/>}</Frame>}
function SchoolHome({d}){return <section className="portal-section"><div className="portal-hero"><div><small>GESTÃO ESCOLAR</small><h1>{d.school.name}</h1><p>Veja o que seus alunos aprenderam, observaram e reivindicaram — com visão agregada e foco em ação.</p></div><School size={50}/></div><div className="portal-cards">{[['Alunos',d.summary.students,'matriculados',Users],['Aulas concluídas',d.summary.lessonsCompleted,'aprendizagens',CheckCircle2],['Riscos SIGES',d.siges?.operational?.openRisks||0,'em aberto',AlertTriangle],['Planos SIGES',d.siges?.operational?.openActionPlans||0,'em acompanhamento',Target]].map(([a,b,c,I])=><div className="portal-metric" key={a}><I/><small>{a}</small><strong>{b}</strong><span>{c}</span></div>)}</div><div className="portal-grid2"><div className="portal-panel"><small>APRENDIZAGEM</small><h3>O que a escola já ensinou?</h3><p>Acompanhe aulas concluídas e evolução por turma.</p></div><div className="portal-panel"><small>SIGES · TERRITÓRIO</small><h3>{d.siges?.available?'Contexto territorial conectado':'Contexto territorial pendente'}</h3><p>{d.siges?.available?'Prioridade '+d.siges.territorial.prioridade+' · HSI '+(d.siges.territorial.hsi??'—')+' · IPE '+(d.siges.territorial.ipe??'—')+'.':'O SIGES ainda não encontrou correspondência segura para esta escola.'}</p><p>{d.siges?.operational?d.siges.operational.evidences+' evidências · '+d.siges.operational.openRisks+' riscos · '+d.siges.operational.openActionPlans+' planos em aberto.':''}</p></div></div></section>}
function SchoolStudents({d}){const[busy,setBusy]=useState('');const decide=async(id,decision)=>{setBusy(id);try{await api('/school/students/'+id+'/decision',{method:'POST',body:JSON.stringify({decision})});location.reload()}catch(e){alert(e.message)}finally{setBusy('')}};return <section className="portal-section"><div className="section-title"><small>BASE ESCOLAR</small><h2>Alunos</h2><p>Confirme o vínculo dos alunos que escolheram esta unidade no SIGES.</p></div><div className="portal-table">{d.students.map(s=><div className="student-row" key={s.id}><div><b>{s.name}</b><span>{s.grade} · {s.className} · {s.status==='active'?'Vínculo ativo':'Aguardando validação'}</span></div><div><span>{s.lessons} aulas</span><span>{s.observations} observações</span><span>{s.claims} reivindicações</span>{s.status==='pending'&&<><button disabled={busy===s.id} onClick={()=>decide(s.id,'approve')}>✓ Aprovar</button><button disabled={busy===s.id} onClick={()=>decide(s.id,'reject')}>✕ Recusar</button></>}</div></div>)}</div></section>}
function SchoolLearning({d}){return <section className="portal-section"><div className="section-title"><small>APRENDIZAGEM</small><h2>O que os alunos aprenderam</h2><p>Acompanhamento pedagógico agregado.</p></div><div className="portal-table">{d.students.map(s=><div className="student-row" key={s.id}><div><b>{s.name}</b><span>{s.grade} · {s.className}</span></div><div className="progress"><i><span style={{width:Math.min(100,s.guideProgress)+'%'}}/></i><span>{s.lessons} aulas · Aluno Guia {s.guideProgress}%</span></div></div>)}</div></section>}
function SchoolClaims({d}){return <section className="portal-section"><div className="section-title"><small>PARTICIPAÇÃO</small><h2>Reivindicações dos alunos</h2><p>O aluno registra; a escola analisa; o SIGES qualifica.</p></div><div className="portal-table">{d.claims.length?d.claims.map(c=><div className="claim-row" key={c.id}><div><b>{c.title}</b><span>{c.category} · {c.location||'local não informado'}</span><p>{c.description}</p></div><em>{c.status}</em></div>):<div className="portal-empty">Nenhuma reivindicação registrada ainda.</div>}</div></section>}
function SchoolTerritory({d}){return <section className="portal-section"><div className="section-title"><small>TERRITÓRIO</small><h2>Escola conectada ao SIGES</h2></div><div className="territory-card"><Map/><div><h3>{d.school.name}</h3><p>{d.school.address} · {d.school.bairro} · {d.school.municipality}/{d.school.uf}</p>{d.siges?.available&&<p><b>SIGES:</b> prioridade {d.siges.territorial.prioridade} · HSI {d.siges.territorial.hsi??'—'} · IPE {d.siges.territorial.ipe??'—'} · corredor {d.siges.territorial.corridor||'não identificado'}.</p>}</div></div><div className="portal-grid3"><InfoCard icon={BookOpen} title="Aprender" text="Formações e atividades de percepção de risco."/><InfoCard icon={Eye} title="Observar" text="Observações registradas pelos alunos."/><InfoCard icon={Flag} title="Reivindicar" text="Demandas organizadas para análise e encaminhamento."/></div></section>}
createRoot(document.getElementById('root')).render(<Portal role={location.pathname.startsWith('/escola')?'escola':'aluno'}/>);