/**
 * HSI-DOTH-P Bullying — núcleo de domínio do SIGES.
 *
 * Finalidade: avaliação educacional e de segurança/convivência escolar.
 * Não é instrumento clínico, diagnóstico ou classificação individual.
 *
 * A aplicação deve preservar a identidade do estudante e, para painéis
 * territoriais, trabalhar com indicadores agregados e protegidos.
 */

const VERSION = 'hsi-doth-p-bullying-v1';

const QUESTIONS = [
  { id: 'B01', dimension: 'seguranca_percebida', text: 'Na escola, sinto que posso participar das atividades sem medo de ser humilhado ou intimidado.' },
  { id: 'B02', dimension: 'seguranca_percebida', text: 'Se ocorrer uma situação de bullying, sinto que haverá adultos preparados para ajudar.' },
  { id: 'B03', dimension: 'seguranca_percebida', text: 'Consigo circular pelos espaços da escola sem evitar lugares por medo de colegas.' },
  { id: 'B04', dimension: 'seguranca_percebida', text: 'Sinto-me seguro durante recreios, intervalos e momentos de maior circulação.' },
  { id: 'B05', dimension: 'seguranca_percebida', text: 'Sinto que a escola leva a sério situações repetidas de intimidação.' },
  { id: 'B06', dimension: 'pertencimento', text: 'Sinto que faço parte da comunidade escolar.' },
  { id: 'B07', dimension: 'pertencimento', text: 'Tenho colegas com quem posso contar quando preciso.' },
  { id: 'B08', dimension: 'pertencimento', text: 'Sinto que posso ser eu mesmo sem ser ridicularizado.' },
  { id: 'B09', dimension: 'pertencimento', text: 'Percebo que as diferenças entre os estudantes são respeitadas.' },
  { id: 'B10', dimension: 'pertencimento', text: 'Quando alguém fica isolado, percebo oportunidades para incluir essa pessoa.' },
  { id: 'B11', dimension: 'respeito', text: 'Os estudantes costumam tratar uns aos outros com respeito.' },
  { id: 'B12', dimension: 'respeito', text: 'Brincadeiras que machucam, humilham ou expõem alguém são reconhecidas como um problema.' },
  { id: 'B13', dimension: 'respeito', text: 'Apelidos ofensivos não são tratados como algo normal na minha escola.' },
  { id: 'B14', dimension: 'respeito', text: 'Comentários sobre aparência, origem, deficiência ou outras características são tratados com responsabilidade.' },
  { id: 'B15', dimension: 'respeito', text: 'Quando presencio uma agressão ou humilhação, sei que devo buscar ajuda.' },
  { id: 'B16', dimension: 'pressao_dos_pares', text: 'Às vezes estudantes participam de provocações para serem aceitos pelo grupo.' },
  { id: 'B17', dimension: 'pressao_dos_pares', text: 'Existe pressão para rir, compartilhar ou incentivar situações que humilham alguém.' },
  { id: 'B18', dimension: 'pressao_dos_pares', text: 'Tenho dificuldade de contrariar colegas quando o grupo decide intimidar alguém.' },
  { id: 'B19', dimension: 'pressao_dos_pares', text: 'Redes sociais podem aumentar a pressão para participar de conflitos entre estudantes.' },
  { id: 'B20', dimension: 'pressao_dos_pares', text: 'Sei identificar quando uma brincadeira está sendo usada para pressionar ou excluir alguém.' },
  { id: 'B21', dimension: 'confianca_para_pedir_ajuda', text: 'Se eu sofrer bullying, saberia a quem procurar na escola.' },
  { id: 'B22', dimension: 'confianca_para_pedir_ajuda', text: 'Eu me sentiria seguro contando a um adulto sobre uma situação de bullying.' },
  { id: 'B23', dimension: 'confianca_para_pedir_ajuda', text: 'Acredito que pedir ajuda não deve gerar retaliação ou mais exposição.' },
  { id: 'B24', dimension: 'confianca_para_pedir_ajuda', text: 'Se um colega sofrer bullying, eu saberia como procurar ajuda para ele.' },
  { id: 'B25', dimension: 'confianca_para_pedir_ajuda', text: 'A escola oferece caminhos claros para comunicar situações de violência ou intimidação.' },
  { id: 'B26', dimension: 'resposta_escolar', text: 'Quando um caso é comunicado, a escola procura compreender o que aconteceu antes de agir.' },
  { id: 'B27', dimension: 'resposta_escolar', text: 'A escola acompanha situações repetidas depois da primeira intervenção.' },
  { id: 'B28', dimension: 'resposta_escolar', text: 'As ações de prevenção ao bullying envolvem estudantes, professores e famílias quando necessário.' },
  { id: 'B29', dimension: 'resposta_escolar', text: 'Percebo mudanças positivas quando a escola realiza ações de prevenção e convivência.' },
  { id: 'B30', dimension: 'resposta_escolar', text: 'Sinto que a escola aprende com os casos registrados e melhora suas ações.' }
];

const DIMENSIONS = {
  seguranca_percebida: { label: 'Percepção de segurança', weight: 0.20 },
  pertencimento: { label: 'Pertencimento', weight: 0.15 },
  respeito: { label: 'Respeito e convivência', weight: 0.20 },
  pressao_dos_pares: { label: 'Pressão dos pares', weight: 0.15 },
  confianca_para_pedir_ajuda: { label: 'Confiança para pedir ajuda', weight: 0.15 },
  resposta_escolar: { label: 'Resposta escolar', weight: 0.15 }
};

function assertAnswers(answers) {
  if (!answers || typeof answers !== 'object' || Array.isArray(answers)) {
    throw new Error('Respostas inválidas.');
  }
  for (const q of QUESTIONS) {
    const value = Number(answers[q.id]);
    if (!Number.isInteger(value) || value < 1 || value > 5) {
      throw new Error(`Resposta inválida para ${q.id}. Use escala de 1 a 5.`);
    }
  }
}

function to100(value) {
  return Math.round(((value - 1) / 4) * 100);
}

function score(answers) {
  assertAnswers(answers);
  const byDimension = {};
  for (const key of Object.keys(DIMENSIONS)) byDimension[key] = [];
  for (const q of QUESTIONS) byDimension[q.dimension].push(Number(answers[q.id]));

  const dimensions = {};
  let overall = 0;
  for (const [key, cfg] of Object.entries(DIMENSIONS)) {
    const values = byDimension[key];
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const index = to100(mean);
    dimensions[key] = { label: cfg.label, rawMean: Number(mean.toFixed(2)), index, weight: cfg.weight };
    overall += index * cfg.weight;
  }

  const finalScore = Math.round(overall);
  return {
    version: VERSION,
    type: 'educational_bullying_safety',
    score: finalScore,
    dimensions,
    interpretation: interpretation(finalScore),
    nonClinical: true
  };
}

function interpretation(value) {
  if (value >= 80) return 'Proteção percebida elevada';
  if (value >= 60) return 'Proteção percebida intermediária';
  if (value >= 40) return 'Atenção preventiva necessária';
  return 'Prioridade preventiva elevada';
}

function compare(before, after) {
  if (!Number.isFinite(Number(before)) || !Number.isFinite(Number(after))) {
    throw new Error('Valores de comparação inválidos.');
  }
  const delta = Number(after) - Number(before);
  return {
    before: Number(before),
    after: Number(after),
    delta,
    direction: delta > 0 ? 'melhora' : delta < 0 ? 'redução' : 'estavel'
  };
}

function buildAssessment({ studentId, answers, phase = 'baseline', assessedBy = null }) {
  const result = score(answers);
  return {
    id: `hsi_bullying_${Date.now()}`,
    version: VERSION,
    phase,
    studentId,
    assessedBy,
    createdAt: new Date().toISOString(),
    result
  };
}

module.exports = {
  VERSION,
  QUESTIONS,
  DIMENSIONS,
  score,
  compare,
  buildAssessment
};
