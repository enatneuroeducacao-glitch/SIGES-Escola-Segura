'use strict';
const fs = require('node:fs');
const crypto = require('node:crypto');
const unzipper = require('unzipper');
const { parse } = require('csv-parse');
const { Pool } = require('pg');

const BATCH_SIZE = Math.max(100, Math.min(5000, Number(process.env.SIGES_RENAEST_BATCH_SIZE) || 1000));
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.DATABASE_SSL === 'false' ? false : { rejectUnauthorized: false }, max: 3 });

function normalizeKey(value) { return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ''); }
function pick(row, patterns) {
  for (const [key, value] of Object.entries(row)) {
    if (patterns.some(pattern => pattern.test(normalizeKey(key))) && String(value ?? '').trim() !== '') return String(value).trim();
  }
  return null;
}
function inferPeriod(filename) {
  const match = String(filename).match(/(?:^|[^0-9])(0[1-9]|1[0-2])[-_ ]?(20[0-9]{2})(?:[^0-9]|$)|(?:^|[^0-9])(20[0-9]{2})[-_ ]?(0[1-9]|1[0-2])(?:[^0-9]|$)/i);
  return match ? { year: Number(match[2] || match[3]), month: Number(match[1] || match[4]) } : { year: null, month: null };
}
function identifyMunicipality(row) {
  const code = pick(row, [/^(codigomunicipio|codmunicipio|municipioibge|codibge|codmun|ibge)$/]);
  const name = pick(row, [/^(municipio|nomemunicipio|municipionome|cidade|localidade)$/]);
  const uf = pick(row, [/^(uf|siglauf|unidadefederativa)$/]);
  return { code: code ? code.replace(/\D/g, '').padStart(7, '0') : null, name, uf: uf ? uf.toUpperCase().slice(0, 2) : null };
}
function hashRow(dataset, row, period = {}) {
  const stable = Object.keys(row).sort().map(key => [key, String(row[key] ?? '').trim()]);
  const periodKey = (period.year || '') + '-' + (period.month || '');
  return crypto.createHash('sha256').update(dataset + '\n' + periodKey + '\n' + JSON.stringify(stable)).digest('hex');
}
async function updateJob(client, id, patch) {
  if (!id) return;
  const fields = Object.keys(patch);
  const sets = fields.map((field, i) => field + ' = $' + (i + 2));
  await client.query('UPDATE siges_import_jobs SET ' + sets.join(', ') + ', updated_at = NOW() WHERE id = $1', [id, ...fields.map(field => patch[field])]);
}
async function persistBatch(client, dataset, rows) {
  let inserted = 0, duplicate = 0, rejected = 0;
  await client.query('BEGIN');
  try {
    for (const item of rows) {
      // PostgreSQL marks a transaction as failed after a statement error. Isolate each
      // row with a savepoint so one malformed record does not poison the whole batch.
      await client.query('SAVEPOINT renaest_row');
      try {
        const result = await client.query(
          'INSERT INTO siges_renaest_records(dataset,import_job_id,source_name,source_entry,period_year,period_month,municipality_code,municipality_name,uf,record_hash,row_data) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb) ON CONFLICT(dataset,record_hash) DO NOTHING RETURNING id',
          [dataset,item.jobId,item.sourceName,item.entry,item.period.year,item.period.month,item.municipality.code,item.municipality.name,item.municipality.uf,item.recordHash,JSON.stringify(item.row)]
        );
        await client.query('RELEASE SAVEPOINT renaest_row');
        if (result.rowCount) inserted++; else duplicate++;
      } catch (error) {
        await client.query('ROLLBACK TO SAVEPOINT renaest_row');
        await client.query('RELEASE SAVEPOINT renaest_row');
        rejected++;
        if (['57P01', '08000', '08003', '08006', '08001', '40001'].includes(error.code)) throw error;
      }
    }
    await client.query('COMMIT');
  } catch (error) { await client.query('ROLLBACK').catch(() => {}); throw error; }
  return { inserted, duplicate, rejected };
}
async function importRenaestZip({ filePath, dataset, sourceName, importJobId }) {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL não configurada; importação desativada para proteger os dados existentes.');
  if (!['renaest_vitimas', 'renaest_acidentes'].includes(dataset)) throw new Error('Dataset inválido.');
  const stat = await fs.promises.stat(filePath);
  const client = await pool.connect();
  let jobId = importJobId || crypto.randomUUID();
  let batch = [], rowsRead = 0, rowsInserted = 0, rowsDuplicate = 0, rowsRejected = 0, entriesSeen = 0;
  try {
    await client.query('INSERT INTO siges_import_jobs(id,dataset,source_name,file_bytes,status,started_at) VALUES ($1,$2,$3,$4,\'processing\',NOW())', [jobId, dataset, sourceName, stat.size]);
    const zip = fs.createReadStream(filePath).pipe(unzipper.Parse({ forceStream: true }));
    for await (const entry of zip) {
      if (entry.type !== 'File' || !/\.(csv|txt)$/i.test(entry.path) || /(^|\/)\./.test(entry.path)) { entry.autodrain(); continue; }
      entriesSeen++;
      await updateJob(client, jobId, { current_entry: entry.path, entries_seen: entriesSeen });
      const period = inferPeriod(entry.path || sourceName);
      const parser = entry.pipe(parse({ bom: true, columns: headers => headers.map((h, i) => String(h || '').trim() || 'campo_' + (i + 1)), delimiter: [',', ';', '\t', '|'], skip_empty_lines: true, relax_column_count: true, trim: true }));
      for await (const row of parser) {
        rowsRead++;
        const municipality = identifyMunicipality(row);
        batch.push({ jobId, sourceName, entry: entry.path, period, municipality, recordHash: hashRow(dataset, row, period), row });
        if (batch.length >= BATCH_SIZE) {
          const result = await persistBatch(client, dataset, batch);
          rowsInserted += result.inserted; rowsDuplicate += result.duplicate; rowsRejected += result.rejected; batch = [];
          await updateJob(client, jobId, { rows_read: rowsRead, rows_inserted: rowsInserted, rows_duplicate: rowsDuplicate, rows_rejected: rowsRejected });
        }
      }
    }
    if (batch.length) {
      const result = await persistBatch(client, dataset, batch);
      rowsInserted += result.inserted; rowsDuplicate += result.duplicate; rowsRejected += result.rejected;
    }
    await updateJob(client, jobId, { status: rowsRejected ? 'partial' : 'completed', entries_seen: entriesSeen, rows_read: rowsRead, rows_inserted: rowsInserted, rows_duplicate: rowsDuplicate, rows_rejected: rowsRejected, current_entry: null, finished_at: new Date() });
    return { importJobId: jobId, status: rowsRejected ? 'partial' : 'completed', fileBytes: stat.size, entriesSeen, rowsRead, rowsInserted, rowsDuplicate, rowsRejected };
  } catch (error) {
    await updateJob(client, jobId, { status: 'failed', rows_read: rowsRead, rows_inserted: rowsInserted, rows_duplicate: rowsDuplicate, rows_rejected: rowsRejected, error_summary: String(error.message || error).slice(0, 2000), finished_at: new Date() }).catch(() => {});
    throw error;
  } finally { client.release(); }
}
module.exports = { importRenaestZip, pool, inferPeriod, identifyMunicipality, hashRow };
