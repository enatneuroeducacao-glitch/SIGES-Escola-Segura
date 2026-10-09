'use strict';
const path = require('node:path');
const { importRenaestZip, pool } = require('./renaest-stream-import');

async function main() {
  const [dataset, inputPath, ...nameParts] = process.argv.slice(2);
  if (!dataset || !inputPath || !nameParts.length) {
    console.error('Uso: npm run import:renaest -- renaest_vitimas|renaest_acidentes /caminho/arquivo.zip "nome do arquivo"');
    process.exitCode = 2;
    return;
  }
  if (!process.env.DATABASE_URL) {
    console.error('ERRO: DATABASE_URL não configurada. Nenhum dado foi alterado.');
    process.exitCode = 2;
    return;
  }
  try {
    const result = await importRenaestZip({
      dataset,
      filePath: path.resolve(inputPath),
      sourceName: nameParts.join(' ')
    });
    console.log(JSON.stringify(result, null, 2));
    if (result.status !== 'completed') process.exitCode = 1;
  } catch (error) {
    console.error('Falha na importação RENAEST:', error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}
main();
