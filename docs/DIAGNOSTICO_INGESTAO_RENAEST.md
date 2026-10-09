# Diagnóstico de ingestão persistente do RENAEST

Data da verificação: 2026-10-09

## Estado confirmado no Supabase

| Tabela | Registros |
|---|---:|
| `data_source_catalog` | 13 |
| `data_source_resources` | 0 |
| `data_ingestion_runs` | 0 |

O catálogo de fontes está instalado, mas nenhum recurso foi persistido e nenhuma execução de ingestão foi registrada. Isso significa que a existência do catálogo não comprova importação de dados operacionais.

## Bloqueio técnico encontrado

O backend atual em `backend/public-sources.js` baixa arquivos RENAEST para memória e recusa ZIPs maiores que 50 MiB. O código usa `adm-zip`, extrai CSV/TXT e guarda os resultados apenas em cache de memória. Portanto, os dados não ficam persistidos no Supabase e o processamento é perdido quando o processo reinicia.

O catálogo oficial publica arquivos mensais RENAEST com centenas de MiB. A página do recurso de setembro de 2025 informa 463,6 MiB; outros recursos mensais indexados aparecem em torno de 438–500 MiB. Assim, o limite atual de 50 MiB impede a ingestão desses arquivos oficiais. Fonte: https://dados.transportes.gov.br/dataset/renaest

## Pré-validação do arquivo enviado

Foi adicionada a ferramenta somente de leitura `scripts/renaest_preflight.py`. Ela percorre os CSVs/TXTs dentro do ZIP em fluxo, sem descompactar o conjunto inteiro para o disco, e produz um relatório JSON com cabeçalhos, delimitador, codificação, tamanho, CRC do membro e contagem de linhas. Quando identifica colunas de município/UF/código IBGE, também conta as linhas compatíveis com Joinville/SC. Ela não envia dados ao banco.

Uso local (Python 3 padrão, sem instalar dependências):

```bash
python scripts/renaest_preflight.py "renaest_dabertos_20260412 (1)(1).zip" --json renaest-preflight.json
```

Cabeçalhos verificados nos dois CSVs individuais que já estão disponíveis na biblioteca:

- `Localidade_DadosAbertos_20260412.csv`: `chv_localidade; ano_referencia; mes_referencia; mes_ano_referencia; regiao; uf; codigo_ibge; municipio; regiao_metropolitana; qtde_habitantes; frota_total; frota_circulante`.
- `TipoVeiculo_DadosAbertos_20260412.csv`: `num_acidente; tipo_veiculo; ind_veic_estrangeiro; qtde_veiculos`.

Os cabeçalhos de Sinistros e Vitimas ainda precisam ser confirmados pelo relatório de pré-validação antes de definir chaves estrangeiras e tabelas finais. Não foi inferida uma relação entre tabelas apenas pelos nomes dos arquivos.

## Decisão segura

Não aumentar simplesmente o limite de ZIP nem carregar arquivos completos na memória do Render Free. Isso pode causar consumo excessivo de memória, reinício do serviço e nenhuma persistência durável.

A próxima implementação deve ser uma ingestão em lotes, idempotente e auditável, usando processamento em fluxo (streaming) fora do caminho de requisição normal:

1. Identificar e validar cabeçalhos e chaves estáveis de cada CSV oficial (Sinistros, Localidade, TipoVeiculo e Vitimas).
2. Criar tabelas de destino com chave natural/única e metadados de origem, após confirmar o esquema real dos CSVs.
3. Processar ZIP/CSV em fluxo, sem descompactar tudo em memória.
4. Fazer upsert em lotes pequenos no Supabase; nunca colocar a chave `service_role` no frontend, no Git ou em mensagens.
5. Gravar início/fim, checksum, competência, lidas, inseridas, atualizadas, ignoradas e rejeitadas em `data_ingestion_runs`.
6. Tornar a execução retomável e idempotente; não reimportar cegamente arquivos já concluídos.
7. Validar contagens e amostras em cada tabela e, por fim, confirmar que a API e as telas do SIGES leem os registros persistidos.

## Critérios para considerar concluído

- Recursos oficiais identificados e registrados em `data_source_resources`.
- Execução com status `succeeded` ou `partial` e contagens coerentes em `data_ingestion_runs`.
- Registros reais persistidos nas tabelas de destino, com deduplicação comprovada.
- API do SIGES retorna esses registros sem depender de cache em memória.
- Tela correspondente exibe os mesmos totais e informa a competência/data da fonte.
- Teste de repetição da mesma importação não duplica registros.

## Ambiente e produção

Este diagnóstico foi documentado na branch de auditoria. Não foi feito deploy nem alteração das tabelas operacionais do SIGES. O branch de produção continua separado até a ingestão passar pelos critérios acima.
