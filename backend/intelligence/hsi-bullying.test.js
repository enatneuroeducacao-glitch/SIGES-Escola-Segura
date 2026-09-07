const assert = require('node:assert/strict');
const { QUESTIONS, score, compare, buildAssessment } = require('./hsi-bullying');

const answers = Object.fromEntries(QUESTIONS.map(q => [q.id, 5]));

const result = score(answers);
assert.equal(QUESTIONS.length, 30);
assert.equal(result.score, 100);
assert.equal(result.nonClinical, true);

const low = score(Object.fromEntries(QUESTIONS.map(q => [q.id, 1])));
assert.equal(low.score, 0);

const evolution = compare(55, 73);
assert.deepEqual(evolution, { before: 55, after: 73, delta: 18, direction: 'melhora' });

const assessment = buildAssessment({
  studentId: 'student-test',
  answers,
  phase: 'baseline',
  assessedBy: 'user-test'
});
assert.equal(assessment.phase, 'baseline');
assert.equal(assessment.result.score, 100);

assert.throws(() => score({ B01: 5 }), /Resposta inválida/);
assert.throws(() => score({ ...answers, B01: 6 }), /Resposta inválida/);

console.log('HSI-DOTH-P Bullying: testes OK');
