const assert = require('node:assert/strict');
const {
  priorityScore,
  priorityBand,
  buildRiskSignal,
  coexistenceIndex,
  evolution
} = require('./engine');

assert.equal(priorityScore({severity:100,frequency:100,exposure:100,vulnerability:100,proximity:100,recurrence:100,evidenceQuality:100,trend:100}),100);
assert.equal(priorityBand(85),'CRÍTICA');
assert.equal(priorityBand(65),'ALTA');
assert.equal(priorityBand(40),'MODERADA');
assert.equal(priorityBand(20),'BAIXA');

const signal = buildRiskSignal({
  category:'bullying',
  severity:80,
  frequency:70,
  exposure:60,
  vulnerability:80,
  proximity:50,
  recurrence:70,
  evidenceQuality:90,
  trend:60,
  confidence:0.9,
  scope:{schoolId:'test-school'}
});
assert.equal(signal.schema,'siges.intelligence.v1');
assert.equal(signal.event,'risk_signal');
assert.equal(signal.source,'siges');
assert.equal(signal.scope.schoolId,'test-school');
assert.ok(signal.score >= 0 && signal.score <= 100);
assert.ok(signal.explainability.ruleVersion);

assert.equal(coexistenceIndex({safetyPerception:100,belonging:100,respect:100,peerPressure:100,responseConfidence:100}),100);
assert.deepEqual(evolution(40,70),{before:40,after:70,delta:30,direction:'melhora'});
assert.deepEqual(evolution(70,40),{before:70,after:40,delta:-30,direction:'redução'});

console.log('SIGES intelligence engine: OK');
