# SIGES — Importação RENAEST de arquivos grandes

## Objetivo
Processar ZIPs de Vítimas e Acidentes maiores que 512 MB sem carregar o arquivo inteiro na memória nem encaminhá-lo no corpo de uma requisição HTTP. O importador usa streams de arquivo → ZIP → CSV → lotes PostgreSQL.

## Estado desta entrega
- Implementados nesta branch o esquema PostgreSQL e o módulo de processamento por streaming/lotes.
- Esta branch não está publicada no Render e a importação está desativada até o banco SIGES correto ser confirmado e as variáveis necessárias serem configuradas.
- Nenhum banco foi alterado e nenhum arquivo de produção foi importado.
- O módulo preserva dados de todas as localidades, registra hash para deduplicação e contabiliza linhas inseridas, duplicadas e rejeitadas.
- O parser aceita CSV/TXT dentro de ZIP. Arquivos XLSX precisam de conversão para CSV em uma etapa separada; não devem ser renomeados como CSV.

## Ativação segura
1. Confirmar/criar o PostgreSQL persistente destinado ao SIGES (não reutilizar automaticamente o projeto Supabase HSI-DOTH-P-G).
2. Aplicar backend/migrations/002_renaest_streaming_import.sql nesse banco confirmado.
3. Configurar DATABASE_URL e, se necessário, DATABASE_SSL no serviço de processamento.
4. Armazenar o arquivo original em object storage privado (ex.: Cloudflare R2) e transferi-lo para o worker como stream/arquivo, sem upload pelo limite de requisição do portal.
5. Executar o worker em serviço separado do frontend e da API web. Não executar ZIPs de centenas de MB dentro de uma requisição HTTP.
6. Fazer importação-piloto de um mês, conferir contagens com a fonte oficial, depois processar o restante.
7. Expor no portal o progresso e o relatório final somente depois da homologação.

## Contrato do módulo
importRenaestZip({ filePath, dataset, sourceName, importJobId? })
- dataset: renaest_vitimas ou renaest_acidentes.
- filePath: caminho local do arquivo ZIP já disponível no worker.
- Retorna ID do job, bytes, arquivos, linhas lidas/inseridas/duplicadas/rejeitadas e status.
- O ZIP/CSV não é carregado integralmente em memória.
- O período é inferido do nome do arquivo; se o nome não codificar mês/ano, o período ficará nulo e precisa ser informado por metadados.

## Dependências
pg, unzipper, csv-parse.

## Limitações antes da homologação
- Mapear os nomes reais de colunas do RENAEST depois de inspecionar o arquivo.
- Verificar se os arquivos contêm uma linha por ocorrência, vítima ou agregado. A chave hash elimina linhas idênticas dentro de cada conjunto, mas não substitui uma chave de negócio oficial.
- Adicionar download seguro de objeto privado (R2/S3), controles de acesso ENAT, cancelamento/retomada e uma tela administrativa antes da liberação em produção.
- Não converter totais municipais em valores por rua/corredor.

## Inspeção prévia do arquivo (sem banco)
Antes de importar, é possível listar os arquivos CSV/TXT dentro do ZIP, ler somente até quatro registros por arquivo e mostrar os cabeçalhos e uma pequena amostra, sem conectar ao PostgreSQL:
```bash
cd backend
npm install
npm run inspect:renaest -- "/caminho/arquivo.zip"
``
A inspeção não importa dados e não fornece contagem total de linhas. Use a saída para confirmar cabeçalhos, separador e granularidade antes de qualquer carga.
