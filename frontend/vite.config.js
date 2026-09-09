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

export default defineConfig({
  plugins:[normalizePublicSourcesImport(),releaseLogin(),react()],
  base: process.env.GITHUB_ACTIONS ? '/SIGES-Escola-Segura/' : '/',
  build:{outDir:'dist'}
});
