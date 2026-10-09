'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { inferPeriod, identifyMunicipality, hashRow } = require('./renaest-stream-import');

test('infers month/year from MM-YYYY archive names', () => {
  assert.deepEqual(inferPeriod('RENAEST-04-2026.csv'), { year: 2026, month: 4 });
});
test('infers month/year from YYYY-MM archive names', () => {
  assert.deepEqual(inferPeriod('acidentes_2026-04.csv'), { year: 2026, month: 4 });
});
test('returns null period when filename has no month', () => {
  assert.deepEqual(inferPeriod('vitimas-geral.csv'), { year: null, month: null });
});
test('identifies Joinville municipality and normalizes IBGE code', () => {
  assert.deepEqual(identifyMunicipality({ 'Código Município': '4209102', Município: 'Joinville', UF: 'sc' }), {
    code: '4209102', name: 'Joinville', uf: 'SC'
  });
});
test('hash is stable when column order changes', () => {
  assert.equal(hashRow('renaest_vitimas', { a: '1', b: '2' }, { year: 2026, month: 4 }),
               hashRow('renaest_vitimas', { b: '2', a: '1' }, { year: 2026, month: 4 }));
});
test('same row in different periods is not silently deduplicated', () => {
  assert.notEqual(hashRow('renaest_acidentes', { total: '10' }, { year: 2026, month: 3 }),
                  hashRow('renaest_acidentes', { total: '10' }, { year: 2026, month: 4 }));
});
