# SIGES — Arquitetura de Inteligência

## Objetivo
Transformar o SIGES — Escola Segura em um sistema de inteligência de segurança viária escolar, sem acoplamento direto aos demais sistemas ENAT.

## Princípio
**Observar → Qualificar → Correlacionar → Priorizar → Agir → Verificar → Aprender.**

O SIGES registra evidências e contexto, calcula sinais explicáveis, organiza intervenções e mede resultados. A inteligência recomenda; a autoridade humana decide.

## Camadas
1. **Coleta** — escolas, alunos, Alunos Guia, formação, HSI-DOTH-P, riscos, ocorrências, reivindicações e evidências.
2. **Qualificação** — validação, origem, confiança, temporalidade, localização e integridade da evidência.
3. **Inteligência** — indicadores, recorrência, concentração temporal/territorial, prioridade e tendências.
4. **Ação** — encaminhamento, plano de ação, responsável, prazo e evidência de execução.
5. **Verificação** — comparação antes/depois e encerramento somente com evidência.
6. **Governança** — permissões, auditoria, privacidade, justificativas e revisão humana.
7. **Interoperabilidade** — contratos versionados para integração futura, sem compartilhar banco ou credenciais.

## Motor de prioridade
A prioridade de um sinal deve ser explicável e parametrizável. Variáveis previstas: gravidade, frequência, exposição, vulnerabilidade, proximidade escolar, recorrência, qualidade da evidência e tendência.

Nenhuma recomendação deve ser apresentada como fato quando houver incerteza. O sistema deve registrar confiança e origem dos sinais.

## Contrato de interoperabilidade
O futuro gateway deve trabalhar com envelopes versionados, por exemplo:

```json
{
  "schema": "siges.intelligence.v1",
  "event": "risk_signal",
  "source": "siges",
  "timestamp": "ISO-8601",
  "scope": {"schoolId": "...", "municipality": "...", "uf": "..."},
  "payload": {},
  "confidence": 0.0,
  "traceId": "..."
}
```

O contrato não concede acesso direto ao banco. Integrações futuras devem usar autenticação própria, escopos mínimos, logs e revogação.

## Integrações futuras
- Central ENAT-HSI: somente por contrato/API autorizada.
- IA especializada de trânsito: consulta e envio de sinais, recomendações e resultados, sem poderes administrativos implícitos.
- Órgãos públicos: somente os campos permitidos pelo perfil e pela governança.

## Guardrails
A camada de IA não pode, por padrão:
- alterar cadastro de alunos;
- alterar resultados HSI-DOTH-P;
- aprovar reivindicações;
- emitir ou invalidar certificados;
- mudar perfis ou permissões;
- apagar evidências;
- executar decisões públicas automaticamente.

Toda ação sensível exige autorização humana e rastreabilidade.

## Privacidade
Indicadores municipais devem privilegiar agregação e minimização. Dados pessoais não devem ser enviados a integrações quando o objetivo puder ser atendido por dados agregados ou pseudonimizados.

## Roadmap técnico
**Fase 1:** contratos, indicadores e sinais explicáveis.

**Fase 2:** módulos de riscos/reivindicações/planos/evidências plenamente operacionais.

**Fase 3:** PostgreSQL dedicado + RLS + observabilidade.

**Fase 4:** gateway de integração e notificações.

**Fase 5:** IA com recuperação de contexto, recomendações explicáveis e avaliação de qualidade.

**Fase 6:** inteligência territorial e análise longitudinal.
