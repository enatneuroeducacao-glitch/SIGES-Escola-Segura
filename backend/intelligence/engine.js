/**
 * SIGES Intelligence Engine — núcleo puro e seguro.
 *
 * Este módulo NÃO acessa banco, usuários, Neurodrive ou Central ENAT-HSI.
 * Ele recebe sinais já qualificados e devolve prioridades explicáveis.
 * A integração com a API será feita posteriormente, preservando o modo local.
 */

const clamp = (value, min = 0, max = 100) => Math.max(min, Math.min(max, Number(value) || 0));

function priorityScore(signal = {}) {
  const factors = {
    severity: clamp(signal.severity),
    frequency: clamp(signal.frequency),
    exposure: clamp(signal.exposure),
    vulnerability: clamp(signal.vulnerability),
    proximity: clamp(signal.proximity),
    recurrence: clamp(signal.recurrence),
    evidenceQuality: clamp(signal.evidenceQuality),
    trend: clamp(signal.trend)
  };

  // Pesos intencionalmente explícitos para permitir auditoria e versionamento.
  const score =
    factors.severity * 0.20 +
    factors.frequency * 0.15 +
    factors.exposure * 0.15 +
    factors.vulnerability * 0.15 +
    factors.proximity * 0.10 +
    factors.recurrence * 0.10 +
    factors.evidenceQuality * 0.05 +
    factors.trend * 0.10;

  return Math.round(score * 100) / 100;
}

function priorityBand(score) {
  if (score >= 80) return 'CRÍTICA';
  if (score >= 60) return 'ALTA';
  if (score >= 35) return 'MODERADA';
  return 'BAIXA';
}

function buildRiskSignal(input = {}) {
  const score = priorityScore(input);
  return {
    schema: 'siges.intelligence.v1',
    event: 'risk_signal',
    source: 'siges',
    timestamp: new Date().toISOString(),
    scope: input.scope || {},
    signalId: input.signalId || `sig_${Date.now()}`,
    category: input.category || 'indefinida',
    score,
    priority: priorityBand(score),
    confidence: clamp(input.confidence, 0, 1),
    explainability: {
      factors: {
        severity: clamp(input.severity),
        frequency: clamp(input.frequency),
        exposure: clamp(input.exposure),
        vulnerability: clamp(input.vulnerability),
        proximity: clamp(input.proximity),
        recurrence: clamp(input.recurrence),
        evidenceQuality: clamp(input.evidenceQuality),
        trend: clamp(input.trend)
      },
      ruleVersion: 'priority-v1'
    },
    traceId: input.traceId || `trace_${Date.now()}`
  };
}

function coexistenceIndex(values = {}) {
  // Índice agregado/protegido; não é diagnóstico clínico.
  const components = [
    ['safetyPerception', 0.25],
    ['belonging', 0.20],
    ['respect', 0.20],
    ['peerPressure', 0.15],
    ['responseConfidence', 0.20]
  ];

  const score = components.reduce((sum, [key, weight]) => {
    const value = clamp(values[key]);
    return sum + value * weight;
  }, 0);

  return Math.round(score * 100) / 100;
}

function evolution(before, after) {
  const b = Number(before) || 0;
  const a = Number(after) || 0;
  const delta = Math.round((a - b) * 100) / 100;
  return {
    before: b,
    after: a,
    delta,
    direction: delta > 0 ? 'melhora' : delta < 0 ? 'redução' : 'estável'
  };
}

module.exports = {
  priorityScore,
  priorityBand,
  buildRiskSignal,
  coexistenceIndex,
  evolution
};
