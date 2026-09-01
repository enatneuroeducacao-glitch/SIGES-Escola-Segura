const express=require('express');
const cors=require('cors');
const fs=require('fs');
const path=require('path');
const bcrypt=require('bcryptjs');
const jwt=require('jsonwebtoken');

const app=express();
const PORT=3001;
const SECRET=process.env.SIGES_SECRET||'SIGES_LOCAL_ONLY_CHANGE_BEFORE_PRODUCTION';
const DB=path.join(__dirname,'data','db.json');

function ensureAdmin(){
  const db=read();
  if(!db.users.some(u=>u.role==='enat' && (u.username==='admin' || u.email==='admin'))){
    const u={id:'usr_admin_local',role:'enat',username:'admin',name:'Administrador ENAT',email:'admin',passwordHash:bcrypt.hashSync('admin',12),status:'active',profile:{institution:'ENAT'},createdAt:new Date().toISOString(),mustChangePassword:true};
    db.users.push(u);
    audit(db,'ADMIN_BOOTSTRAP',u.id,{username:'admin',temporaryPassword:true});
    write(db);
    console.log('Administrador de teste criado: usuário admin / senha admin');
  }
}

app.use(cors({origin:'http://localhost:5173'}));
app.use(express.json());

// A conta admin/admin é criada somente para o ambiente local de testes.
// Deve ser alterada no primeiro acesso antes de qualquer publicação.


function defaultSettings(){
  return {
    system:{name:'SIGES — Escola Segura',institution:'ENAT — Ensino Neuroeducacional Aplicado ao Trânsito',municipalityScope:'Brasil',maintenanceMode:false},
    security:{sessionHours:8,minPasswordLength:8,requirePasswordChange:true,loginAttempts:5,lockMinutes:15},
    governance:{requireDirectionValidationForClaims:true,directMunicipalityCategories:['infraestrutura','seguranca'],requireCertifiedGuideForSubmission:true,allowStudentsToDraftClaims:true},
    privacy:{maskSensitiveData:true,minimumDataCollection:true,trafficAgencyView:['nome','serie','alunoGuia','escola'],municipalityReportsAggregated:true,retainAuditDays:3650},
    certification:{minimumFinalScore:70,courseType:'Curso livre',includeSubjects:true,includeLegalNote:true,includePreTrainingNote:true,includeSchoolStampAndSignature:true,verificationCode:true},
    hsi:{trafficEntryOncePerStudent:true,bullyingRequiredForBullyingCourse:true,bullyingCertificateWithoutMinimumScore:true,storeAggregatedMunicipalIndicators:true},
    notifications:{emailEnabled:false,inAppEnabled:true,notifyDirectionClaims:true,notifyAdminSecurity:true},
    audit:{enabled:true,level:'administracao',logLogins:true,logChanges:true,logCertificates:true}
  };
}

function read(){
  const db=JSON.parse(fs.readFileSync(DB,'utf8'));
  if(!db.settings) db.settings=defaultSettings();
  for(const key of ['users','audit','passwordResets','schools','students','courses','enrollments','guideTrainings','assessments','hsiTraffic','hsiBullying','risks','claims','actionPlans','evidences','audits','certificates']){
    if(!Array.isArray(db[key])) db[key]=[];
  }
  return db;
}
function write(db){fs.writeFileSync(DB,JSON.stringify(db,null,2))}
function safe(u){const {passwordHash,...x}=u;return x}
function token(u){return jwt.sign({id:u.id,role:u.role},SECRET,{expiresIn:'8h'})}
function audit(db,action,userId,details={}){db.audit.push({id:Date.now().toString(),action,userId,details,at:new Date().toISOString()})}
function auth(req,res,next){
  const h=req.headers.authorization||'',t=h.replace(/^Bearer\s+/i,'');
  try{
    const p=jwt.verify(t,SECRET),db=read(),u=db.users.find(x=>x.id===p.id);
    if(!u||u.status!=='active') throw new Error();
    req.user=u;next();
  }catch{res.status(401).json({error:'Sessão inválida.'})}
}

app.get('/api/health',(req,res)=>res.json({ok:true,system:'SIGES',mode:'local'}));

app.post('/api/register',async(req,res)=>{
  const {role,name,email,password,profile={}}=req.body;
  const allowed=['aluno','aluno_guia','instrutor','escola','auditor','transito','educacao','prefeitura'];
  if(!allowed.includes(role)) return res.status(400).json({error:'Perfil inválido. A conta ENAT/Administração é criada somente pelo procedimento administrativo local.'});
  if(!name||!email||!password||password.length<6) return res.status(400).json({error:'Preencha os dados obrigatórios. A senha deve ter pelo menos 6 caracteres.'});
  const db=read(),e=email.trim().toLowerCase();
  if(db.users.some(u=>u.email===e)) return res.status(409).json({error:'Este e-mail já está cadastrado.'});
  const u={id:'usr_'+Date.now(),role,name:name.trim(),email:e,passwordHash:await bcrypt.hash(password,10),status:'pending',profile,createdAt:new Date().toISOString()};
  db.users.push(u);audit(db,'REGISTER',u.id,{role});write(db);
  res.status(201).json({message:'Cadastro criado e aguardando validação.',user:safe(u)});
});

app.post('/api/login',async(req,res)=>{
  const identifier=String(req.body.email||req.body.identifier||'').trim().toLowerCase(),password=String(req.body.password||'');
  const db=read(),u=db.users.find(x=>x.email===identifier || x.username===identifier);
  if(!u||!(await bcrypt.compare(password,u.passwordHash))) return res.status(401).json({error:'E-mail ou senha inválidos.'});
  if(u.status!=='active') return res.status(403).json({error:'Esta conta ainda aguarda validação.'});
  audit(db,'LOGIN',u.id,{role:u.role});write(db);
  res.json({token:token(u),user:safe(u)});
});

app.get('/api/me',auth,(req,res)=>res.json({user:safe(req.user)}));

app.get('/api/settings',auth,(req,res)=>{
  if(req.user.role!=='enat') return res.status(403).json({error:'Acesso restrito à Administração ENAT.'});
  const db=read();
  res.json({settings:db.settings||defaultSettings()});
});

app.put('/api/settings',auth,(req,res)=>{
  if(req.user.role!=='enat') return res.status(403).json({error:'Acesso restrito à Administração ENAT.'});
  const db=read();
  const incoming=req.body||{};
  db.settings={...defaultSettings(),...(db.settings||{}),...incoming};
  audit(db,'SETTINGS_UPDATE',req.user.id,{sections:Object.keys(incoming)});
  write(db);
  res.json({settings:db.settings});
});

app.post('/api/admin/change-password',async(req,res)=>{
  if(req.user.role!=='enat') return res.status(403).json({error:'Acesso restrito à Administração ENAT.'});
  const {currentPassword,newPassword}=req.body||{};
  if(!currentPassword || !newPassword || newPassword.length<8) return res.status(400).json({error:'Informe a senha atual e uma nova senha com pelo menos 8 caracteres.'});
  if(!(await bcrypt.compare(currentPassword,req.user.passwordHash))) return res.status(401).json({error:'Senha atual inválida.'});
  const db=read(),u=db.users.find(x=>x.id===req.user.id);
  u.passwordHash=await bcrypt.hash(newPassword,12); u.mustChangePassword=false;
  audit(db,'ADMIN_PASSWORD_CHANGED',u.id); write(db);
  res.json({message:'Senha administrativa alterada com sucesso.'});
});

app.get('/api/admin/users',auth,(req,res)=>{
  if(req.user.role!=='enat') return res.status(403).json({error:'Acesso restrito à Administração ENAT.'});
  const db=read();
  res.json({users:db.users.map(safe)});
});

app.post('/api/admin/users/:id/status',auth,(req,res)=>{
  if(req.user.role!=='enat') return res.status(403).json({error:'Acesso restrito à Administração ENAT.'});
  const db=read(),u=db.users.find(x=>x.id===req.params.id);
  if(!u) return res.status(404).json({error:'Usuário não encontrado.'});
  if(u.id===req.user.id && req.body.status!=='active') return res.status(400).json({error:'O administrador atual não pode bloquear a própria conta.'});
  const allowed=['active','pending','blocked'];
  if(!allowed.includes(req.body.status)) return res.status(400).json({error:'Status inválido.'});
  u.status=req.body.status; audit(db,'USER_STATUS_CHANGED',req.user.id,{targetUserId:u.id,status:u.status}); write(db);
  res.json({user:safe(u)});
});

app.get('/api/admin/audit',auth,(req,res)=>{
  if(req.user.role!=='enat') return res.status(403).json({error:'Acesso restrito à Administração ENAT.'});
  const db=read(); res.json({audit:db.audit.slice().reverse().slice(0,100)});
});

app.get('/api/admin/backup',auth,(req,res)=>{
  if(req.user.role!=='enat') return res.status(403).json({error:'Acesso restrito à Administração ENAT.'});
  const db=read();
  audit(db,'BACKUP_EXPORT',req.user.id); write(db);
  res.setHeader('Content-Disposition','attachment; filename=siges-backup.json');
  res.json(db);
});


function canManageSchools(user){return ['enat','escola','prefeitura','educacao'].includes(user.role)}
function canManageStudents(user){return ['enat','escola'].includes(user.role)}
function schoolVisibleToUser(user,school){
  if(!school) return false;
  if(user.role==='enat') return true;
  if(user.role==='escola') return school.managerUserId===user.id || school.id===user.profile?.schoolId;
  return false;
}
app.get('/api/students',auth,(req,res)=>{
  if(!canManageStudents(req.user)) return res.status(403).json({error:'Seu perfil não pode acessar o cadastro completo de alunos.'});
  const db=read();
  let rows=db.students.slice();
  if(req.user.role==='escola') rows=rows.filter(x=>schoolVisibleToUser(req.user,db.schools.find(s=>s.id===x.schoolId)));
  const schools=db.schools.map(s=>({id:s.id,name:s.name,municipality:s.municipality,uf:s.uf,status:s.status}));
  res.json({students:rows.map(x=>({
    ...x,
    schoolName:db.schools.find(s=>s.id===x.schoolId)?.name||'Escola não localizada'
  })),schools});
});
app.post('/api/students',auth,(req,res)=>{
  if(!canManageStudents(req.user)) return res.status(403).json({error:'Seu perfil não pode cadastrar alunos.'});
  const {name,birthDate,schoolId,grade,className,shift,responsibleName,responsibleContact}=req.body||{};
  if(!name||!birthDate||!schoolId||!grade||!className) return res.status(400).json({error:'Informe nome, data de nascimento, escola, série/etapa e turma.'});
  const db=read(),school=db.schools.find(s=>s.id===schoolId);
  if(!school) return res.status(400).json({error:'Escola não encontrada.'});
  if(!schoolVisibleToUser(req.user,school)) return res.status(403).json({error:'Você só pode cadastrar alunos vinculados à sua escola.'});
  const student={id:'std_'+Date.now(),name:String(name).trim(),birthDate:String(birthDate),schoolId,grade:String(grade).trim(),className:String(className).trim(),shift:String(shift||'').trim(),responsibleName:String(responsibleName||'').trim(),responsibleContact:String(responsibleContact||'').trim(),status:'active',isGuide:false,guideCertified:false,createdAt:new Date().toISOString(),createdBy:req.user.id};
  db.students.push(student);audit(db,'STUDENT_CREATED',req.user.id,{studentId:student.id,schoolId,grade:student.grade,className:student.className});write(db);
  res.status(201).json({student:{...student,schoolName:school.name}});
});
app.put('/api/students/:id',auth,(req,res)=>{
  if(!canManageStudents(req.user)) return res.status(403).json({error:'Seu perfil não pode alterar alunos.'});
  const db=read(),student=db.students.find(x=>x.id===req.params.id);if(!student)return res.status(404).json({error:'Aluno não encontrado.'});
  const oldSchool=db.schools.find(s=>s.id===student.schoolId);
  if(!schoolVisibleToUser(req.user,oldSchool)) return res.status(403).json({error:'Você só pode alterar alunos da sua escola.'});
  const allowed=['name','birthDate','schoolId','grade','className','shift','responsibleName','responsibleContact'];
  for(const k of allowed) if(req.body[k]!==undefined) student[k]=typeof req.body[k]==='string'?req.body[k].trim():req.body[k];
  const newSchool=db.schools.find(s=>s.id===student.schoolId);if(!newSchool)return res.status(400).json({error:'Escola não encontrada.'});
  if(!schoolVisibleToUser(req.user,newSchool))return res.status(403).json({error:'Você só pode vincular o aluno à sua escola.'});
  audit(db,'STUDENT_UPDATED',req.user.id,{studentId:student.id,schoolId:student.schoolId});write(db);res.json({student:{...student,schoolName:newSchool.name}});
});
app.post('/api/students/:id/status',auth,(req,res)=>{
  if(!canManageStudents(req.user)) return res.status(403).json({error:'Seu perfil não pode alterar o status de alunos.'});
  const db=read(),student=db.students.find(x=>x.id===req.params.id);if(!student)return res.status(404).json({error:'Aluno não encontrado.'});
  const school=db.schools.find(s=>s.id===student.schoolId);if(!schoolVisibleToUser(req.user,school))return res.status(403).json({error:'Você só pode alterar alunos da sua escola.'});
  if(!['active','inactive'].includes(req.body.status))return res.status(400).json({error:'Status inválido.'});
  student.status=req.body.status;audit(db,'STUDENT_STATUS_CHANGED',req.user.id,{studentId:student.id,status:student.status});write(db);res.json({student:{...student,schoolName:school?.name||''}});
});
app.get('/api/schools',auth,(req,res)=>{
  const db=read();
  let rows=db.schools.slice();
  if(req.user.role==='escola') rows=rows.filter(x=>x.managerUserId===req.user.id || x.id===req.user.profile?.schoolId);
  res.json({schools:rows});
});
app.post('/api/schools',auth,(req,res)=>{
  if(!canManageSchools(req.user)) return res.status(403).json({error:'Seu perfil não pode cadastrar escolas.'});
  const {name,inep,municipality,uf,bairro,address,managerName,managerEmail}=req.body||{};
  if(!name||!municipality||!uf) return res.status(400).json({error:'Informe nome da escola, município e UF.'});
  const db=read();
  const school={id:'sch_'+Date.now(),name:String(name).trim(),inep:String(inep||'').trim(),municipality:String(municipality).trim(),uf:String(uf).trim().toUpperCase(),bairro:String(bairro||'').trim(),address:String(address||'').trim(),managerName:String(managerName||'').trim(),managerEmail:String(managerEmail||'').trim().toLowerCase(),managerUserId:req.user.role==='escola'?req.user.id:null,status:'active',createdAt:new Date().toISOString(),createdBy:req.user.id};
  db.schools.push(school);audit(db,'SCHOOL_CREATED',req.user.id,{schoolId:school.id,name:school.name});write(db);res.status(201).json({school});
});
app.put('/api/schools/:id',auth,(req,res)=>{
  if(!canManageSchools(req.user)) return res.status(403).json({error:'Seu perfil não pode alterar escolas.'});
  const db=read(),school=db.schools.find(x=>x.id===req.params.id); if(!school)return res.status(404).json({error:'Escola não encontrada.'});
  if(req.user.role==='escola' && school.managerUserId!==req.user.id)return res.status(403).json({error:'Você só pode alterar sua própria escola.'});
  const allowed=['name','inep','municipality','uf','bairro','address','managerName','managerEmail','status'];
  for(const k of allowed) if(req.body[k]!==undefined) school[k]=typeof req.body[k]==='string'?(k==='uf'?req.body[k].toUpperCase():req.body[k].trim()):req.body[k];
  audit(db,'SCHOOL_UPDATED',req.user.id,{schoolId:school.id,fields:allowed.filter(k=>req.body[k]!==undefined)});write(db);res.json({school});
});
app.post('/api/schools/:id/status',auth,(req,res)=>{
  if(req.user.role!=='enat')return res.status(403).json({error:'Somente a Administração ENAT pode alterar o status institucional.'});
  const db=read(),school=db.schools.find(x=>x.id===req.params.id);if(!school)return res.status(404).json({error:'Escola não encontrada.'});
  if(!['active','inactive'].includes(req.body.status))return res.status(400).json({error:'Status inválido.'}); school.status=req.body.status;audit(db,'SCHOOL_STATUS_CHANGED',req.user.id,{schoolId:school.id,status:school.status});write(db);res.json({school});
});


function canManageGuides(user){return ['enat','escola','educacao','prefeitura'].includes(user.role)}
function courseLesson(id,title,objective,content,activity){
  return {id,title,objective,content,activity};
}
function ensureCourses(db){
  const existing=new Map((db.courses||[]).map(c=>[c.slug,c]));
  const guide={
    id:'course_aluno_guia',slug:'pre-formacao-aluno-guia',name:'Pré-formação de Aluno Guia',type:'Curso livre',status:'active',hours:20,
    description:'Formação inicial para participação segura e cidadã do aluno na identificação de riscos e construção de reivindicações qualificadas.',
    audience:'Alunos do ensino fundamental, especialmente 6º ao 9º ano.',source:'Apostila Programa de Segurança no Trânsito Escolar – Aluno Guia',
    modules:[
      {id:'ag1',title:'Consciência e percepção de risco',focus:'Perceber',lessons:[courseLesson('ag1l1','Ver x perceber','Diferenciar olhar de percepção ativa.','Identificar movimento de veículos, pessoas, distrações e mudanças no ambiente escolar. O aluno aprende a perguntar: o que está acontecendo, qual é o risco e o que pode dar errado?','Observar a entrada/saída da escola e registrar três riscos sem se colocar em perigo.') ,courseLesson('ag1l2','Atenção ativa no entorno escolar','Reduzir o comportamento automático.','Trabalhar atenção ao fluxo de veículos, travessias, celulares, pressa e desorganização do ambiente.','Mapa simples de riscos do caminho casa-escola.'),courseLesson('ag1l3','Antecipação de riscos','Pensar antes que o problema aconteça.','Usar perguntas de antecipação: se eu atravessar agora, o que pode acontecer? se todos fizerem isso, qual será o resultado?','Analisar cenários e escolher a decisão mais segura.') ]},
      {id:'ag2',title:'Decisão e comportamento',focus:'Decidir',lessons:[courseLesson('ag2l1','Impulsividade','Reconhecer decisões automáticas.','Pressa, distração e hábito podem reduzir o tempo disponível para pensar.','Relatar uma situação em que uma decisão rápida poderia ter causado risco.'),courseLesson('ag2l2','Emoção e pressão do grupo','Perceber como emoção e grupo interferem.','Ansiedade, medo, empolgação e o desejo de acompanhar colegas podem alterar escolhas.','Comparar uma decisão individual com uma decisão tomada sob pressão do grupo.'),courseLesson('ag2l3','Efeito espectador e autocontrole','Transformar percepção em atitude segura.','Perceber um risco não significa entrar em risco. O aluno guia deve avaliar limites, pedir apoio e evitar confronto.','Simular uma situação de risco e decidir quando agir, aguardar ou chamar um adulto.') ]},
      {id:'ag3',title:'Normas e convivência',focus:'Conviver',lessons:[courseLesson('ag3l1','Sentido das regras','Compreender por que regras existem.','Regras são instrumentos de organização e proteção. O foco é compreender sua finalidade, não apenas memorizar.','Escolher uma regra do entorno escolar e explicar qual risco ela ajuda a reduzir.'),courseLesson('ag3l2','Respeito e responsabilidade coletiva','Entender impacto das próprias atitudes.','A segurança é coletiva: uma escolha individual pode influenciar colegas, motoristas e pedestres.','Debater um comportamento que melhora a segurança de todo o grupo.'),courseLesson('ag3l3','Influenciar sem mandar','Desenvolver liderança pelo exemplo.','O Aluno Guia não possui autoridade sobre o tráfego, não aplica punições e não entra em conflitos. Sua atuação é educativa e supervisionada.','Encenar uma orientação respeitosa sem dar ordens ou se expor.') ]},
      {id:'ag4',title:'Execução prática',focus:'Aplicar',lessons:[courseLesson('ag4l1','Travessia segura','Aplicar observação e decisão.','Observar ambiente, veículos, pessoas e momento adequado antes de atravessar.','Simulação orientada de travessia segura.'),courseLesson('ag4l2','Organização da entrada e saída','Reconhecer pontos de conflito.','Identificar concentração de alunos, veículos, obstáculos e distrações sem assumir funções de agente de trânsito.','Checklist supervisionado do entorno escolar.'),courseLesson('ag4l3','Equipamentos e limites','Usar recursos de forma responsável.','Colete, placa e apito são recursos educativos; não conferem autoridade legal e não justificam exposição ao risco.','Demonstrar uso correto em simulação supervisionada.') ]},
      {id:'ag5',title:'Intervenção e resposta',focus:'Intervir com segurança',lessons:[courseLesson('ag5l1','Quando intervir','Escolher uma intervenção segura.','Priorizar a própria segurança, avaliar distância, fluxo e possibilidade de apoio adulto.','Classificar situações em agir, aguardar ou chamar responsável.'),courseLesson('ag5l2','Registro de evidências','Registrar fatos com responsabilidade.','Uma reivindicação qualificada precisa descrever o problema observado, local, horário, contexto e evidência disponível, evitando exposição indevida de pessoas.','Preencher um modelo de registro de risco escolar.'),courseLesson('ag5l3','Reivindicações e encaminhamento','Transformar observação em proposta.','O aluno guia pode contribuir para identificar riscos e construir reivindicações; situações que envolvem infraestrutura ou entorno devem seguir a governança do SIGES.','Converter um risco observado em uma reivindicação objetiva e respeitosa.') ]},
      {id:'ag6',title:'Consolidação e atuação responsável',focus:'Ser referência',lessons:[courseLesson('ag6l1','Consistência comportamental','Consolidar hábitos seguros.','O objetivo não é parecer perfeito, mas demonstrar coerência entre o que se responde e o que se faz.','Autoavaliação de comportamento real.'),courseLesson('ag6l2','HSI e evolução','Compreender o acompanhamento comportamental.','A avaliação HSI ocorre em momentos de início, meio e final, permitindo observar percepção, impulsividade, influência social, responsabilidade coletiva e segurança comportamental.','Comparar uma situação inicial com uma situação após a formação.'),courseLesson('ag6l3','Compromisso do Aluno Guia','Preparar-se para atuar com limites.','Ser aluno guia é ser referência: pensar antes de agir, respeitar limites, evitar riscos e saber quando não agir.','Assinar compromisso de atuação responsável.') ]}
    ],
    certification:'Pré-formação de Aluno Guia; certificação ENAT somente após cumprimento das regras de formação e avaliação configuradas.'
  };
  const nexusPillars=['Consciência situacional','Percepção de risco','Tomada de decisão','Controle veicular','Comunicação eficaz','Regulamentação e legislação','Adaptação e flexibilidade','Inteligência emocional','Responsabilidade social','Aprendizagem contínua','Ergonomia e conforto','Primeiros socorros e resposta a acidentes'];
  const nexusModules=nexusPillars.map((title,i)=>({
    id:'nx'+(i+1),title,focus:'Atuação do Aluno Guia',lessons:[
      courseLesson('nx'+(i+1)+'l1','Conceito e segurança escolar','Compreender o pilar no contexto escolar.',`Aplicar ${title.toLowerCase()} ao cotidiano do aluno guia, sempre com foco em prevenção, comportamento seguro e limites de atuação.`,'Identificar uma situação escolar em que este pilar esteja presente.'),
      courseLesson('nx'+(i+1)+'l2','Aplicação prática','Transformar conhecimento em comportamento observável.',`Exercitar ${title.toLowerCase()} por meio de cenários de entrada, saída, travessia, convivência e identificação de riscos.`,'Resolver um cenário prático sem se expor ao risco.'),
      courseLesson('nx'+(i+1)+'l3','Reflexão e decisão','Consolidar tomada de decisão consciente.',`Perguntas de reflexão: o que percebi? qual era o risco? qual decisão protege melhor as pessoas? quando devo pedir ajuda?`,'Registrar uma decisão segura e justificar o motivo.')
    ]
  }));
  const nexus={id:'course_nexus_aluno_guia',slug:'nexus-12-aluno-guia',name:'NEXUS 12 — Atuação do Aluno Guia',type:'Curso livre',status:'active',hours:36,description:'Formação complementar que transforma os 12 pilares do NEXUS 12 em competências observáveis para a atuação educativa do Aluno Guia.',audience:'Alunos Guias em pré-formação ou já certificados, com supervisão escolar.',source:'NEXUS 12 — Estrutura de Desenvolvimento Comportamental; integração com o Programa de Segurança no Trânsito Escolar – Aluno Guia.',pillars:nexusPillars,modules:nexusModules,certification:'Certificado ENAT como curso livre, conforme regras do SIGES e sem atribuição de autoridade legal de trânsito.'};
  const neuroTitles=[
    ['Neuroeducação e segurança escolar','Entender como atenção, emoção, memória e motivação interferem na aprendizagem de comportamentos seguros.'],
    ['Atenção e distração','Reconhecer distrações e construir estratégias simples de atenção ativa no entorno escolar.'],
    ['Emoções, impulsividade e autocontrole','Perceber pressa, ansiedade, medo, empolgação e pressão social antes da decisão.'],
    ['Memória, aprendizagem e repetição','Transformar experiências práticas em hábitos de segurança por meio de aprendizagem ativa.'],
    ['Percepção de risco e tomada de decisão','Aprender a antecipar consequências e escolher respostas seguras em situações reais.'],
    ['Influência social e comportamento coletivo','Compreender como o grupo influencia escolhas e como o exemplo pode mudar comportamentos.'],
    ['Comunicação, empatia e convivência','Orientar sem confronto, respeitar diferenças e construir uma cultura de cuidado.'],
    ['Prática, reflexão e mudança de comportamento','Integrar aprendizagem, observação, HSI e plano pessoal de evolução.']
  ];
  const neuroModules=neuroTitles.map((m,i)=>({id:'ne'+(i+1),title:m[0],focus:'Neuroeducação aplicada ao trânsito escolar',lessons:[
    courseLesson(`ne${i+1}l1`,'Entender','Relacionar o tema ao comportamento.','Conteúdo em linguagem simples, com exemplos do cotidiano escolar e situações de deslocamento, travessia e convivência.','Responder: onde esse comportamento aparece na minha rotina?'),
    courseLesson(`ne${i+1}l2`,'Experimentar','Aprender pela prática e observação.',`Atividade prática relacionada a ${m[0].toLowerCase()}, com foco em percepção, reflexão e tomada de decisão.`,'Realizar a atividade em ambiente seguro e supervisionado.'),
    courseLesson(`ne${i+1}l3`,'Aplicar','Levar o aprendizado para situações reais.',`Aplicação do tema: ${m[1]}`,'Descrever uma situação real e a decisão mais segura.'),
    courseLesson(`ne${i+1}l4`,'Refletir e evoluir','Consolidar consciência comportamental.','A aprendizagem termina com reflexão: o que mudou, o que ainda precisa melhorar e como transformar a escolha segura em hábito.','Registrar compromisso de mudança e ponto de melhoria.')
  ]}));
  const neuro={id:'course_neuroeducacao_transito_escolar',slug:'neuroeducacao-transito-escolar',name:'Neuroeducação Aplicada ao Trânsito Escolar',type:'Curso livre',status:'active',hours:32,description:'Formação para compreender e aplicar princípios de aprendizagem, atenção, emoção, comportamento e tomada de decisão na segurança do trânsito escolar.',audience:'Alunos, educadores, instrutores e equipes escolares, conforme perfil de acesso.',source:'Formação complementar SIGES/ENAT; alinhada ao eixo comportamental do Programa de Segurança no Trânsito Escolar.',modules:neuroModules,certification:'Certificado ENAT como curso livre, com registro de módulos estudados e código interno de verificação.'};
  [guide,nexus,neuro].forEach(course=>{const old=existing.get(course.slug); if(old){Object.assign(old,course); } else {db.courses.push(course);}});
  return db.courses;
}
function ensureGuideCourse(db){ return ensureCourses(db).find(c=>c.slug==='pre-formacao-aluno-guia'); }
app.get('/api/courses',auth,(req,res)=>{const db=read();const courses=ensureCourses(db);write(db);res.json({courses:courses.map(c=>({...c,modules:c.modules.map(m=>({...m,lessons:m.lessons?.map(l=>({id:l.id,title:l.title,objective:l.objective}))}))}))});});
app.get('/api/courses/:slug',auth,(req,res)=>{const db=read();const course=ensureCourses(db).find(c=>c.slug===req.params.slug);if(!course)return res.status(404).json({error:'Formação não encontrada.'});write(db);res.json({course});});

app.get('/api/guide',auth,(req,res)=>{
  if(!canManageGuides(req.user)) return res.status(403).json({error:'Seu perfil não pode acessar a gestão de Alunos Guia.'});
  const db=read(),course=ensureGuideCourse(db);
  let students=db.students.filter(s=>s.status==='active');
  if(req.user.role==='escola') students=students.filter(s=>schoolVisibleToUser(req.user,db.schools.find(x=>x.id===s.schoolId)));
  const trainings=db.guideTrainings||[];
  const rows=students.map(s=>{
    const t=trainings.find(x=>x.studentId===s.id);
    const school=db.schools.find(x=>x.id===s.schoolId);
    return {...s,schoolName:school?.name||'Escola não localizada',training:t||null};
  });
  const enrolled=rows.filter(x=>x.training).length;
  const certified=rows.filter(x=>x.training?.status==='certified' || (x.isGuide&&x.guideCertified)).length;
  res.json({course,students:rows,summary:{candidates:rows.length,enrolled,certified}});
});
app.post('/api/guide/:studentId/enroll',auth,(req,res)=>{
  if(!canManageGuides(req.user)) return res.status(403).json({error:'Seu perfil não pode iniciar a formação de Aluno Guia.'});
  const db=read(),student=db.students.find(s=>s.id===req.params.studentId);
  if(!student||student.status!=='active') return res.status(404).json({error:'Aluno ativo não encontrado.'});
  const school=db.schools.find(s=>s.id===student.schoolId);
  if(req.user.role==='escola'&&!schoolVisibleToUser(req.user,school)) return res.status(403).json({error:'Você só pode formar alunos da sua escola.'});
  const course=ensureGuideCourse(db); let t=(db.guideTrainings||[]).find(x=>x.studentId===student.id);
  if(t) return res.json({training:t,course});
  t={id:'agt_'+Date.now(),studentId:student.id,courseId:course.id,status:'enrolled',progress:0,currentLesson:0,hsiTrafficCompleted:false,finalAssessmentScore:null,approved:false,certified:false,enrolledAt:new Date().toISOString(),enrolledBy:req.user.id};
  db.guideTrainings.push(t);audit(db,'GUIDE_TRAINING_STARTED',req.user.id,{studentId:student.id,courseId:course.id});write(db);
  res.status(201).json({training:t,course});
});
app.post('/api/guide/:studentId/progress',auth,(req,res)=>{
  if(!canManageGuides(req.user)) return res.status(403).json({error:'Seu perfil não pode atualizar a formação.'});
  const db=read(),t=(db.guideTrainings||[]).find(x=>x.studentId===req.params.studentId);if(!t)return res.status(404).json({error:'Aluno ainda não está matriculado na pré-formação.'});
  const progress=Math.max(0,Math.min(100,Number(req.body.progress))); const currentLesson=Math.max(0,Number(req.body.currentLesson||0));
  if(!Number.isFinite(progress))return res.status(400).json({error:'Progresso inválido.'});
  t.progress=Math.round(progress);t.currentLesson=currentLesson;t.status=progress>=100?'awaiting_evaluation':'in_progress';t.updatedAt=new Date().toISOString();audit(db,'GUIDE_TRAINING_PROGRESS',req.user.id,{studentId:t.studentId,progress:t.progress});write(db);res.json({training:t});
});

app.get('/api/dashboard',auth,(req,res)=>{
  const db=read();
  const count=(name)=>db[name].length;
  const average=(arr,field)=>{
    const values=arr.map(x=>Number(x[field])).filter(x=>Number.isFinite(x));
    return values.length?Math.round(values.reduce((a,b)=>a+b,0)/values.length):0;
  };
  const users=db.users;
  const schools=count('schools');
  const students=count('students');
  const guides=db.users.filter(u=>u.role==='aluno_guia'&&u.status==='active').length + db.students.filter(s=>s.isGuide===true&&s.guideCertified===true).length;
  const teachers=db.users.filter(u=>u.role==='instrutor'&&u.status==='active').length;
  const schoolManagers=db.users.filter(u=>u.role==='escola'&&u.status==='active').length;
  const hsiTraffic=average(db.hsiTraffic,'score');
  const hsiBullying=average(db.hsiBullying,'score');
  const openRisks=db.risks.filter(x=>x.status!=='closed').length;
  const pendingClaims=db.claims.filter(x=>x.status==='pending' || x.status==='under_review').length;
  const activePlans=db.actionPlans.filter(x=>x.status!=='completed').length;
  const certificates=count('certificates');
  res.json({
    totals:{schools,students,guides,teachers,schoolManagers,hsiTraffic,hsiBullying,openRisks,pendingClaims,activePlans,certificates,courses:count('courses'),assessments:count('assessments')},
    meta:{users:users.length,generatedAt:new Date().toISOString()}
  });
});

app.post('/api/forgot',(req,res)=>{
  const email=String(req.body.email||'').trim().toLowerCase(),db=read(),u=db.users.find(x=>x.email===email);
  if(!u)return res.json({message:'Se a conta existir, a recuperação será processada.'});
  const t='reset_'+Date.now()+'_'+Math.random().toString(36).slice(2);
  db.passwordResets.push({token:t,userId:u.id,expiresAt:Date.now()+1800000});
  audit(db,'PASSWORD_RESET_REQUEST',u.id);write(db);
  res.json({message:'Solicitação registrada.',devToken:t});
});

app.post('/api/reset',async(req,res)=>{
  const {token,password}=req.body;
  if(!token||!password||password.length<6)return res.status(400).json({error:'Token e nova senha são obrigatórios.'});
  const db=read(),r=db.passwordResets.find(x=>x.token===token&&x.expiresAt>Date.now());
  if(!r)return res.status(400).json({error:'Token inválido ou expirado.'});
  const u=db.users.find(x=>x.id===r.userId);u.passwordHash=await bcrypt.hash(password,10);
  db.passwordResets=db.passwordResets.filter(x=>x.token!==token);audit(db,'PASSWORD_RESET',u.id);write(db);
  res.json({message:'Senha redefinida com sucesso.'});
});

app.listen(PORT,()=>{ ensureAdmin(); console.log('SIGES API local: http://localhost:'+PORT); });
