import DATA_B64 from '../data/joinville-3-2-data.gz.b64?raw';

export async function loadSigesData(){
  try{
    const b=atob(String(DATA_B64).replace(/\s+/g,''));
    const bytes=Uint8Array.from(b,c=>c.charCodeAt(0));
    if(typeof DecompressionStream==='undefined') throw new Error('Este navegador não suporta descompressão gzip.');
    const ds=new DecompressionStream('gzip');
    const json=await new Response(new Blob([bytes]).stream().pipeThrough(ds)).json();
    const m=json['MATRIZ 3.2']||[];
    return {
      matrix:m,
      evidencias:json['EVIDÊNCIAS TERRITORIAIS']||[],
      sinistros:json['SINISTROS_CORREDORES']||[],
      dashboard:json['DASHBOARD 3.2']||[],
      metodologia:json['METODOLOGIA 3.2']||[],
      dicionario:json['DICIONÁRIO 3.2']||[]
    };
  }catch(error){
    console.error('SIGES data load error:',error);
    throw new Error('Base territorial 3.2 não encontrada ou inválida.');
  }
}
