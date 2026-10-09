# Importação RENAST/RENAEST — Dados Abertos para SIGES

## Diagnóstico de infraestrutura (09/10/2026)
- O workspace Render **SIGES-Escola-Segura** não possui instância PostgreSQL.
- O único serviço encontrado é um site estático do frontend. Não há API de produção conectada a banco.
- O ZIP contém quatro CSVs delimitados por ponto e vírgula, totalizando aproximadamente 4,76 GB descompactados. Um banco gratuito pequeno não deve ser presumido suficiente; confirme armazenamento disponível e política de retenção antes de escolher o destino.
- Nenhum recurso Render foi criado e nenhuma cobrança foi autorizada.

## Importador seguro
O script `scripts/import_renaest_zip.py` carrega os quatro CSVs em tabelas de staging `*_raw`, com colunas TEXT para preservar os valores originais. Ele:
- lê os membros diretamente do ZIP, sem descompactar todos os CSVs em disco;
- usa COPY do PostgreSQL para desempenho;
- executa cada arquivo em transação própria;
- registra hash do ZIP, status e contagem em `renaest_import_runs`;
- ignora arquivos já concluídos com o mesmo hash;
- interrompe se uma tabela de staging já tiver linhas, evitando duplicação silenciosa;
- não apaga tabelas nem dados existentes.

## Execução
Requer Python 3.10+ e conectividade ao PostgreSQL de destino.

```bash
python -m pip install -r scripts/renaest-import-requirements.txt
# Configure DATABASE_URL como variável de ambiente; nunca grave credenciais no repositório.
python scripts/import_renaest_zip.py "/caminho/renaest_dabertos_20260412.zip"
```

## Próximas etapas obrigatórias
1. Provisionar/selecionar PostgreSQL com capacidade suficiente e política de retenção compatível, sem exceder o orçamento aprovado.
2. Configurar `DATABASE_URL` apenas como segredo no serviço backend (não no frontend estático).
3. Executar importação em ambiente de homologação e validar contagens, linhas rejeitadas e chaves.
4. Criar índices e camada tipada/consultável após a carga bruta.
5. Integrar endpoints autenticados ao backend do SIGES e apresentar os dados no portal.
6. Não publicar nem expor dados individuais de vítimas; aplicar minimização, controle de acesso e auditoria.

**Estado:** script preparado em branch de trabalho; importação real ainda depende de banco PostgreSQL provisionado e credenciais seguras.
