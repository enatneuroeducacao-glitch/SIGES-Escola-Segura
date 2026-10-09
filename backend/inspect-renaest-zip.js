'use strict';
const fs = require('node:fs');
const unzipper = require('unzipper');
const { parse } = require('csv-parse');

const DELIMITERS = [',', ';', '\\t', '|'];

async function inspectRenaestZip(filePath) {
  const stat = await fs.promises.stat(filePath);
  const entries = [];
  const zip = fs.createReadStream(filePath).pipe(unzipper.Parse({ forceStream: true }));
  for await (const entry of zip) {
    if (entry.type !== 'File' || !/\\.(csv|txt)$/i.test(entry.path) || /(^|\\/)\\./.test(entry.path)) {
      entry.autodrain();
      continue;
    }
    let headers = null;
    let samples = [];
    let rows = 0;
    let delimiter = null;
    const parser = entry.pipe(parse({
      bom: true,
      delimiter: DELIMITERS,
      skip_empty_lines: true,
      relax_column_count: true,
      trim: true,
      to: 4
    }));
    try {
      for await (const record of parser) {
        rows++;
        if (!headers) {
          headers = record.map((v, i) => String(v || '').trim() || 'campo_' + (i + 1));
          // csv-parse emits records but does not expose which delimiter matched.
          // Estimate the separator from the header and the observed field count.
          const raw = headers.join(' ');
          delimiter = DELIMITERS.find(d => d !== '\\t' && raw.includes(d)) || 'auto (candidatos)';
        } else if (samples.length < 3) {
          samples.push(record);
        }
      }
    } catch (error) {
      entries.push({ name: entry.path, error: error.message });
      continue;
    }
    entries.push({
      name: entry.path,
      columns: headers || [],
      sampledRecords: samples,
      recordsReadForInspection: rows,
      note: 'Amostra limitada aos primeiros 4 registros; não representa a contagem total.',
      delimiter
    });
  }
  return { fileBytes: stat.size, entries };
}

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error('Uso: npm run inspect:renaest -- /caminho/arquivo.zip');
    process.exitCode = 2;
    return;
  }
  try {
    const report = await inspectRenaestZip(filePath);
    console.log(JSON.stringify(report, null, 2));
  } catch (error) {
    console.error('Falha ao inspecionar ZIP:', error.message);
    process.exitCode = 1;
  }
}
if (require.main === module) main();
module.exports = { inspectRenaestZip };
