const clean=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\b(rua|r|av|av\.|avenida|rodovia|br[- ]?)\b/g,'').replace(/[^a-z0-9]+/g,' ').trim();
const missing=v=>v==null||String(v).trim()===''||String(v).trim()==='—'||String(v).trim()==='-';
const match=(a,b)=>{const x=clean(a),y=clean(b);if(!x||!y)return 0;if(x===y)return 2;if(x.includes(y)||y.includes(x))return 1;return 0};
const confidence=q=>q===2?'alta (correspondência nominal exata)':q===1?'moderada (correspondência nominal parcial)':'não determinada';
const fmtDate=v=>{if(missing(v))return '—';const s=String(v).trim();if(/^\d{4}-\d{2}-\d{2}$/.test(s)){const [y,m,d]=s.split('-');return `${d}/${m}/${y}`}return s};
const sourceUrl=(sources,key)=>sources?.[key]?.urls?.publication||sources?.[key]?.urls?.portal||sources?.[key]?.urls?.['2025']||null;

export function buildEvidenceTrace(row,sources){
  const key=row['Corredor normalizado']||row.Corredor||row.Via||row.Endereço||'';
  const cb=sources?.cbvj?.corridors||[];
  const det=sources?.detrans?.corridors||[];
  const docs=sources?.detrans?.documents||[];
  const cycles=sources?.simgeo?.corridors||[];
  const traces=[];
  const add=(field,value,source,date,evidence,url,quality)=>{if(missing(value))return;traces.push({campo:field,valor:value,fonte:source||'—',data:fmtDate(date),evidencia:evidence||'—',confiabilidade:confidence(quality),url:url||null})};

  const detDoc=docs.find(d=>match(key,d.road)>=1&&Number.isFinite(Number(d.speedKmh)));
  if(detDoc?.speedKmh){add('Velocidade',`${detDoc.speedKmh} km/h`,'DETRANS',detDoc.date,'estudo técnico',detDoc.url,match(key,detDoc.road))}

  const detRoad=det.find(d=>match(key,d.road)>=1);
  if(detRoad?.count){const matchingDocs=docs.filter(d=>match(key,d.road)>=1);const latest=matchingDocs.map(d=>d.date).filter(Boolean).sort((a,b)=>b.split('/').reverse().join('').localeCompare(a.split('/').reverse().join('')))[0];add('Estudos DETRANS',detRoad.count,'DETRANS',latest,'inventário de estudos técnicos',sourceUrl(sources,'detrans'),match(key,detRoad.road))}

  const cbRoad=cb.find(c=>match(key,c.road)>=1||match(key,c.road2025||c.road)>=1);
  if(cbRoad?.value2025!=null)add('Acidentes corredor 2025',cbRoad.value2025,'CBVJ',sources?.cbvj?.latestPublicationDate,'ranking de ocorrências por corredor publicado pelo CBVJ',sourceUrl(sources,'cbvj'),Math.max(match(key,cbRoad.road),match(key,cbRoad.road2025||'')));
  if(cbRoad?.variation2024to2025!=null)add('Variação acidentes 2024–2025',`${cbRoad.variation2024to2025}%`,'CBVJ',sources?.cbvj?.latestPublicationDate,'comparação calculada a partir dos valores 2024 e 2025 publicados para o corredor',sourceUrl(sources,'cbvj'),Math.max(match(key,cbRoad.road),match(key,cbRoad.road2025||'')));

  const cyc=cycles.filter(c=>match(key,c.nome_logra)>=1);
  if(cyc.length)add('Infraestrutura cicloviária',`Presente — ${cyc.length} segmento(s)`,'SIMGEO',null,'segmento de infraestrutura cicloviária correspondente ao logradouro',sources?.simgeo?.urls?.cycle||sourceUrl(sources,'simgeo'),Math.max(...cyc.map(c=>match(key,c.nome_logra))));

  return traces;
}

export function formatEvidenceTrace(traces){return (traces||[]).map(t=>`${t.campo}: ${t.valor} | Fonte: ${t.fonte} | Data: ${t.data} | Evidência: ${t.evidencia} | Confiabilidade: ${t.confiabilidade}${t.url?` | Documento: ${t.url}`:''}`).join(' || ')}
