# SIGES — Plataforma Territorial de Dados

## Objetivo
Uma entrada única de dados para municípios e estados brasileiros, preservando a origem dos registros e permitindo indicadores por nível geográfico.

## Fluxo proposto
1. Receber arquivo e registrar fonte, formato, hash SHA-256 e responsável.
2. Validar estrutura e exibir prévia das colunas.
3. Mapear colunas e confirmar UF, município/código IBGE, período e granularidade.
4. Processar em lotes retomáveis, contabilizando aceitos, rejeitados e duplicados.
5. Preservar os dados brutos e o resultado de validação por linha.
6. Normalizar em indicadores, mantendo fonte, competência, granularidade e revisão.
7. Expor dados nos painéis com filtros territoriais e autorização no servidor/banco.

## Regras de integridade
- Não inferir acidentes por rua a partir de dados agregados por município.
- Não transformar dado ausente em zero.
- Toda linha mantém arquivo, número de linha, fingerprint, período e validação.
- Reimportações idênticas devem ser detectadas; correções oficiais geram revisão rastreável.
- Dados brutos não são publicados diretamente para usuários finais.
- Vincular município pelo código IBGE, não somente pelo nome digitado.
- Aplicar controle de acesso por território no servidor e por políticas RLS no banco.

## Esquema inicial
A migração 001 cria:
- siges_ufs e siges_municipalities: catálogo territorial.
- siges_data_sources: fontes e granularidade.
- siges_import_jobs: status, progresso, contagens e erros por importação.
- siges_raw_records: staging JSONB, payload original e validação por linha.
- siges_indicators: dados normalizados, nível geográfico e histórico de revisões.

## Implantação segura
1. Confirmar o projeto Supabase oficial e realizar backup.
2. Aplicar a migração primeiro em ambiente de teste.
3. Mapear autenticação e papéis atuais antes de criar políticas RLS.
4. Implementar upload em partes e processamento em lotes.
5. Validar com o ZIP RENAEST de abril de 2026 e comparar contagens com a fonte.
6. Liberar inicialmente apenas para administração; depois habilitar escopos municipais/estaduais.
7. Rodar CI e testes de regressão antes do deploy.

## Limite desta entrega
A migração define a estrutura de dados; não é aplicada automaticamente e não significa que os dados já foram importados. O backend atual usa JSON local em parte do sistema. A conexão ao Supabase, a API de ingestão e a interface de importação precisam ser implementadas e homologadas separadamente para proteger os dados e a autenticação existentes.
