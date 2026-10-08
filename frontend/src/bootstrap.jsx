const root=document.getElementById('root');
const showFatal=(error)=>{
  const message=error instanceof Error?error.message:String(error);
  const stack=error instanceof Error?(error.stack||''):'';
  if(!root)return;
  root.innerHTML=`<div style="min-height:100vh;background:#f4f7f9;display:grid;place-items:center;padding:24px;font-family:Segoe UI,Arial,sans-serif"><div style="width:min(760px,100%);background:#fff;border:1px solid #e1e8eb;border-radius:16px;padding:28px;box-shadow:0 15px 45px #17304418"><div style="font-size:11px;letter-spacing:.16em;font-weight:800;color:#2f7f88">SIGES · DIAGNÓSTICO DE EXECUÇÃO</div><h1 style="margin:10px 0;color:#173044;font-size:25px">O módulo não conseguiu iniciar</h1><p style="color:#627582;line-height:1.6">O servidor respondeu, mas um módulo JavaScript falhou durante a inicialização. O SIGES preservou esta tela para impedir uma página branca sem diagnóstico.</p><div style="background:#fff3f1;border:1px solid #efc7c0;border-radius:10px;padding:14px;color:#8d3d35;font-family:Consolas,monospace;font-size:12px;white-space:pre-wrap;word-break:break-word">${message}</div><details style="margin-top:14px"><summary style="cursor:pointer;font-weight:700;color:#173044">Detalhes técnicos</summary><pre style="white-space:pre-wrap;font-size:10px;color:#627582">${stack}</pre></details><button onclick="location.reload()" style="margin-top:18px;border:0;border-radius:8px;background:#2f7f88;color:#fff;padding:11px 16px;font-weight:800;cursor:pointer">Recarregar SIGES</button></div></div>`;
};
window.addEventListener('error',event=>showFatal(event.error||event.message));
window.addEventListener('unhandledrejection',event=>showFatal(event.reason));
const p=location.pathname.replace(/\/$/,'');
const modulePath=p==='/aluno'||p==='/escola'||p==='/verificar-email'?'./portal.jsx':'./siges-main.jsx';
import(modulePath).catch(showFatal);