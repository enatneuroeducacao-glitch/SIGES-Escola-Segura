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
  res.json({students:rows.map(x=>({...x,schoolName:db.schools.find(s=>s.id===x.schoolId)?.name||'Escola não localizada'})),schools});
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
function courseLesson(id,title,objective,content,activity){return{id,title,objective,content,activity};}
function ensureCourses(db){
  const existing=new Map((db.courses||[]).map(c=>[c.slug,c]));
  const guide={id:'course_aluno_guia',slug:'pre-formacao-aluno-guia',name:'Pré-formação de Aluno Guia',type:'Curso livre',status:'active',hours:20,description:'Formação inicial para participação segura e cidadã do aluno na identificação de riscos e construção de reivindicações qualificadas.',audience:'Alunos do ensino fundamental, especialmente 6º ao 9º ano.',source:'Apostila Programa de Segurança no Trânsito Escolar – Aluno Guia',modules:[],certification:'Pré-formação de Aluno Guia; certificação ENAT somente após cumprimento das regras de formação e avaliação configuradas.'};
  const nexusPillars=['Consciência situacional','Percepção de risco','Tomada de decisão','Controle veicular','Comunicação eficaz','Regulamentação e legislação','Adaptação e flexibilidade','Inteligência emocional','Responsabilidade social','Aprendizagem contínua','Ergonomia e conforto','Primeiros socorros e resposta a acidentes'];
  const nexus={id:'course_nexus_aluno_guia',slug:'nexus-12-aluno-guia',name:'NEXUS 12 — Atuação do Aluno Guia',type:'Curso livre',status:'active',hours:36,description:'Formação complementar do Aluno Guia.',audience:'Alunos Guias em formação.',source:'NEXUS 12',pillars:nexusPillars,modules:nexusPillars.map((title,i)=>({id:'nx'+(i+1),title,focus:'Atuação do Aluno Guia',lessons:[courseLesson('nx'+(i+1)+'l1','Conceito','Compreender o pilar.',`Aplicar ${title.toLowerCase()} ao cotidiano escolar.`,'Identificar uma situação.'),courseLesson('nx'+(i+1)+'l2','Aplicação','Praticar com segurança.','Exercitar o conceito em cenário supervisionado.','Resolver cenário.'),courseLesson('nx'+(i+1)+'l3','Reflexão','Consolidar decisão consciente.','Refletir sobre risco, decisão e pedido de ajuda.','Registrar justificativa.')] })),certification:'Certificado ENAT como curso livre.'};
  const neuro={id:'course_neuroeducacao_transito_escolar',slug:'neuroeducacao-transito-escolar',name:'Neuroeducação Aplicada ao Trânsito Escolar',type:'Curso livre',status:'active',hours:32,description:'Formação em atenção, emoção, memória, comportamento e tomada de decisão na segurança escolar.',audience:'Alunos, educadores, instrutores e equipes escolares.',source:'Formação SIGES/ENAT',modules:[],certification:'Certificado ENAT como curso livre.'};
  [guide,nexus,neuro].forEach(c=>{const old=existing.get(c.slug);if(old)Object.assign(old,c);else db.courses.push(c);});return db.courses;
}
function ensureGuideCourse(db){return ensureCourses(db).find(c=>c.slug==='pre-formacao-aluno-guia');}
app.get('/api/courses',auth,(req,res)=>{const db=read(),courses=ensureCourses(db);write(db);res.json({courses:courses.map(c=>({...c,modules:c.modules.map(m=>({...m,lessons:m.lessons?.map(l=>({id:l.id,title:l.title,objective:l.objective}))}))}))});});
app.get('/api/courses/:slug',auth,(req,res)=>{const db=read(),course=ensureCourses(db).find(c=>c.slug===req.params.slug);if(!course)return res.status(404).json({error:'Formação não encontrada.'});write(db);res.json({course});});
app.get('/api/guide',auth,(req,res)=>{if(!canManageGuides(req.user))return res.status(403).json({error:'Seu perfil não pode acessar a gestão de Alunos Guia.'});const db=read(),course=ensureGuideCourse(db);let students=db.students.filter(s=>s.status==='active');if(req.user.role==='escola')students=students.filter(s=>schoolVisibleToUser(req.user,db.schools.find(x=>x.id===s.schoolId)));const trainings=db.guideTrainings||[];const rows=students.map(s=>{const t=trainings.find(x=>x.studentId===s.id),school=db.schools.find(x=>x.id===s.schoolId);return{...s,schoolName:school?.name||'Escola não localizada',training:t||null}});res.json({course,students:rows,summary:{candidates:rows.length,enrolled:rows.filter(x=>x.training).length,certified:rows.filter(x=>x.training?.status==='certified'||(x.isGuide&&x.guideCertified)).length}});});
app.post('/api/guide/:studentId/enroll',auth,(req,res)=>{if(!canManageGuides(req.user))return res.status(403).json({error:'Seu perfil não pode iniciar a formação de Aluno Guia.'});const db=read(),student=db.students.find(s=>s.id===req.params.studentId);if(!student||student.status!=='active')return res.status(404).json({error:'Aluno ativo não encontrado.'});const school=db.schools.find(s=>s.id===student.schoolId);if(req.user.role==='escola'&&!schoolVisibleToUser(req.user,school))return res.status(403).json({error:'Você só pode formar alunos da sua escola.'});const course=ensureGuideCourse(db);let t=(db.guideTrainings||[]).find(x=>x.studentId===student.id);if(t)return res.json({training:t,course});t={id:'agt_'+Date.now(),studentId:student.id,courseId:course.id,status:'enrolled',progress:0,currentLesson:0,hsiTrafficCompleted:false,finalAssessmentScore:null,approved:false,certified:false,enrolledAt:new Date().toISOString(),enrolledBy:req.user.id};db.guideTrainings.push(t);audit(db,'GUIDE_TRAINING_STARTED',req.user.id,{studentId:student.id,courseId:course.id});write(db);res.status(201).json({training:t,course});});
app.post('/api/guide/:studentId/progress',auth,(req,res)=>{if(!canManageGuides(req.user))return res.status(403).json({error:'Seu perfil não pode atualizar a formação.'});const db=read(),t=(db.guideTrainings||[]).find(x=>x.studentId===req.params.studentId);if(!t)return res.status(404).json({error:'Aluno ainda não está matriculado na pré-formação.'});const progress=Math.max(0,Math.min(100,Number(req.body.progress)));const currentLesson=Math.max(0,Number(req.body.currentLesson||0));if(!Number.isFinite(progress))return res.status(400).json({error:'Progresso inválido.'});t.progress=Math.round(progress);t.currentLesson=currentLesson;t.status=progress>=100?'awaiting_evaluation':'in_progress';t.updatedAt=new Date().toISOString();audit(db,'GUIDE_TRAINING_PROGRESS',req.user.id,{studentId:t.studentId,progress:t.progress});write(db);res.json({training:t});});
app.get('/api/dashboard',auth,(req,res)=>{const db=read(),count=n=>db[n].length,average=(arr,field)=>{const values=arr.map(x=>Number(x[field])).filter(x=>Number.isFinite(x));return values.length?Math.round(values.reduce((a,b)=>a+b,0)/values.length):0};const users=db.users,schools=count('schools'),students=count('students'),guides=db.users.filter(u=>u.role==='aluno_guia'&&u.status==='active').length+db.students.filter(s=>s.isGuide===true&&s.guideCertified===true).length,teachers=db.users.filter(u=>u.role==='instrutor'&&u.status==='active').length,schoolManagers=db.users.filter(u=>u.role==='escola'&&u.status==='active').length,hsiTraffic=average(db.hsiTraffic,'score'),hsiBullying=average(db.hsiBullying,'score'),openRisks=db.risks.filter(x=>x.status!=='closed').length,pendingClaims=db.claims.filter(x=>x.status==='pending'||x.status==='under_review').length,activePlans=db.actionPlans.filter(x=>x.status!=='completed').length,certificates=count('certificates');res.json({totals:{schools,students,guides,teachers,schoolManagers,hsiTraffic,hsiBullying,openRisks,pendingClaims,activePlans,certificates,courses:count('courses'),assessments:count('assessments')},meta:{users:users.length,generatedAt:new Date().toISOString()}});});
app.post('/api/forgot',(req,res)=>{const email=String(req.body.email||'').trim().toLowerCase(),db=read(),u=db.users.find(x=>x.email===email);if(!u)return res.json({message:'Se a conta existir, a recuperação será processada.'});const t='reset_'+Date.now()+'_'+Math.random().toString(36).slice(2);db.passwordResets.push({token:t,userId:u.id,expiresAt:Date.now()+1800000});audit(db,'PASSWORD_RESET_REQUEST',u.id);write(db);res.json({message:'Solicitação registrada.',devToken:t});});
app.post('/api/reset',async(req,res)=>{const{token,password}=req.body;if(!token||!password||password.length<6)return res.status(400).json({error:'Token e nova senha são obrigatórios.'});const db=read(),r=db.passwordResets.find(x=>x.token===token&&x.expiresAt>Date.now());if(!r)return res.status(400).json({error:'Token inválido ou expirado.'});const u=db.users.find(x=>x.id===r.userId);u.passwordHash=await bcrypt.hash(password,10);db.passwordResets=db.passwordResets.filter(x=>x.token!==token);audit(db,'PASSWORD_RESET',u.id);write(db);res.json({message:'Senha redefinida com sucesso.'});});

app.listen(PORT,()=>{ensureAdmin();console.log('SIGES API local: http://localhost:'+PORT);});
