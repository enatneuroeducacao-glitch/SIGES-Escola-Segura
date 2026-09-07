# SIGES — Roadmap de evolução para Inteligência de Trânsito Escolar

## Camada 1 — agora
- Base institucional
- Perfis e governança
- Formação
- HSI-DOTH-P
- Riscos, reivindicações e planos de ação
- Auditoria e certificação
- Motor explicável de priorização
- Contrato de interoperabilidade versionado

## Camada 2 — inteligência operacional
- mapa de risco por escola e entorno
- linha do tempo de riscos e intervenções
- detecção de recorrência
- horários críticos
- score de exposição
- fila inteligente de prioridades
- recomendações explicadas
- comparação antes/depois de intervenções

## Camada 3 — inteligência territorial
- consolidação por bairro, município e UF
- identificação de corredores escolares críticos
- agrupamento de problemas semelhantes
- indicadores municipais agregados
- simulação de impacto de intervenções

## Camada 4 — IA especializada
A IA externa recebe somente dados autorizados e agregados, podendo:
1. interpretar padrões;
2. explicar indicadores;
3. comparar cenários;
4. sugerir ações;
5. apontar lacunas de evidência;
6. produzir relatórios executivos.

Ela não recebe poder para alterar dados críticos ou tomar decisões administrativas.

## Camada 5 — ecossistema ENAT-HSI
O SIGES poderá publicar snapshots e eventos para uma futura Central ENAT-HSI por API versionada. A Central poderá devolver análises ou recomendações sem exigir acesso direto ao banco do SIGES.

## Resultado esperado
O SIGES evolui de um sistema de registros para um **sistema de apoio à decisão em segurança viária escolar**, com inteligência orientada por evidências e governança humana.

### Princípio de segurança
Nenhuma camada futura deve exigir alteração, acesso direto ou dependência estrutural do Neurodrive ou da Central ENAT-HSI existentes. A integração será desacoplada.
