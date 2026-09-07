/**
 * SIGES — School Traffic Safety Intelligence Engine
 * Pure, side-effect-free functions. Safe to use locally or behind an API gateway.
 * No access to users, passwords or raw student identity data.
 */

function clamp(n,min=0,max=100){return Math.max(min,Math.min(max,Number(n)||0));}

function weightedRisk(input={}){
  const factors={
    severity:clamp(input.severity),
    frequency:clamp(input.frequency),
    exposure:clamp(input.exposure),
    vulnerability:clamp(input.vulnerability),
    proximity:clamp(input.proximity),
    recurrence:clamp(input.recurrence),
    evidence:clamp(input.evidence)
  };
  const weights={severity:.22,frequency:.15,exposure:.18,vulnerability:.15,proximity:.12,recurrence:.10,evidence:.08};
  const score=Object.keys(weights).reduce((s,k)=>s+factors[k]*weights[k],0);
  const level=score>=75?'CRÍTICO':score>=55?'ALTO':score>=30?'MODERADO':'BAIXO';
  return {score:Number(score.toFixed(1)),level,factors,weights};
}

function trend(current=[],previous=[]){
  const a=current.reduce((s,v)=>s+(Number(v)||0),0)/Math.max(current.length,1);
  const b=previous.reduce((s,v)=>s+(Number(v)||0),0)/Math.max(previous.length,1);
  const delta=a-b;
  const percent=b===0?(a>0?100:0):(delta/Math.abs(b))*100;
  return {current:Number(a.toFixed(2)),previous:Number(b.toFixed(2)),delta:Number(delta.toFixed(2)),percent:Number(percent.toFixed(1)),direction:delta>0?'up':delta<0?'down':'stable'};
}

function earlyWarnings({risks=[],claims=[],actions=[],events=[]}={}){
  const warnings=[];
  if(risks.filter(r=>!['closed','concluded'].includes(r.status)).length>=5)
    warnings.push({code:'RISK_CONCENTRATION',severity:'high',message:'Concentração de riscos abertos requer priorização.'});
  if(claims.filter(c=>['pending','analysis','review'].includes(c.status)).length>=5)
    warnings.push({code:'CLAIM_BACKLOG',severity:'medium',message:'Há acúmulo de reivindicações aguardando tratamento.'});
  if(actions.filter(a=>['active','in_progress'].includes(a.status)).length>=5)
    warnings.push({code:'ACTION_BACKLOG',severity:'medium',message:'Há múltiplos planos de ação ativos sem encerramento.'});
  const recent=events.slice(-20);
  if(recent.length>=6){
    const counts={};
    recent.forEach(e=>{const k=e.type||e.category||'unknown';counts[k]=(counts[k]||0)+1;});
    Object.entries(counts).filter(([,n])=>n>=4).forEach(([k,n])=>warnings.push({code:'EVENT_CLUSTER',severity:'high',message:`Padrão recorrente detectado: ${k} (${n} registros recentes).`}));
  }
  return warnings;
}

function explainRisk(result){
  const ordered=Object.entries(result.factors).sort((a,b)=>b[1]-a[1]);
  return {
    summary:`Prioridade ${result.level.toLowerCase()} (${result.score}/100).`,
    mainFactors:ordered.slice(0,3).map(([factor,value])=>({factor,value})),
    method:'Pontuação ponderada explicável; não é decisão administrativa automática.'
  };
}

function schoolSnapshot(input={}){
  const risk=weightedRisk(input.risk||{});
  const warnings=earlyWarnings(input);
  return {
    schema_version:'1.0.0',
    generated_at:new Date().toISOString(),
    scope:input.scope||{},
    indicators:{
      hsi_traffic:clamp(input.hsiTraffic),
      hsi_bullying:clamp(input.hsiBullying),
      open_risks:(input.risks||[]).length,
      pending_claims:(input.claims||[]).length,
      active_action_plans:(input.actions||[]).length
    },
    priority:risk,
    explanation:explainRisk(risk),
    early_warnings:warnings,
    human_review_required:true
  };
}

module.exports={clamp,weightedRisk,trend,earlyWarnings,explainRisk,schoolSnapshot};
