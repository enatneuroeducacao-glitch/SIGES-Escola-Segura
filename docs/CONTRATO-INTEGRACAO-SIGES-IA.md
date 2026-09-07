# Contrato de Integração — SIGES ↔ Camada de IA

## Objetivo
Preparar o SIGES para interoperar com uma futura IA de inteligência de trânsito e segurança escolar sem compartilhar banco de dados diretamente.

## Princípio de isolamento
A futura IA deverá consumir apenas eventos/indicadores autorizados por uma API de interoperabilidade. Não haverá acesso direto ao banco do SIGES.

## Envelope v1
```json
{
  "schema": "siges.intelligence.v1",
  "event": "risk_signal",
  "source": "siges",
  "timestamp": "ISO-8601",
  "scope": {
    "schoolId": "...",
    "municipality": "...",
    "uf": "..."
  },
  "payload": {},
  "confidence": 0.0,
  "traceId": "..."
}
```

## Eventos previstos
- `risk_signal` — sinal qualificado de risco.
- `trend_signal` — mudança relevante ao longo do tempo.
- `hotspot_signal` — concentração territorial/temporal de sinais.
- `action_signal` — necessidade ou estado de intervenção.
- `data_quality_signal` — problema de completude, consistência ou confiabilidade.

## Limites da IA
A IA poderá analisar, correlacionar, explicar e sugerir. Não poderá, por si só:
- alterar dados de alunos;
- alterar resultados HSI-DOTH-P;
- aprovar reivindicações;
- emitir ou invalidar certificados;
- alterar permissões;
- apagar evidências;
- executar decisões públicas em nome de uma escola ou órgão.

## HSI-DOTH-P Bullying
O SIGES poderá disponibilizar somente indicadores agregados/autorizados para inteligência. O fluxo individual permanece protegido e não deverá ser usado para diagnóstico clínico ou rotulação de estudantes.

## Segurança
Toda integração futura deverá utilizar autenticação, autorização por escopo, versionamento de contrato, `traceId`, registro de auditoria e minimização de dados.

## Status
Contrato arquitetural. Nenhuma integração externa é ativada por este documento.
