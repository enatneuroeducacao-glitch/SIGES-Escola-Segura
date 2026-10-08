const express=require('express');
const cors=require('cors');
const fs=require('fs');
const path=require('path');
const zlib=require('zlib');
const crypto=require('crypto');
const bcrypt=require('bcryptjs');
const jwt=require('jsonwebtoken');
const buildPublicSourcesRouter=require('./public-sources');

const app=express();
const PORT=Number(process.env.PORT)||3001;
const SECRET=process.env.SIGES_SECRET||'SIGES_LOCAL_ONLY_CHANGE_BEFORE_PRODUCTION';
const DB=path.join(__dirname,'data','db.json');

function ensureValidationTestUsers(){
  if(process.env.SIGES_TEST_USERS_ENABLED!=='true') return;
  const db=read();
  const schoolToken=String(process.env.SIGES_TEST_SCHOOL_TOKEN||'ES-TEST-ESCOLA').trim(), schoolPassword=String(process.env.SIGES_TEST_SCHOOL_PASSWORD||'Teste@2026').trim();
  const studentToken=String(process.env.SIGES_TEST_STUDENT_TOKEN||'ES-TEST-ALUNO').trim(), studentPassword=String(process.env.SIGES_TEST_STUDENT_PASSWORD||'Teste@2026').trim();
  if(!schoolToken||!schoolPassword||!studentToken||!studentPassword) return;
  const schoolUserId='usr_test_school_validation', studentUserId='usr_test_student_validation';
  let school=db.schools.find(x=>x.id==='sch_test_validation');
  if(!school){
    const catalog=sigesSchoolCatalog(db);
    const selected=catalog[0]||{id:'sch_test_validation',name:'Escola Segura — Ambiente de Validação',municipality:'Joinville',uf:'SC',bairro:'',address:'',category:'Teste'};
    school={id:'sch_test_validation',sigesId:selected.id,name:selected.name,inep:'TESTE',municipality:selected.municipality||'Joinville',uf:selected.uf||'SC',bairro:selected.bairro||'',address:selected.address||'',category:selected.category||'Teste',source:'SIGES',managerName:'Usuário de Validação',managerEmail:'',managerUserId:schoolUserId,status:'active',createdAt:new Date().toISOString(),createdBy:'bootstrap'};
    db.schools.push(school);
  }else{school.status='active';school.managerUserId=schoolUserId;}
  let su=db.users.find(x=>x.id===schoolUserId);
  if(!su) su={id:schoolUserId,role:'escola',name:'Usuário Escola — Validação',email:'',username:'TEST-SCHOOL',accessTokenHash:crypto.createHash('sha256').update(schoolToken).digest('hex'),accessTokenIssuedAt:new Date().toISOString(),passwordHash:bcrypt.hashSync(schoolPassword,10),status:'active',authMethod:'token',profile:{schoolId:school.id,schoolName:school.name},createdAt:new Date().toISOString()};
  else {su.accessTokenHash=crypto.createHash('sha256').update(schoolToken).digest('hex');su.passwordHash=bcrypt.hashSync(schoolPassword,10);su.status='active';su.profile={...(su.profile||{}),schoolId:school.id,schoolName:school.name};}
  if(!db.users.includes(su)) db.users.push(su);
  school.managerUserId=su.id;
  let student=db.students.find(x=>x.id==='std_test_validation');
  if(!student) student={id:'std_test_validation',userId:studentUserId,name:'Aluno de Validação',birthDate:'2012-05-10',schoolId:school.id,grade:'8º ano',className:'Turma de Validação',shift:'Matutino',responsibleName:'Responsável de Teste',responsibleContact:'',status:'pending',isGuide:false,guideCertified:false,createdAt:new Date().toISOString(),createdBy:'bootstrap'};
  else {student.schoolId=school.id;if(!['active','rejected'].includes(student.status)) student.status='pending';}
  if(!db.students.includes(student)) db.students.push(student);
  let stu=db.users.find(x=>x.id===studentUserId);
  if(!stu) stu={id:studentUserId,role:'aluno',name:'Aluno de Validação',email:'',username:'TEST-STUDENT',accessTokenHash:crypto.createHash('sha256').update(studentToken).digest('hex'),accessTokenIssuedAt:new Date().toISOString(),passwordHash:bcrypt.hashSync(studentPassword,10),status:'pending_school',emailVerifiedAt:null,authMethod:'school_validation',requiresSchoolValidation:true,riskScore:1,riskFlags:['teste_validacao_escolar'],validationReason:'Cadastro de teste para validação pela escola',profile:{birthDate:'2012-05-10',grade:'8º ano',className:'Turma de Validação',shift:'Matutino',schoolId:school.id,studentId:student.id},createdAt:new Date().toISOString()};
  else {stu.accessTokenHash=crypto.createHash('sha256').update(studentToken).digest('hex');stu.passwordHash=bcrypt.hashSync(studentPassword,10);if(!['active','rejected'].includes(stu.status)) stu.status='pending_school';stu.authMethod='school_validation';stu.requiresSchoolValidation=true;stu.profile={...(stu.profile||{}),schoolId:school.id,studentId:student.id};}
  if(!db.users.includes(stu)) db.users.push(stu);
  audit(db,'TEST_USERS_BOOTSTRAPPED',null,{schoolUserId,studentUserId});
  write(db);
}
function ensureAdmin(){
  const db=read();
  const initialPassword=String(process.env.SIGES_ADMIN_INITIAL_PASSWORD||'SIGES2026');
  let u=db.users.find(x=>x.role==='enat' && (x.username==='admin' || x.email==='admin'));
  if(!u){
    u={id:'usr_admin_local',role:'enat',username:'admin',name:'Administrador ENAT',email:'admin',passwordHash:bcrypt.hashSync(initialPassword,12),status:'active',profile:{institution:'ENAT'},createdAt:new Date().toISOString(),mustChangePassword:true};
    db.users.push(u);
    audit(db,'ADMIN_BOOTSTRAP',u.id,{username:'admin',temporaryPassword:true});
    write(db);
    console.log('Administrador SIGES criado com credencial inicial configurada.');
    return;
  }
  // A senha inicial só pode ser reaplicada enquanto a conta ainda exige troca.
  // Depois que o administrador define sua senha definitiva, não sobrescrevemos a conta.
  if(u.mustChangePassword===true){
    const nextHash=bcrypt.hashSync(initialPassword,12);
    if(!bcrypt.compareSync(initialPassword,u.passwordHash||'')){
      u.passwordHash=nextHash;
      u.status='active';
      audit(db,'ADMIN_BOOTSTRAP_CREDENTIAL_SYNC',u.id,{username:'admin',temporaryPassword:true});
      write(db);
    }
  }
}

app.use(cors({origin:(process.env.CORS_ORIGIN||'*'),credentials:false,methods:['GET','POST','PATCH','PUT','DELETE','OPTIONS'],allowedHeaders:['Content-Type','Authorization']}));
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
  if(!fs.existsSync(DB)){
    fs.mkdirSync(path.dirname(DB),{recursive:true});
    fs.writeFileSync(DB,JSON.stringify({
      users:[],audit:[],passwordResets:[],emailVerifications:[],schools:[],students:[],courses:[],enrollments:[],guideTrainings:[],materials:[],
      assessments:[],hsiTraffic:[],hsiBullying:[],risks:[],claims:[],actionPlans:[],evidences:[],audits:[],certificates:[],
      observations:[],studentProgress:[],settings:defaultSettings()
    },null,2));
  }
  const db=JSON.parse(fs.readFileSync(DB,'utf8'));
  if(!db.settings) db.settings=defaultSettings();
  for(const key of ['users','audit','passwordResets','emailVerifications','schools','students','courses','enrollments','guideTrainings','materials','assessments','hsiTraffic','hsiBullying','risks','claims','actionPlans','evidences','audits','certificates','observations','studentProgress']){
    if(!Array.isArray(db[key])) db[key]=[];
  }
  return db;
}
function write(db){fs.writeFileSync(DB,JSON.stringify(db,null,2))}
function safe(u){const {passwordHash,accessTokenHash,...x}=u;return x}
function token(u){return jwt.sign({id:u.id,role:u.role},SECRET,{expiresIn:'8h'})}
function audit(db,action,userId,details={}){db.audit.push({id:Date.now().toString(),action,userId,details,at:new Date().toISOString()})}
const APP_URL=(process.env.PUBLIC_APP_URL||'https://escola-segura.hsi-doth-pg.com.br').replace(/\/$/,'');
const RESEND_FROM=process.env.RESEND_FROM||'Escola Segura <suporte@hsi-doth-pg.com.br>';
async function sendEmail({to,subject,html}){
  if(!process.env.RESEND_API_KEY){console.warn('RESEND_API_KEY não configurada; e-mail não enviado para',to);return {ok:false,configured:false};}
  try{
    const r=await fetch('https://api.resend.com/emails',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+process.env.RESEND_API_KEY},body:JSON.stringify({from:RESEND_FROM,to:[to],subject,html,tags:[{name:'category',value:'escola_segura'}]})});
    const body=await r.json().catch(()=>({}));
    if(!r.ok){console.error('Resend error',r.status,body);return {ok:false,configured:true,error:body};}
    return {ok:true,configured:true,id:body.id||null};
  }catch(error){console.error('Resend exception',error.message);return {ok:false,configured:true,error:{message:error.message}};}
}
function createAccessCredential(){
  const raw='ES-'+crypto.randomBytes(12).toString('hex').toUpperCase();
  return {raw,hash:crypto.createHash('sha256').update(raw).digest('hex')};
}
function studentRiskAssessment({name,email,profile,school}){
  const flags=[];
  const cleanName=String(name||'').trim();
  if(cleanName.split(/\s+/).filter(Boolean).length<2) flags.push('nome_incompleto');
  if(!school) flags.push('escola_nao_localizada');
  if(!email) flags.push('sem_email');
  const birth=String(profile?.birthDate||'');
  if(birth){
    const age=(Date.now()-new Date(birth+'T00:00:00').getTime())/(365.2425*86400000);
    if(!Number.isFinite(age)||age<5||age>25) flags.push('faixa_etaria_incompativel');
    if(age<18&&!String(profile?.responsibleContact||'').trim()) flags.push('responsavel_sem_contato');
  }
  const grade=String(profile?.grade||'').trim().toLowerCase();
  if(/^(faculdade|superior|pos|pós|universidade)/.test(grade)) flags.push('etapa_incompativel');
  return {score:flags.length,flags,suspicious:flags.length>0};
}
function findUserByAccessCredential(db,raw){
  const hash=crypto.createHash('sha256').update(String(raw||'')).digest('hex');
  return db.users.find(x=>x.accessTokenHash===hash);
}
function createEmailVerification(db,u){
  db.emailVerifications=db.emailVerifications||[];
  db.emailVerifications=db.emailVerifications.filter(x=>x.userId!==u.id);
  const raw=crypto.randomBytes(32).toString('hex');
  const tokenHash=crypto.createHash('sha256').update(raw).digest('hex');
  db.emailVerifications.push({id:'ev_'+Date.now(),userId:u.id,tokenHash,expiresAt:Date.now()+86400000,createdAt:new Date().toISOString()});
  return raw;
}
async function sendVerificationEmail(u,raw){
  const url=APP_URL+'/verificar-email?token='+encodeURIComponent(raw);
  return sendEmail({to:u.email,subject:'Confirme seu e-mail — Escola Segura do Aluno',html:`<div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;padding:32px;color:#18324a"><h1 style="margin:0 0 12px">🛡️ Escola Segura do Aluno</h1><p>Olá, <b>${u.name}</b>.</p><p>Recebemos seu cadastro. Para confirmar que este e-mail pertence a você, clique no botão abaixo:</p><p><a href="${url}" style="display:inline-block;padding:13px 20px;background:#173f68;color:#fff;text-decoration:none;border-radius:8px">Confirmar meu e-mail</a></p><p>Depois da confirmação, seu cadastro seguirá para a validação do vínculo escolar e, quando necessário, da Administração SIGES.</p><p style="font-size:12px;color:#667">Este link é válido por 24 horas.</p></div>`});
}
function auth(req,res,next){
  const h=req.headers.authorization||'',t=h.replace(/^Bearer\s+/i,'');
  try{
    const p=jwt.verify(t,SECRET),db=read(),u=db.users.find(x=>x.id===p.id);
    if(!u||u.status!=='active') throw new Error();
    req.user=u;next();
  }catch{res.status(401).json({error:'Sessão inválida.'})}
}

app.get('/api/health',(req,res)=>res.json({ok:true,system:'SIGES',mode:'local'}));
app.use('/api/public-sources',buildPublicSourcesRouter());

function stableSchoolId(name,address){
  const raw=normTerritory(String(name||'')+'|'+String(address||''));
  let h=2166136261;
  for(let i=0;i<raw.length;i++){h^=raw.charCodeAt(i);h=Math.imul(h,16777619);}
  return 'siges_'+(h>>>0).toString(36);
}
function sigesSchoolCatalog(db){
  const data=readSigesTerritory();
  if(!data?.matrix?.length) return db.schools.filter(s=>s.status==='active').map(s=>({id:s.id,name:s.name,municipality:s.municipality,uf:s.uf,bairro:s.bairro,address:s.address||'',category:s.category||'',source:'SIGES'}));
  const seen=new Map();
  for(const x of data.matrix){
    const name=String(x.Unidade||'').trim(),address=String(x['Endereço']||'').trim();
    if(!name) continue;
    const id=stableSchoolId(name,address);
    if(!seen.has(id)) seen.set(id,{id,name,municipality:'Joinville',uf:'SC',bairro:String(x.Bairro||'').trim(),address,category:String(x.Categoria||x.categoria||'').trim(),source:'SIGES',registered:false,status:'catalog'});
  }
  const catalog=[...seen.values()];
  for(const item of catalog){
    const existing=db.schools.find(s=>s.sigesId===item.id || (normTerritory(s.name)===normTerritory(item.name)&&normTerritory(s.address)===normTerritory(item.address)));
    if(existing){item.id=existing.id;item.registered=true;item.status=existing.status;item.category=existing.category||item.category;}
  }
  return catalog.sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'));
}
app.get('/api/public-schools',(req,res)=>{
  const db=read(),q=normTerritory(req.query.q||'');
  let schools=sigesSchoolCatalog(db);
  if(q) schools=schools.filter(s=>normTerritory([s.name,s.bairro,s.address,s.municipality].join(' ')).includes(q));
  res.json({schools:schools.slice(0,1000),source:'SIGES — Matriz Territorial 3.2'});
});

app.post('/api/register',async(req,res)=>{
  const {role,name,email,password,profile={}}=req.body;
  const allowed=['aluno','aluno_guia','instrutor','escola','auditor','transito','educacao','prefeitura'];
  if(!allowed.includes(role)) return res.status(400).json({error:'Perfil inválido. A conta ENAT/Administração é criada somente pelo procedimento administrativo local.'});
  if(!name||!password||password.length<6) return res.status(400).json({error:'Preencha os dados obrigatórios. A senha deve ter pelo menos 6 caracteres.'});
  const db=read(),e=String(email||'').trim().toLowerCase();
  const emailProvided=Boolean(e);
  const schoolValidation=!emailProvided && ['aluno','aluno_guia'].includes(role);
  if(!emailProvided&&!schoolValidation) return res.status(400).json({error:'Para este perfil, o e-mail é obrigatório.'});
  if(emailProvided&&db.users.some(u=>u.email===e)) return res.status(409).json({error:'Este e-mail já está cadastrado.'});
  const access=createAccessCredential();
  const u={id:'usr_'+Date.now(),role,name:name.trim(),email:e,username:'ALU-'+crypto.randomBytes(4).toString('hex').toUpperCase(),accessTokenHash:access.hash,accessTokenIssuedAt:new Date().toISOString(),passwordHash:await bcrypt.hash(password,10),status:schoolValidation?'pending_school':'pending_email',emailVerifiedAt:null,authMethod:schoolValidation?'school_validation':'token',profile,createdAt:new Date().toISOString()};
  if(role==='escola'){
    let school=null;
    if(profile.sigesSchoolId){
      const catalog=sigesSchoolCatalog(db);
      const selected=catalog.find(x=>x.id===profile.sigesSchoolId || x.sigesId===profile.sigesSchoolId);
      if(!selected)return res.status(400).json({error:'Selecione uma escola válida no SIGES.'});
      school=db.schools.find(x=>x.id===selected.id);
      if(!school){
        school={id:'sch_'+Date.now(),sigesId:profile.sigesSchoolId,name:selected.name,inep:String(profile.inep||'').trim(),municipality:selected.municipality,uf:selected.uf,bairro:selected.bairro,address:selected.address,category:selected.category||'',source:'SIGES',managerName:name.trim(),managerEmail:e,managerUserId:u.id,status:'pending',createdAt:new Date().toISOString(),createdBy:u.id};
        db.schools.push(school);
      }else{
        school.managerName=name.trim();school.managerEmail=e;school.managerUserId=u.id;school.status='pending';
      }
    }else{
      school={id:'sch_'+Date.now(),name:String(profile.schoolName||name+' — Escola').trim(),inep:String(profile.inep||'').trim(),municipality:String(profile.municipality||'').trim(),uf:String(profile.uf||'').trim().toUpperCase(),bairro:String(profile.bairro||'').trim(),address:String(profile.address||'').trim(),managerName:name.trim(),managerEmail:e,managerUserId:u.id,status:'pending',createdAt:new Date().toISOString(),createdBy:u.id};
      db.schools.push(school);
    }
    u.profile={...profile,schoolId:school.id};
  }
  if(role==='aluno'||role==='aluno_guia'){
    let school=db.schools.find(s=>s.id===profile.schoolId);
    if(!school && profile.schoolId){
      const catalog=sigesSchoolCatalog(db);
      const selected=catalog.find(x=>x.id===profile.schoolId);
      if(selected){
        school={id:'sch_'+Date.now(),sigesId:selected.id,name:selected.name,inep:'',municipality:selected.municipality,uf:selected.uf,bairro:selected.bairro,address:selected.address,category:selected.category||'',source:'SIGES',managerName:'',managerEmail:'',managerUserId:null,status:'pending',createdAt:new Date().toISOString(),createdBy:'SIGES'};
        db.schools.push(school);
      }
    }
    if(!school)return res.status(400).json({error:'Selecione uma escola válida no SIGES.'});
    const student={id:'std_'+Date.now(),userId:u.id,name:name.trim(),birthDate:String(profile.birthDate||''),schoolId:school.id,grade:String(profile.grade||'').trim(),className:String(profile.className||'').trim(),shift:String(profile.shift||'').trim(),responsibleName:String(profile.responsibleName||'').trim(),responsibleContact:String(profile.responsibleContact||'').trim(),status:'pending',isGuide:role==='aluno_guia',guideCertified:false,createdAt:new Date().toISOString(),createdBy:u.id};
    if(!student.birthDate||!student.grade||!student.className)return res.status(400).json({error:'Data de nascimento, série/etapa e turma são obrigatórios.'});
    const risk=studentRiskAssessment({name,email:e,profile,school});
    u.riskScore=risk.score;
    u.riskFlags=risk.flags;
    u.requiresSchoolValidation=schoolValidation||risk.suspicious;
    u.validationReason=risk.suspicious?'Cadastro classificado para validação escolar adicional':'';
    db.students.push(student);u.profile={...profile,schoolId:school.id,studentId:student.id};
  }
  db.users.push(u);
  if(schoolValidation){
    audit(db,'REGISTER',u.id,{role,schoolValidationRequired:true});
    write(db);
    return res.status(201).json({message:'Cadastro recebido. A escola irá validar seu vínculo antes de liberar o acesso.',emailVerificationSent:false,schoolValidationRequired:true,accessToken:access.raw,accessCode:u.username,user:safe(u)});
  }
  const verificationToken=createEmailVerification(db,u);
  audit(db,'REGISTER',u.id,{role,emailVerificationPending:true});
  write(db);
  const mail=await sendVerificationEmail(u,verificationToken);
  res.status(201).json({message:mail.configured?(u.requiresSchoolValidation?'Cadastro criado. Confirme o e-mail. Como medida de segurança, a escola também precisará validar seu vínculo.':'Cadastro criado. Confirme seu e-mail para ativar o acesso.'):'Cadastro criado. O e-mail de confirmação será enviado assim que o serviço de e-mail estiver configurado.',emailVerificationSent:mail.ok,schoolValidationRequired:Boolean(u.requiresSchoolValidation),accessToken:access.raw,user:safe(u)});

});

app.post('/api/use-school-validation',async(req,res)=>{
  const email=String(req.body.email||'').trim().toLowerCase();
  const password=String(req.body.password||'');
  if(!email||!password)return res.status(400).json({error:'Informe o e-mail e a senha usados no cadastro.'});

  const db=read(),u=db.users.find(x=>x.email===email);
  if(!u||!(await bcrypt.compare(password,u.passwordHash)))return res.status(401).json({error:'E-mail ou senha inválidos.'});
  if(!['aluno','aluno_guia'].includes(u.role))return res.status(403).json({error:'A validação pela escola está disponível somente para alunos.'});
  if(u.status==='active')return res.status(400).json({error:'Esta conta já está ativa.'});
  if(u.status!=='pending_email')return res.status(400).json({error:'Esta conta não está aguardando confirmação de e-mail.'});

  u.username=u.username||'ALU-'+crypto.randomBytes(4).toString('hex').toUpperCase();
  u.authMethod='school_validation';
  u.status='pending_school';
  audit(db,'SCHOOL_VALIDATION_SELECTED',u.id,{role:u.role});
  write(db);
  res.json({message:'Validação por escola ativada. Aguarde a confirmação do seu vínculo escolar.',accessCode:u.username,user:safe(u)});
});

app.post('/api/login',async(req,res)=>{
  ensureValidationTestUsers();
  const identifier=String(req.body.identifier||req.body.login||req.body.token||'').trim(),password=String(req.body.password||'');
  if(!identifier||!password)return res.status(400).json({error:'Login e senha são obrigatórios.'});
  const db=read();
  const byLogin=db.users.find(x=>{
    const login=String(x.username||'').trim().toLowerCase();
    const email=String(x.email||'').trim().toLowerCase();
    return login===identifier.toLowerCase()||email===identifier.toLowerCase();
  });
  const byToken=findUserByAccessCredential(db,identifier);
  const u=byLogin||byToken;
  if(!u||!(await bcrypt.compare(password,u.passwordHash))) return res.status(401).json({error:'Login ou senha inválidos.'});
  if(u.status!=='active'){
    const messages={pending_email:u.requiresSchoolValidation?'Confirme seu e-mail. Depois, a escola deverá validar seu vínculo por segurança.':'Confirme seu e-mail para ativar o acesso.',pending_school:'Seu cadastro foi classificado para validação escolar adicional. A escola precisa confirmar seu vínculo antes do primeiro acesso.',pending_admin:'Seu e-mail foi confirmado. O acesso ainda aguarda validação administrativa.',pending:'Seu cadastro ainda aguarda validação do vínculo escolar.',rejected:'Este cadastro foi recusado. Entre em contato com o suporte.',blocked:'Esta conta está bloqueada.'};
    return res.status(403).json({code:u.status,error:messages[u.status]||'Esta conta ainda aguarda validação.',emailVerified:Boolean(u.emailVerifiedAt)});
  }
  audit(db,'LOGIN',u.id,{role:u.role});write(db);
  res.json({token:token(u),user:safe(u)});
});

app.get('/api/me',auth,(req,res)=>res.json({user:safe(req.user)}));

app.get('/api/verify-email',async(req,res)=>{
  const raw=String(req.query.token||'');
  if(!raw)return res.status(400).json({error:'Link de confirmação inválido.'});
  const db=read(),hash=crypto.createHash('sha256').update(raw).digest('hex');
  const item=db.emailVerifications.find(x=>x.tokenHash===hash&&x.expiresAt>Date.now());
  if(!item)return res.status(400).json({error:'Este link é inválido ou expirou. Solicite um novo e-mail de confirmação.'});
  const u=db.users.find(x=>x.id===item.userId);
  if(!u)return res.status(404).json({error:'Conta não localizada.'});
  u.emailVerifiedAt=new Date().toISOString();
  if(u.role==='escola')u.status='pending_admin';
  else if(['aluno','aluno_guia'].includes(u.role))u.status=u.requiresSchoolValidation?'pending_school':'active';
  else u.status='active';
  db.emailVerifications=db.emailVerifications.filter(x=>x.id!==item.id);
  audit(db,'EMAIL_VERIFIED',u.id,{role:u.role});
  write(db);
  res.json({ok:true,status:u.status,message:u.role==='escola'?'E-mail confirmado. Seu cadastro aguarda validação administrativa.':u.requiresSchoolValidation?'E-mail confirmado. Por segurança, a escola ainda precisa validar seu vínculo.':'E-mail confirmado. Seu acesso foi liberado.'});
});
app.post('/api/resend-verification',async(req,res)=>{
  const email=String(req.body.email||'').trim().toLowerCase();
  const db=read(),u=db.users.find(x=>x.email===email);
  if(!u)return res.json({message:'Se o cadastro existir, enviaremos uma nova confirmação.'});
  if(u.emailVerifiedAt)return res.json({message:'Este e-mail já foi confirmado.'});
  const raw=createEmailVerification(db,u);write(db);
  const mail=await sendVerificationEmail(u,raw);
  res.json({message:mail.ok?'Nova confirmação enviada.':'Não foi possível enviar agora. Tente novamente mais tarde.',sent:mail.ok});
});

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

app.get('/api/admin/access-requests',auth,(req,res)=>{
  if(req.user.role!=='enat')return res.status(403).json({error:'Acesso restrito à Administração ENAT.'});
  const db=read();
  const rows=db.users.filter(u=>['pending_email','pending_school','pending_admin','pending'].includes(u.status)).map(u=>{
    const school=u.profile?.schoolId?db.schools.find(s=>s.id===u.profile.schoolId):null;
    const student=u.profile?.studentId?db.students.find(s=>s.id===u.profile.studentId):null;
    return {id:u.id,role:u.role,name:u.name,email:u.email,status:u.status,emailVerified:Boolean(u.emailVerifiedAt),createdAt:u.createdAt,school:school?{id:school.id,name:school.name,status:school.status}:null,student:student?{id:student.id,name:student.name,status:student.status,grade:student.grade,className:student.className}:null};
  });
  res.json({requests:rows});
});
app.post('/api/admin/access-requests/:id/decision',auth,async(req,res)=>{
  if(req.user.role!=='enat')return res.status(403).json({error:'Acesso restrito à Administração ENAT.'});
  const db=read(),u=db.users.find(x=>x.id===req.params.id);
  if(!u)return res.status(404).json({error:'Solicitação não encontrada.'});
  const decision=req.body?.decision;
  if(!['approve','reject'].includes(decision))return res.status(400).json({error:'Decisão inválida.'});
  if(decision==='reject'){u.status='rejected';u.validationNotes=String(req.body?.notes||'').trim();u.validatedBy=req.user.id;u.validatedAt=new Date().toISOString();audit(db,'ACCESS_REJECTED',req.user.id,{targetUserId:u.id,role:u.role});write(db);if(u.email)await sendEmail({to:u.email,subject:'Atualização do cadastro — Escola Segura',html:`<p>Olá, <b>${u.name}</b>.</p><p>Seu cadastro na Escola Segura não foi aprovado neste momento.</p><p>${u.validationNotes||'Entre em contato com o suporte para orientações.'}</p>`});return res.json({user:safe(u)});}
  if(!u.emailVerifiedAt&&u.authMethod!=='school_validation')return res.status(400).json({error:'O e-mail do usuário ainda não foi confirmado.'});
  if(u.role==='escola'){
    const school=db.schools.find(s=>s.id===u.profile?.schoolId);
    if(!school)return res.status(400).json({error:'Unidade escolar não localizada.'});
    school.status='active';school.validatedBy=req.user.id;school.validatedAt=new Date().toISOString();
  }
  if(['aluno','aluno_guia'].includes(u.role)){
    const student=db.students.find(s=>s.id===u.profile?.studentId);
    if(!student)return res.status(400).json({error:'Registro escolar do aluno não localizado.'});
    student.status='active';student.schoolValidatedAt=new Date().toISOString();student.validatedBy=req.user.id;
  }
  u.status='active';u.validatedBy=req.user.id;u.validatedAt=new Date().toISOString();
  audit(db,'ACCESS_APPROVED',req.user.id,{targetUserId:u.id,role:u.role});
  write(db);
  if(u.email) await sendEmail({to:u.email,subject:'Acesso liberado — Escola Segura do Aluno',html:`<div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;padding:28px;color:#18324a"><h2>🛡️ Acesso liberado</h2><p>Olá, <b>${u.name}</b>.</p><p>Seu cadastro foi validado pela Administração SIGES e seu acesso à Escola Segura está liberado.</p><p><a href="${APP_URL}/${u.role==='escola'?'escola':'aluno'}">Acessar a plataforma</a></p></div>`});
  res.json({user:safe(u)});
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


// Integração administrativa SIGES ↔ Escola Segura.
// Esta camada é aditiva: não altera os registros territoriais existentes.
function canManageSchoolPortal(user){return user?.role==='enat'}

function materialView(m){
  return {
    id:m.id,title:m.title,description:m.description||'',type:m.type||'texto',
    content:m.content||'',url:m.url||'',audience:m.audience||'todos',
    schoolIds:Array.isArray(m.schoolIds)?m.schoolIds:[],
    courseId:m.courseId||'',status:m.status||'published',
    createdAt:m.createdAt,updatedAt:m.updatedAt||m.createdAt
  };
}

app.get('/api/admin/school-portal',auth,(req,res)=>{
  if(!canManageSchoolPortal(req.user))return res.status(403).json({error:'Acesso restrito à Administração SIGES.'});
  const db=read();
  const activeStudents=db.students.filter(s=>s.status==='active');
  const pendingStudents=db.students.filter(s=>!['active','rejected'].includes(s.status));
  const activeSchools=db.schools.filter(s=>s.status==='active');
  const pendingSchools=db.schools.filter(s=>s.status!=='active');
  const claims=db.claims||[], observations=db.observations||[];
  const progress=db.studentProgress||[], trainings=db.guideTrainings||[];
  const recentClaims=claims.slice().sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||''))).slice(0,10).map(x=>{
    const st=db.students.find(s=>s.id===x.studentId), sc=db.schools.find(s=>s.id===x.schoolId);
    return {id:x.id,title:x.title,category:x.category,status:x.status,createdAt:x.createdAt,studentName:st?.name||'Aluno',schoolName:sc?.name||'Escola'};
  });
  const recentObservations=observations.slice().sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||''))).slice(0,10).map(x=>{
    const st=db.students.find(s=>s.id===x.studentId), sc=db.schools.find(s=>s.id===x.schoolId);
    return {id:x.id,category:x.category,status:x.status,createdAt:x.createdAt,studentName:st?.name||'Aluno',schoolName:sc?.name||'Escola'};
  });
  const schoolRows=activeSchools.map(sc=>{
    const ss=db.students.filter(s=>s.schoolId===sc.id);
    const ids=new Set(ss.map(s=>s.id));
    const completed=progress.filter(p=>ids.has(p.studentId)&&p.completed).length;
    const guide= trainings.filter(t=>ids.has(t.studentId));
    return {id:sc.id,name:sc.name,municipality:sc.municipality,uf:sc.uf,students:ss.length,activeStudents:ss.filter(s=>s.status==='active').length,pendingStudents:ss.filter(s=>s.status!=='active'&&s.status!=='rejected').length,lessonsCompleted:completed,guides:guide.length};
  });
  res.json({
    summary:{
      schools:activeSchools.length,students:activeStudents.length,pendingStudents:pendingStudents.length,
      pendingSchools:pendingSchools.length,claimsPending:claims.filter(x=>x.status==='pending'||x.status==='under_review').length,
      observations:observations.length,lessonsCompleted:progress.filter(x=>x.completed).length,
      guideTrainings:trainings.length,materials:db.materials.length
    },
    schools:schoolRows,
    recentClaims,recentObservations,
    materials:db.materials.slice().sort((a,b)=>String(b.updatedAt||b.createdAt||'').localeCompare(String(a.updatedAt||a.createdAt||''))).map(materialView)
  });
});

app.get('/api/admin/materials',auth,(req,res)=>{
  if(!canManageSchoolPortal(req.user))return res.status(403).json({error:'Acesso restrito à Administração SIGES.'});
  const db=read();
  res.json({materials:db.materials.slice().sort((a,b)=>String(b.updatedAt||b.createdAt||'').localeCompare(String(a.updatedAt||a.createdAt||''))).map(materialView)});
});

app.post('/api/admin/materials',auth,(req,res)=>{
  if(!canManageSchoolPortal(req.user))return res.status(403).json({error:'Acesso restrito à Administração SIGES.'});
  const db=read(),body=req.body||{};
  const title=String(body.title||'').trim(),description=String(body.description||'').trim(),content=String(body.content||'').trim(),url=String(body.url||'').trim();
  if(!title)return res.status(400).json({error:'Informe o título do material.'});
  if(!content&&!url)return res.status(400).json({error:'Informe o conteúdo ou um link do material.'});
  const allowedTypes=['texto','link','atividade','referencia'];
  const type=allowedTypes.includes(body.type)?body.type:'texto';
  const allowedAudience=['todos','alunos','escolas'];
  const audience=allowedAudience.includes(body.audience)?body.audience:'alunos';
  const schoolIds=Array.isArray(body.schoolIds)?body.schoolIds.map(String).filter(Boolean):[];
  const status=body.status==='draft'?'draft':'published';
  const item={id:'mat_'+Date.now()+'_'+crypto.randomBytes(3).toString('hex'),title,description,type,content,url,audience,schoolIds,courseId:String(body.courseId||'').trim(),status,createdAt:new Date().toISOString(),createdBy:req.user.id,updatedAt:new Date().toISOString()};
  db.materials.push(item);
  audit(db,'MATERIAL_CREATED',req.user.id,{materialId:item.id,title:item.title,audience:item.audience});
  write(db);
  res.status(201).json({material:materialView(item)});
});

app.patch('/api/admin/materials/:id',auth,(req,res)=>{
  if(!canManageSchoolPortal(req.user))return res.status(403).json({error:'Acesso restrito à Administração SIGES.'});
  const db=read(),m=db.materials.find(x=>x.id===req.params.id);
  if(!m)return res.status(404).json({error:'Material não encontrado.'});
  const body=req.body||{};
  for(const key of ['title','description','content','url','courseId']) if(body[key]!==undefined)m[key]=String(body[key]||'').trim();
  if(body.type!==undefined&&['texto','link','atividade','referencia'].includes(body.type))m.type=body.type;
  if(body.audience!==undefined&&['todos','alunos','escolas'].includes(body.audience))m.audience=body.audience;
  if(Array.isArray(body.schoolIds))m.schoolIds=body.schoolIds.map(String).filter(Boolean);
  if(body.status==='draft'||body.status==='published')m.status=body.status;
  m.updatedAt=new Date().toISOString();
  audit(db,'MATERIAL_UPDATED',req.user.id,{materialId:m.id});
  write(db);
  res.json({material:materialView(m)});
});

app.delete('/api/admin/materials/:id',auth,(req,res)=>{
  if(!canManageSchoolPortal(req.user))return res.status(403).json({error:'Acesso restrito à Administração SIGES.'});
  const db=read(),m=db.materials.find(x=>x.id===req.params.id);
  if(!m)return res.status(404).json({error:'Material não encontrado.'});
  db.materials=db.materials.filter(x=>x.id!==m.id);
  audit(db,'MATERIAL_DELETED',req.user.id,{materialId:m.id,title:m.title});
  write(db);
  res.json({ok:true});
});

function materialVisibleToStudent(m,student){
  if(m.status!=='published'||m.audience==='escolas')return false;
  if(Array.isArray(m.schoolIds)&&m.schoolIds.length&&!m.schoolIds.includes(student.schoolId))return false;
  return m.audience==='todos'||m.audience==='alunos';
}
function materialVisibleToSchool(m,school){
  if(m.status!=='published'||m.audience==='alunos')return false;
  if(Array.isArray(m.schoolIds)&&m.schoolIds.length&&!m.schoolIds.includes(school.id))return false;
  return m.audience==='todos'||m.audience==='escolas';
}

app.get('/api/student/materials',auth,(req,res)=>{
  if(!canAccessStudent(req.user))return res.status(403).json({error:'Área exclusiva do aluno.'});
  const db=read(),student=studentForUser(db,req.user);
  if(!student)return res.status(404).json({error:'Aluno não localizado.'});
  res.json({materials:db.materials.filter(m=>materialVisibleToStudent(m,student)).sort((a,b)=>String(b.updatedAt||b.createdAt||'').localeCompare(String(a.updatedAt||a.createdAt||''))).map(materialView)});
});

app.get('/api/school/materials',auth,(req,res)=>{
  if(req.user.role!=='escola')return res.status(403).json({error:'Área exclusiva da escola.'});
  const db=read(),school=schoolForUser(db,req.user);
  if(!school)return res.status(404).json({error:'Escola não vinculada.'});
  res.json({materials:db.materials.filter(m=>materialVisibleToSchool(m,school)).sort((a,b)=>String(b.updatedAt||b.createdAt||'').localeCompare(String(a.updatedAt||a.createdAt||''))).map(materialView)});
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

function canAccessStudent(user){return user && ['aluno','aluno_guia'].includes(user.role) && user.status==='active';}
function studentForUser(db,user){const sid=user.profile?.studentId;return db.students.find(s=>s.id===sid || s.userId===user.id);}
function schoolForUser(db,user){const sid=user.profile?.schoolId;return db.schools.find(s=>s.id===sid || s.managerUserId===user.id);}
function ensureStudentCollections(db){for(const key of ['observations','studentProgress']) if(!Array.isArray(db[key])) db[key]=[];}
function normTerritory(v){
  return String(v??'').normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').toLowerCase().replace(/\\b(rua|r|av|av\\.|avenida|rodovia|br[- ]?)\\b/g,'').replace(/[^a-z0-9]+/g,' ').trim();
}
function readSigesTerritory(){
  try{
    const file=path.join(__dirname,'..','frontend','data','joinville-3-2-data.gz.b64');
    if(!fs.existsSync(file)) return null;
    const b64=fs.readFileSync(file,'utf8').replace(/\\s+/g,'');
    const json=JSON.parse(zlib.gunzipSync(Buffer.from(b64,'base64')).toString('utf8'));
    return {
      matrix:Array.isArray(json['MATRIZ 3.2'])?json['MATRIZ 3.2']:[],
      evidencias:Array.isArray(json['EVIDÊNCIAS TERRITORIAIS'])?json['EVIDÊNCIAS TERRITORIAIS']:[],
      sinistros:Array.isArray(json['SINISTROS_CORREDORES'])?json['SINISTROS_CORREDORES']:[]
    };
  }catch{return null}
}
function matchTerritorialSchool(school,data){
  if(!school||!data)return null;
  const name=normTerritory(school.name),bairro=normTerritory(school.bairro),address=normTerritory(school.address);
  let row=data.matrix.find(x=>{
    const u=normTerritory(x.Unidade),b=normTerritory(x.Bairro),a=normTerritory(x.Endereço);
    return (u&&name&&(u===name||u.includes(name)||name.includes(u))) ||
      (a&&address&&(a.includes(address)||address.includes(a))) ||
      (b&&bairro&&u&&b===bairro&&name&&u.includes(name));
  });
  if(!row)return null;
  const corridor=normTerritory(row['Corredor normalizado']||row.Corredor||row.Via||row.Endereço);
  const evidencias=data.evidencias.filter(e=>{
    const u=normTerritory(e['Unidade escolar associada']),p=normTerritory(e.Ponto),v=normTerritory(e['Via/Corredor']);
    return (u&&normTerritory(row.Unidade)===u)||(p&&bairro&&p.includes(bairro))||(v&&corridor&&(v.includes(corridor)||corridor.includes(v)));
  }).slice(0,20);
  const sinistros=data.sinistros.filter(x=>{
    const v=normTerritory(x.Via||x.Corredor);
    return corridor&&v&&(v.includes(corridor)||corridor.includes(v));
  }).slice(0,10);
  return {row,evidencias,sinistros};
}
function schoolSigesContext(db,school){
  const data=readSigesTerritory(),match=matchTerritorialSchool(school,data);
  if(!match)return {available:false,source:'SIGES — Matriz Territorial 3.2'};
  const x=match.row;
  const risks=db.risks.filter(r=>r.schoolId===school.id&&r.status!=='closed');
  const evidencesDb=db.evidences.filter(e=>e.schoolId===school.id);
  const plans=db.actionPlans.filter(p=>p.schoolId===school.id&&p.status!=='completed');
  return {
    available:true,source:'SIGES — Matriz Territorial 3.2',schoolId:school.id,
    territorial:{
      unidade:x.Unidade||school.name,bairro:x.Bairro||school.bairro,endereco:x.Endereço||school.address,
      hsi:x['HSI-DOTH-P']??null,ipe:x['IPE Territorial 3.2']??null,prioridade:String(x['Prioridade Territorial 3.2']||x.Prioridade||'—'),
      dimensions:{D:x.D,O:x.O,T:x.T,H:x.H,P:x.P},
      corridor:x['Corredor normalizado']||x.Corredor||x.Via||null,
      accidents2024:x['Acidentes corredor 2024']??null,accidents2025:x['Acidentes corredor 2025']??null,
      detrans:x['Estudos DETRANS']??null,speed:x['Velocidade km/h']??x.Velocidade??null,
      cycling:x['Infraestrutura cicloviária']??null
    },
    evidences:match.evidencias.map(e=>({tipo:e.Tipo,ponto:e.Ponto,natureza:e.Natureza,result:e['Valor/resultado'],year:e['Data/ano'],source:e['Fonte oficial']})),
    operational:{openRisks:risks.length,evidences:evidencesDb.length,openActionPlans:plans.length},
    corridors:match.sinistros.map(x=>({via:x.Via||x.Corredor,accidents2024:x['Acidentes 2024'],accidents2025:x['Acidentes 2025'],variation:x['Variação 2024-2025']}))
  };
}
function studentSigesContext(db,school){
  const c=schoolSigesContext(db,school);
  if(!c.available)return c;
  const p=c.territorial.prioridade;
  const band=/P1|P2/.test(p)?'atenção prioritária':/P3/.test(p)?'atenção elevada':'contexto territorial monitorado';
  return {available:true,source:c.source,schoolId:c.schoolId,territory:{
    escola:c.territorial.unidade,bairro:c.territorial.bairro,corredor:c.territorial.corridor,prioridade:band,
    temas:['travessia','visibilidade','velocidade percebida','calçada','sinalização','iluminação','bicicletas e motocicletas'],
    evidenciasCount:c.evidences.length,corridorsCount:c.corridors.length,
    acidentes2025Disponivel:c.territorial.accidents2025!=null
  }};
}
app.get('/api/student/siges-context',auth,(req,res)=>{
  if(!canAccessStudent(req.user))return res.status(403).json({error:'Área exclusiva do aluno.'});
  const db=read(),student=studentForUser(db,req.user);if(!student)return res.status(404).json({error:'Aluno não localizado.'});
  const school=db.schools.find(s=>s.id===student.schoolId);res.json({context:studentSigesContext(db,school)});
});
app.get('/api/school/siges-context',auth,(req,res)=>{
  if(req.user.role!=='escola')return res.status(403).json({error:'Área exclusiva da escola.'});
  const db=read(),school=schoolForUser(db,req.user);if(!school)return res.status(404).json({error:'Escola não vinculada.'});
  res.json({context:schoolSigesContext(db,school)});
});
app.get('/api/student/me',auth,(req,res)=>{if(!canAccessStudent(req.user))return res.status(403).json({error:'Área exclusiva do aluno.'});const db=read();ensureStudentCollections(db);const student=studentForUser(db,req.user);if(!student)return res.status(404).json({error:'Cadastro escolar do aluno não localizado.'});const school=db.schools.find(s=>s.id===student.schoolId);res.json({user:safe(req.user),student:{...student,schoolName:school?.name||'Escola não localizada'},school:school||null});});
app.get('/api/student/dashboard',auth,(req,res)=>{if(!canAccessStudent(req.user))return res.status(403).json({error:'Área exclusiva do aluno.'});const db=read();ensureStudentCollections(db);const student=studentForUser(db,req.user);if(!student)return res.status(404).json({error:'Cadastro escolar do aluno não localizado.'});const school=db.schools.find(s=>s.id===student.schoolId);const progress=db.studentProgress.filter(x=>x.studentId===student.id);const claims=db.claims.filter(x=>x.studentId===student.id);const observations=db.observations.filter(x=>x.studentId===student.id);const training=(db.guideTrainings||[]).find(x=>x.studentId===student.id)||null;res.json({student:{...student,schoolName:school?.name||''},school:school||null,progress,claims,observations,training,siges:studentSigesContext(db,school),summary:{completedLessons:progress.filter(x=>x.completed).length,claims:claims.length,observations:observations.length,courseProgress:training?.progress||0}});});
app.post('/api/student/observations',auth,(req,res)=>{if(!canAccessStudent(req.user))return res.status(403).json({error:'Área exclusiva do aluno.'});const db=read();ensureStudentCollections(db);const student=studentForUser(db,req.user);if(!student)return res.status(404).json({error:'Aluno não localizado.'});const {category,description,location,schoolContext}=req.body||{};if(!category||!description)return res.status(400).json({error:'Informe o tipo de situação e descreva o que foi observado.'});const item={id:'obs_'+Date.now(),studentId:student.id,schoolId:student.schoolId,category:String(category).trim(),description:String(description).trim(),location:String(location||'').trim(),schoolContext:String(schoolContext||'').trim(),status:'received',createdAt:new Date().toISOString()};db.observations.push(item);audit(db,'STUDENT_OBSERVATION_CREATED',req.user.id,{observationId:item.id,category:item.category});write(db);res.status(201).json({observation:item});});
app.post('/api/student/claims',auth,(req,res)=>{if(!canAccessStudent(req.user))return res.status(403).json({error:'Área exclusiva do aluno.'});const db=read();const student=studentForUser(db,req.user);if(!student)return res.status(404).json({error:'Aluno não localizado.'});const {category,title,description,location}=req.body||{};if(!category||!title||!description)return res.status(400).json({error:'Preencha categoria, título e descrição.'});const item={id:'clm_'+Date.now(),studentId:student.id,schoolId:student.schoolId,category:String(category).trim(),title:String(title).trim(),description:String(description).trim(),location:String(location||'').trim(),status:'pending',source:'student',createdAt:new Date().toISOString()};db.claims.push(item);audit(db,'STUDENT_CLAIM_CREATED',req.user.id,{claimId:item.id,category:item.category});write(db);res.status(201).json({claim:item});});
app.post('/api/student/progress',auth,(req,res)=>{if(!canAccessStudent(req.user))return res.status(403).json({error:'Área exclusiva do aluno.'});const db=read();ensureStudentCollections(db);const student=studentForUser(db,req.user);if(!student)return res.status(404).json({error:'Aluno não localizado.'});const {courseId,lessonId,completed=true}=req.body||{};if(!courseId||!lessonId)return res.status(400).json({error:'Curso e aula são obrigatórios.'});let p=db.studentProgress.find(x=>x.studentId===student.id&&x.courseId===courseId&&x.lessonId===lessonId);if(!p){p={id:'prog_'+Date.now(),studentId:student.id,courseId,lessonId,completed:Boolean(completed),completedAt:completed?new Date().toISOString():null};db.studentProgress.push(p);}else{p.completed=Boolean(completed);p.completedAt=p.completed?new Date().toISOString():null;}audit(db,'STUDENT_LESSON_PROGRESS',req.user.id,{courseId,lessonId,completed:p.completed});write(db);res.json({progress:p});});
app.get('/api/school/dashboard',auth,(req,res)=>{if(req.user.role!=='escola')return res.status(403).json({error:'Área exclusiva da escola.'});const db=read();ensureStudentCollections(db);const school=schoolForUser(db,req.user);if(!school)return res.status(404).json({error:'Escola não vinculada ao usuário.'});const students=db.students.filter(s=>s.schoolId===school.id);const ids=new Set(students.map(s=>s.id));const progress=db.studentProgress.filter(x=>ids.has(x.studentId));const claims=db.claims.filter(x=>ids.has(x.studentId));const observations=db.observations.filter(x=>ids.has(x.studentId));const guide=db.guideTrainings.filter(x=>ids.has(x.studentId));const byStudent=students.map(s=>({id:s.id,name:s.name,grade:s.grade,className:s.className,shift:s.shift,status:s.status,schoolValidatedAt:s.schoolValidatedAt||null,lessons:progress.filter(p=>p.studentId===s.id&&p.completed).length,claims:claims.filter(c=>c.studentId===s.id).length,observations:observations.filter(o=>o.studentId===s.id).length,guideProgress:guide.find(g=>g.studentId===s.id)?.progress||0}));res.json({school,students:byStudent,claims,observations,siges:schoolSigesContext(db,school),summary:{students:students.length,lessonsCompleted:progress.filter(x=>x.completed).length,claims:claims.length,observations:observations.length,guides:guide.length}});});
app.post('/api/school/students/:id/decision',auth,async(req,res)=>{
  if(req.user.role!=='escola')return res.status(403).json({error:'Área exclusiva da escola.'});
  const db=read(),student=db.students.find(s=>s.id===req.params.id),school=schoolForUser(db,req.user);
  if(!student||!school||student.schoolId!==school.id)return res.status(404).json({error:'Aluno não localizado nesta escola.'});
  const decision=req.body?.decision;
  if(!['approve','reject'].includes(decision))return res.status(400).json({error:'Decisão inválida.'});
  const u=db.users.find(x=>x.id===student.userId);
  if(decision==='reject'){student.status='rejected';if(u){u.status='rejected';u.validationNotes=String(req.body?.notes||'').trim();}audit(db,'SCHOOL_STUDENT_REJECTED',req.user.id,{studentId:student.id});write(db);if(u?.email)await sendEmail({to:u.email,subject:'Vínculo escolar não confirmado — Escola Segura',html:`<p>Olá, <b>${u.name}</b>.</p><p>A escola informou que o vínculo escolar não pôde ser confirmado neste momento.</p><p>${u.validationNotes||'Entre em contato com a escola ou com o suporte.'}</p>`});return res.json({student});}
  if(!u)return res.status(404).json({error:'Conta do aluno não localizada.'});
  if(!u.emailVerifiedAt&&u.authMethod!=='school_validation')return res.status(400).json({error:'O aluno ainda não confirmou o e-mail.'});
  student.status='active';student.schoolValidatedAt=new Date().toISOString();student.validatedBy=req.user.id;
  if(u){u.status='active';u.validatedBy=req.user.id;u.validatedAt=new Date().toISOString();}
  audit(db,'SCHOOL_STUDENT_APPROVED',req.user.id,{studentId:student.id,authMethod:u.authMethod||'email'});write(db);if(u.email)await sendEmail({to:u.email,subject:'Vínculo escolar confirmado — Escola Segura',html:`<div style="font-family:Arial,sans-serif;padding:28px;color:#18324a"><h2>🛡️ Vínculo confirmado</h2><p>Olá, <b>${u.name}</b>.</p><p>A escola confirmou seu vínculo. Seu acesso à Escola Segura está liberado.</p><p><a href="${APP_URL}/aluno">Acessar a área do aluno</a></p></div>`});res.json({student});
});
app.delete('/api/school/students/:id',auth,(req,res)=>{
  if(req.user.role!=='escola')return res.status(403).json({error:'Área exclusiva da escola.'});
  const db=read(),student=db.students.find(s=>s.id===req.params.id),school=schoolForUser(db,req.user);
  if(!student||!school||student.schoolId!==school.id)return res.status(404).json({error:'Aluno não localizado nesta escola.'});
  if(student.status!=='pending')return res.status(400).json({error:'Somente cadastros pendentes podem ser excluídos pela escola.'});
  const u=db.users.find(x=>x.id===student.userId);
  db.students=db.students.filter(x=>x.id!==student.id);
  db.users=db.users.filter(x=>x.id!==student.userId);
  db.emailVerifications=(db.emailVerifications||[]).filter(x=>x.userId!==student.userId);
  audit(db,'SCHOOL_STUDENT_DELETED',req.user.id,{studentId:student.id,userId:student.userId,studentName:student.name});
  write(db);
  res.json({ok:true,message:'Cadastro do aluno excluído da fila de validação.',studentId:student.id});
});
app.get('/api/school/students',auth,(req,res)=>{if(req.user.role!=='escola')return res.status(403).json({error:'Área exclusiva da escola.'});const db=read(),school=schoolForUser(db,req.user);if(!school)return res.status(404).json({error:'Escola não vinculada.'});const students=db.students.filter(s=>s.schoolId===school.id);res.json({students:students.map(s=>({...s,responsibleName:undefined,responsibleContact:undefined,status:s.status}))});});
app.post('/api/forgot',(req,res)=>{const email=String(req.body.email||'').trim().toLowerCase(),db=read(),u=db.users.find(x=>x.email===email);if(!u)return res.json({message:'Se a conta existir, a recuperação será processada.'});const t='reset_'+Date.now()+'_'+Math.random().toString(36).slice(2);db.passwordResets.push({token:t,userId:u.id,expiresAt:Date.now()+1800000});audit(db,'PASSWORD_RESET_REQUEST',u.id);write(db);res.json({message:'Solicitação registrada.',devToken:t});});
app.post('/api/reset',async(req,res)=>{const{token,password}=req.body;if(!token||!password||password.length<6)return res.status(400).json({error:'Token e nova senha são obrigatórios.'});const db=read(),r=db.passwordResets.find(x=>x.token===token&&x.expiresAt>Date.now());if(!r)return res.status(400).json({error:'Token inválido ou expirado.'});const u=db.users.find(x=>x.id===r.userId);u.passwordHash=await bcrypt.hash(password,10);db.passwordResets=db.passwordResets.filter(x=>x.token!==token);audit(db,'PASSWORD_RESET',u.id);write(db);res.json({message:'Senha redefinida com sucesso.'});});

app.listen(PORT,'0.0.0.0',()=>{ensureAdmin();ensureValidationTestUsers();console.log('SIGES API local: http://localhost:'+PORT);});
