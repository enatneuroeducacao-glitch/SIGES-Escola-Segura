const fs=require('fs');
const path=require('path');
const readline=require('readline');
const bcrypt=require('bcryptjs');

const DB=path.join(__dirname,'data','db.json');
const rl=readline.createInterface({input:process.stdin,output:process.stdout});
const ask=q=>new Promise(resolve=>rl.question(q,resolve));

(async()=>{
  try{
    const db=JSON.parse(fs.readFileSync(DB,'utf8'));
    const existing=db.users.find(u=>u.role==='enat');
    if(existing){
      console.log('\nJá existe uma conta ENAT/Administração.');
      console.log('E-mail:',existing.email);
      console.log('Se você perdeu a senha, use "Esqueci a senha" no SIGES.\n');
      rl.close(); return;
    }
    console.log('\n=== SIGES — CRIAÇÃO DO ADMINISTRADOR ENAT ===\n');
    const name=(await ask('Nome do administrador: ')).trim();
    const email=(await ask('E-mail administrativo: ')).trim().toLowerCase();
    const password=await ask('Senha (mínimo 8 caracteres): ');
    const confirm=await ask('Confirme a senha: ');
    if(!name||!email||password.length<8||password!==confirm){
      console.error('\nDados inválidos. Verifique nome, e-mail, senha e confirmação.');
      process.exitCode=1; rl.close(); return;
    }
    if(db.users.some(u=>u.email===email)){
      console.error('\nEste e-mail já está cadastrado.');
      process.exitCode=1; rl.close(); return;
    }
    const u={
      id:'usr_admin_'+Date.now(), role:'enat', name, email,
      passwordHash:await bcrypt.hash(password,12), status:'active', profile:{institution:'ENAT'},
      createdAt:new Date().toISOString()
    };
    db.users.push(u);
    db.audit.push({id:Date.now().toString(),action:'ADMIN_BOOTSTRAP',userId:u.id,details:{role:'enat'},at:new Date().toISOString()});
    fs.writeFileSync(DB,JSON.stringify(db,null,2));
    console.log('\nAdministrador ENAT criado com sucesso.');
    console.log('E-mail:',email);
    console.log('Status: active');
    console.log('Agora execute: npm run dev');
    console.log('e entre em http://localhost:5173\n');
  }catch(err){ console.error('\nFalha:',err.message); process.exitCode=1; }
  finally{rl.close();}
})();
