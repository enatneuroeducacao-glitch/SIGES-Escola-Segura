const fs=require('fs');
const server='backend/server.js';
const main='frontend/src/siges-main.jsx';
let s=fs.readFileSync(server,'utf8');
if(!s.includes("require('./public-sources')"))s=s.replace("const jwt=require('jsonwebtoken');","const jwt=require('jsonwebtoken');\nconst buildPublicSourcesRouter=require('./public-sources');");
if(!s.includes("app.use('/api/public-sources'"))s=s.replace("app.get('/api/health',(req,res)=>res.json({ok:true,system:'SIGES',mode:'local'}));","app.get('/api/health',(req,res)=>res.json({ok:true,system:'SIGES',mode:'local'}));\napp.use('/api/public-sources',buildPublicSourcesRouter());");
fs.writeFileSync(server,s);
let m=fs.readFileSync(main,'utf8');
// Normalize the integration idempotently: never add duplicate imports/routes.
m=m.replace(/import\s+PublicSources\s+from\s+['"]\.\/PublicSources['"];?/g,'');
if(!m.includes("import RadarIntelligence from './RadarIntelligence';"))throw new Error('RadarIntelligence import not found');
m=m.replace("import RadarIntelligence from './RadarIntelligence';","import RadarIntelligence from './RadarIntelligence';\nimport PublicSources from './PublicSources';");
// Keep only one Fontes navigation entry.
m=m.replace(/,?\['fontes','Fontes e Dados Externos',Database\]/g,'');
m=m.replace("['sinistros','Sinistros / Corredores',Route]","['sinistros','Sinistros / Corredores',Route],['fontes','Fontes e Dados Externos',Database]");
// Keep only one fontes page route.
m=m.replace(/:page==='fontes'\?<PublicSources\/>/g,'');
m=m.replace("page==='sinistros'?<Crashes data={data}/>","page==='sinistros'?<Crashes data={data}/>:page==='fontes'?<PublicSources/>");
fs.writeFileSync(main,m);
console.log('SIGES public sources integration enabled (idempotent)');
