# Inventário de fontes públicas para o SIGES — Escola Segura

**Branch:** `audit/siges-data-source-catalog`  
**Objetivo:** documentar fontes candidatas para alimentar a base analítica do SIGES, com atualização controlada, rastreabilidade e sem duplicação.  
**Status:** inventário técnico inicial; URLs foram identificadas, mas cada arquivo/endpoint precisa passar por teste automatizado de disponibilidade, esquema, licença e volume antes de entrar em produção.

## Regras de integração

1. Priorizar APIs e catálogos oficiais; usar downloads oficiais quando não houver API adequada.
2. Registrar para cada coleta: `source_id`, URL, data/hora, versão ou data de referência, checksum quando aplicável, quantidade de registros, erros e estado da execução.
3. Importar em lotes com retomada segura. Não carregar arquivos de vários gigabytes integralmente na memória.
4. Preservar a chave e a procedência da fonte original. Não somar fontes com possível sobreposição (por exemplo, RENAEST, PRF, DNIT e ANTT) sem regra documentada de conciliação.
5. Usar código IBGE para território e código INEP para escola quando disponíveis. Evitar correspondência exclusivamente por nome.
6. Dados públicos de saúde e educação devem ser usados na granularidade necessária, com avaliação LGPD; não importar identificadores pessoais desnecessários.
7. Não considerar cache em memória nem JSON local do Render como persistência durável para a base analítica.
8. Não criar novo banco, armazenamento ou serviço pago. Primeiro verificar os recursos gratuitos existentes e os seus limites.

## Fontes prioritárias

| Prioridade | Domínio | Fonte oficial | Conteúdo relevante | Acesso candidato | Frequência de referência | Situação |
|---|---|---|---|---|---|---|
| P0 | Sinistros | [RENAEST — catálogo](https://dados.transportes.gov.br/dataset/renaest) | Sinistros, localidades, vítimas, tipos de veículo, data, gravidade e localização | CKAN `package_show?id=renaest`: https://dados.transportes.gov.br/api/3/action/package_show?id=renaest; recursos mensais ZIP/CSV | Conforme publicação do catálogo | Já existe coletor no backend, mas limitado a ZIP de 50 MiB e cache em memória; não persiste registros |
| P0 | Escolas | [INEP — Catálogo de Escolas](https://www.gov.br/inep/pt-br/acesso-a-informacao/dados-abertos/inep-data/catalogo-de-escolas/) | Código INEP, endereço, município, rede e situação de funcionamento | Exportação/catálogo oficial | Anual, conforme Censo Escolar | Descobrir arquivo exportável estável e validar colunas |
| P0 | Território | [IBGE — Códigos de municípios](https://www.ibge.gov.br/explica/codigos-dos-municipios.php) | Código IBGE, UF e município para chave de ligação | Tabela oficial e APIs públicas do IBGE | Conforme atualização do órgão | Candidato a tabela mestre |
| P1 | Sinistros rodoviários | [PRF — Dados Abertos](https://www.gov.br/prf/pt-br/acesso-a-informacao/dados-abertos/dados-abertos-da-prf) | Sinistros por ocorrência e por pessoa, causas e gravidade em rodovias federais | Arquivos CSV oficiais por ano | Página oficial lista bases anuais e arquivos correntes | Verificar sobreposição com RENAEST/DNIT antes de consolidar |
| P1 | Rodovias | [DNIT — Sinistros de Trânsito](https://www.gov.br/dnit/pt-br/assuntos/infraestrutura-rodoviaria/sinistros-de-transito/sinistros-de-transito) | Sinistros em trechos do Sistema Nacional de Viação, tipo, causa e gravidade | Painel/dados oficiais; localizar exportação automatizável | O DNIT informa atualização mensal após dados PRF | Fonte derivada em grande parte da PRF; não contar como fonte independente |
| P1 | Frota | [SENATRAN — Frota 2026](https://www.gov.br/transportes/pt-br/assuntos/transito/conteudo-Senatran/frota-de-veiculos-2026) | Frota por UF, município, tipo, espécie e outras dimensões | XLSX/arquivos publicados na página | Mensal, conforme página de referência | Identificar links diretos estáveis e esquema de cada planilha |
| P1 | Saúde | [Portal de Dados Abertos do SUS](https://dadosabertos.saude.gov.br/) | CNES, hospitais, leitos e indicadores públicos agregados pertinentes | Catálogo CKAN; o backend atual referencia `package_show?id=hospitais-e-leitos` | Conforme conjunto | Endpoint já referenciado no código; testar licença, data e esquema |
| P1 | Geoespacial municipal | [SIMGeo — Joinville](https://simgeodados.joinville.sc.gov.br/) | Escolas, vias, ciclovias e camadas territoriais municipais | Serviços REST/ArcGIS já referenciados em `backend/public-sources.js` | Conforme atualização de cada camada | Código já consulta metadados/contagens; validar campos e paginação |
| P1 | Geoespacial municipal | [Serviços geográficos de Joinville](https://geo.joinville.sc.gov.br/server/rest/services/simgeo) | Camadas geográficas do SIMGeo | ArcGIS REST | Conforme camada | Validar endpoint por camada, campos, geometria, limite de registros e licença |
| P2 | Meteorologia | [INMET — Dados históricos](https://portal.inmet.gov.br/dadoshistoricos) | Precipitação, temperatura e observações de estações | Arquivos históricos e dados de estações | Conforme publicação | Associar estação, data/hora e distância; não inferir chuva no local sem método |
| P2 | Mobilidade | [Ministério das Cidades — PEMOB 2025](https://www.gov.br/cidades/pt-br/assuntos/mobilidade-urbana/pesquisa-nacional-de-mobilidade-urbana-pemob-2025) | Dados municipais/metropolitanos de mobilidade e transporte coletivo | Bases para download | Por edição da pesquisa | Verificar cobertura: a PEMOB municipal 2025 tem universo definido por população/respondentes |
| P2 | Estado | [Dados Abertos de Santa Catarina](https://dados.sc.gov.br/) | Educação, segurança pública, saúde, infraestrutura e território estaduais | Catálogo estadual; testar API/recursos de cada conjunto | Por conjunto | Varredura de datasets ainda pendente |
| P2 | Estatísticas de trânsito | [SENATRAN — Estatísticas](https://www.gov.br/transportes/pt-br/assuntos/transito/senatran/estatisticas-senatran) | Frota, condutores habilitados, infrações e estatísticas de trânsito | Relatórios e arquivos oficiais | Por conjunto | Avaliar relevância, granularidade e licenças |

## Fontes municipais já referenciadas no backend

O arquivo `backend/public-sources.js` já define referências para:
- CBVJ: ocorrências atendidas em Joinville;
- DETRANS: estudos técnicos de fiscalização eletrônica;
- SIMGeo: escolas, sistema viário, ciclovias e camada de acidentes;
- RENAEST: catálogo CKAN e arquivos mensais;
- Ministério da Saúde: catálogo de hospitais e leitos.

Rotas de leitura já implementadas no backend:
- `/api/public-sources/health`
- `/api/public-sources/status`
- `/api/public-sources/cbvj`
- `/api/public-sources/detrans`
- `/api/public-sources/detrans-correlations`
- `/api/public-sources/simgeo`
- `/api/public-sources/renaest`
- `/api/public-sources/health-data`

Essas rotas indicam consultas e cache de resultados, não uma importação durável para PostgreSQL. A rota `/renaest` limita ZIPs a 50 MiB e usa `AdmZip`, então não é adequada para os arquivos completos de vários gigabytes sem redesenho do processamento.

## Modelo lógico mínimo para a ingestão

### 1. Catálogo de fontes
- identificador estável da fonte;
- nome e órgão responsável;
- URL do catálogo e URL do recurso;
- formato, licença, cobertura geográfica e frequência esperada;
- ativo/inativo e última validação.

### 2. Histórico de execuções
- fonte;
- início, término e estado;
- versão/data de referência do recurso;
- checksum/tamanho quando aplicável;
- registros lidos, inseridos, atualizados, ignorados e rejeitados;
- mensagem de erro e estratégia de retomada.

### 3. Dados brutos por domínio
Separar dados de sinistros, vítimas, veículos, localidades, escolas, frota, infraestrutura, meteorologia e indicadores agregados de saúde. Usar chaves únicas derivadas de identificadores de origem e período. Para arquivos grandes, importar em lotes e manter o processo idempotente.

### 4. Dados analíticos
Vincular por código IBGE, código INEP, data/período e identificadores geográficos. Guardar a metodologia e a fonte que sustentam cada indicador do SIGES. Nunca apresentar um indicador derivado como dado oficial sem explicitar o cálculo.

## Critérios para liberar uma fonte para produção

- [ ] URL acessível sem autenticação não prevista.
- [ ] Formato e codificação detectados.
- [ ] Dicionário de dados e colunas mapeados.
- [ ] Data de referência e frequência identificadas.
- [ ] Licença e condições de uso verificadas.
- [ ] Chave de deduplicação definida.
- [ ] Volume medido; leitura por streaming/lotes testada.
- [ ] Importação de teste validada contra totais oficiais.
- [ ] Reexecução não duplica registros.
- [ ] Fonte e execução ficam registradas de forma persistente.
- [ ] Indicadores resultantes têm origem, data e metodologia rastreáveis.

## Bloqueio técnico atual

A auditoria do projeto Supabase SIGES mostrou 14 tabelas públicas sem registros. O backend do Render usa `backend/data/db.json` e `/api/health` declara `mode: local`; o `backend/package.json` não contém cliente Supabase nem driver PostgreSQL. Assim, antes da ingestão em massa, é necessário definir e testar a conexão segura do backend com o projeto Supabase já existente. Não se deve colocar chaves secretas no repositório ou no frontend.

## Próxima sequência

1. Confirmar a conexão segura do backend Render ao Supabase existente, sem expor segredos.
2. Definir o esquema de persistência e o registro de execuções.
3. Fazer um piloto pequeno com municípios/escolas.
4. Adaptar o RENAEST para processamento em streaming/lotes.
5. Adicionar PRF, SENATRAN e DNIT com regras de conciliação.
6. Incorporar as demais fontes após validação individual.
7. Agendar coleta e auditoria dentro dos limites dos planos gratuitos.


## Camada de catálogo persistente (fase implementada)

O Supabase existente agora possui três tabelas de controle, com RLS habilitado:
- `public.data_source_catalog`: 13 fontes cadastradas;
- `public.data_source_resources`: recursos/URLs descobertos;
- `public.data_ingestion_runs`: histórico de execuções e contagens.

As tabelas foram criadas por migrações versionadas em `supabase/migrations/`. O catálogo foi semeado de forma idempotente. Nenhum CSV/ZIP externo foi importado nesta fase.

Foi adicionada uma API administrativa no branch `audit/siges-data-source-catalog`:
- `GET /api/admin/data-sources/health`: testa se a API consegue consultar o catálogo Supabase;
- `GET /api/admin/data-sources`: lista fontes;
- `GET /api/admin/data-sources/resources`: lista recursos descobertos;
- `GET /api/admin/data-sources/runs`: lista as últimas execuções.

Essas rotas exigem sessão válida do SIGES e perfil administrativo ENAT. A conexão usa somente o backend e exige duas variáveis no serviço Render: `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY`. A chave de serviço jamais deve ser colocada no GitHub, no frontend ou em mensagens. As rotas ainda não foram testadas contra o Render porque o branch não foi implantado e as variáveis de ambiente não foram configuradas.

## Estado verificado após a fase de catálogo

- Consulta direta ao Supabase confirmou **13 fontes ativas** em `public.data_source_catalog`, **0 recursos descobertos** em `public.data_source_resources` e **0 execuções de ingestão** em `public.data_ingestion_runs`.
- As três tabelas de controle têm RLS habilitado e não têm políticas públicas. O aviso informativo `rls_enabled_no_policy` é esperado neste desenho; não se deve liberar acesso público para contornar o aviso.
- As migrações remotas confirmadas incluem `20261009133325`, `20261009133345` e `20261009133502`; a última adiciona índice à chave estrangeira `data_ingestion_runs.resource_id`.
- A revisão de performance posterior à alteração ainda lista avisos preexistentes em outras tabelas do SIGES, incluindo chaves estrangeiras sem índice e otimização de políticas RLS. O índice de `data_ingestion_runs.resource_id` aparece como não utilizado porque ainda não há execuções registradas; isso, isoladamente, não justifica removê-lo.
- Revisão de segurança do router no branch confirmou: autenticação existente, verificação de perfil `enat`, rotas somente de leitura, validação de que `SUPABASE_URL` usa HTTPS e respostas sem detalhes brutos de erro do Supabase.
- A API ainda **não foi implantada nem testada em runtime**. O serviço Render de produção continua na branch `main`; o código desta fase permanece em `audit/siges-data-source-catalog`. Não foram configuradas variáveis secretas nem importados CSV/ZIP externos.
- Próximo passo seguro: preparar uma validação controlada da API antes de qualquer implantação; somente depois testar a conexão do backend e implementar ingestão RENAEST por lotes com idempotência.
