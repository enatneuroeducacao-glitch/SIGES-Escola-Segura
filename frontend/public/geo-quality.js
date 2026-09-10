(()=>{
  const esc=v=>String(v??'').replace(/[&<>\"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[m]));
  const css=`.geo-quality{margin-top:14px;background:#fff;border:1px solid #dfe8ec;border-radius:13px;padding:19px}.geo-quality h3{margin:5px 0 4px;font-size:15px}.geo-quality p{font-size:10px;color:#788792;line-height:1.55}.geo-quality-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-top:12px}.geo-q{border:1px solid #e3eaed;border-radius:9px;padding:12px}.geo-q b{display:block;font-size:20px}.geo-q span{display:block;color:#7d8b95;font-size:8px;text-transform:uppercase;letter-spacing:.06em;margin-top:3px}.geo-tags{display:flex;flex-wrap:wrap;gap:6px;margin-top:12px}.geo-tag{background:#edf7f6;color:#327f7e;border-radius:5px;padding:6px 8px;font-size:8px;font-weight:800}@media(max-width:800px){.geo-quality-grid{grid-template-columns:repeat(2,1fr)}}`;
  const style=()=>{if(document.getElementById('geo-quality-style'))return;const s=document.createElement('style');s.id='geo-quality-style';s.textContent=css;document.head.appendChild(s)};
  const render=()=>{
    const d=window.__SIGES_DATA;if(!d?.matrix?.length||!d?.meta?.officialGeo)return;
    style();const page=document.querySelector('.app main>section');if(!page)return;
    const header=page.querySelector('.section-head h2')?.textContent?.trim();
    if(header==='Centro de inteligência escolar'){
      if(page.querySelector('.geo-quality'))return;
      const m=d.matrix,total=m.length,matched=m.filter(x=>x['Correspondência SED']==='CONFIRMADA').length;
      const anyAcc=m.filter(x=>(Number(x['Acidentes com vítimas 500m 2023'])+Number(x['Acidentes com vítimas 500m 2024'])+Number(x['Acidentes com vítimas 500m 2025']))>0).length;
      const totalAcc=m.reduce((n,x)=>n+Number(x['Acidentes com vítimas 500m 2023'])+Number(x['Acidentes com vítimas 500m 2024'])+Number(x['Acidentes com vítimas 500m 2025']),0);
      const bus=m.reduce((n,x)=>n+Number(x['Pontos de ônibus 500m']),0),surveys=m.filter(x=>Number(x['Vistorias viárias 500m'])>0).length;
      const el=document.createElement('div');el.className='geo-quality';el.innerHTML=`<small style="color:#58aaa8;letter-spacing:.16em;font-size:9px;font-weight:900">MENSURAÇÃO TERRITORIAL · FONTE OFICIAL</small><h3>Enriquecimento geoespacial verificável</h3><p>O SIGES passou a cruzar a matriz com camadas públicas municipais em coordenadas oficiais. O raio padrão é de 500 m. Acidentes são <b>acidentes de trânsito com vítimas</b>; ausência de ocorrência não significa ausência de risco.</p><div class="geo-quality-grid"><div class="geo-q"><b>${matched}/${total}</b><span>unidades localizadas na SED</span></div><div class="geo-q"><b>${anyAcc}</b><span>escolas com acidentes em 500 m</span></div><div class="geo-q"><b>${totalAcc}</b><span>ocorrências com vítimas em 500 m</span></div><div class="geo-q"><b>${surveys}</b><span>escolas com vistoria viária próxima</span></div></div><div class="geo-tags"><span class="geo-tag">SED / escolas oficiais</span><span class="geo-tag">Acidentes 2023–2025</span><span class="geo-tag">Pontos de ônibus</span><span class="geo-tag">Survey de segurança viária</span><span class="geo-tag">Raio 500 m</span></div>`;
      page.appendChild(el);
    }
    if(header==='Base Escolar'&&!page.querySelector('.geo-quality')){
      const rows=d.matrix.filter(x=>['P1','P2','P3'].includes(String(x.Prioridade||'').match(/P[1-4]/)?.[0])).slice(0,12);
      const table=document.createElement('div');table.className='geo-quality';table.innerHTML=`<small style="color:#58aaa8;letter-spacing:.16em;font-size:9px;font-weight:900">INDICADORES TERRITORIAIS · 500 M</small><h3>Mensuração complementar das prioridades</h3><p>Indicadores calculados a partir de camadas georreferenciadas oficiais de Joinville. Valores são contextuais e não substituem vistoria técnica.</p><div style="overflow:auto"><table><thead><tr><th>Unidade</th><th>Prioridade</th><th>Acid. vítimas 2023</th><th>2024</th><th>2025</th><th>Ônibus</th><th>Vistorias</th><th>Veloc. obs.</th></tr></thead><tbody>${rows.map(x=>`<tr><td>${esc(x.Unidade)}</td><td>${esc(x.Prioridade)}</td><td>${Number(x['Acidentes com vítimas 500m 2023'])||0}</td><td>${Number(x['Acidentes com vítimas 500m 2024'])||0}</td><td>${Number(x['Acidentes com vítimas 500m 2025'])||0}</td><td>${Number(x['Pontos de ônibus 500m'])||0}</td><td>${Number(x['Vistorias viárias 500m'])||0}</td><td>${x['Velocidade observada mediana 500m']?`${x['Velocidade observada mediana 500m']} km/h`:'—'}</td></tr>`).join('')}</tbody></table></div>`;
      page.appendChild(table);
    }
  };
  const start=()=>{render();new MutationObserver(render).observe(document.body,{childList:true,subtree:true})};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
