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

export default defineConfig({
  plugins:[normalizePublicSourcesImport(),react()],
  build:{outDir:'dist'}
});
