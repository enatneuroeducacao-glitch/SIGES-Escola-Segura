# SIGES — Camada de Inteligência de Trânsito Escolar

## Visão
O SIGES deixa de ser apenas um sistema de cadastro e registro e passa a ser preparado como uma **plataforma de inteligência para segurança viária escolar**.

Princípio central:

> **Observar → Qualificar → Correlacionar → Priorizar → Agir → Verificar → Aprender.**

A inteligência do SIGES não substitui a decisão humana. Ela organiza evidências, identifica padrões, calcula prioridades e apresenta recomendações rastreáveis.

## Núcleo de Inteligência

### 1. School Safety Intelligence Graph
Conecta, sem expor dados pessoais desnecessários:
- escola
- território
- horários críticos
- fluxo escolar
- riscos
- ocorrências
- reivindicações
- evidências
- avaliações HSI-DOTH-P
- ações executadas
- resultados pós-intervenção

### 2. Risk Prioritization Engine
Cada risco poderá receber prioridade de 0–100 usando, quando disponíveis:
- gravidade potencial
- frequência
- exposição
- vulnerabilidade
- proximidade de escola
- horário crítico
- recorrência
- evidência disponível
- tendência temporal

O motor deve retornar também **por que** a prioridade foi atribuída, evitando uma pontuação opaca.

### 3. Early Warning Layer
Detecta sinais como:
- aumento de ocorrências em determinada faixa horária;
- repetição do mesmo risco;
- reivindicações sem tratamento;
- piora de indicadores;
- concentração territorial;
- ausência de evidência após ação;
- reincidência após intervenção.

### 4. Decision Support
O SIGES deve responder perguntas operacionais como:
- “Qual é o risco mais urgente desta escola?”
- “Quais horários concentram maior exposição?”
- “Quais problemas se repetem?”
- “Que reivindicações estão paradas?”
- “Quais intervenções tiveram evidência de melhora?”
- “Onde o município deveria concentrar recursos primeiro?”

### 5. Explainability
Toda recomendação futura da IA deve carregar:
- origem dos dados;
- período analisado;
- indicadores utilizados;
- grau de confiança;
- limitações;
- recomendação;
- responsável humano pela decisão final.

## Camada de integração futura
O SIGES não deve conhecer internamente os sistemas externos. Ele expõe um **contrato de interoperabilidade** versionado em `docs/SIGES-AI-INTEGRATION-CONTRACT.json`.

Isso permite integrar posteriormente:
- Central ENAT-HSI;
- IA especializada de trânsito;
- sistemas municipais;
- órgãos de trânsito;
- órgãos de educação;
- provedores de mapas/território;
- sensores e telemetria, quando autorizados.

## Segurança por desenho
A futura integração deve seguir:
- menor privilégio;
- minimização de dados;
- separação entre identificação e indicadores;
- logs de acesso;
- versionamento de eventos;
- consentimento/base legal quando aplicável;
- nenhum acesso direto da IA à base bruta de usuários;
- IA sem autoridade para emitir decisões administrativas por conta própria.

## Regra de isolamento
Este núcleo foi desenhado para **não alterar Neurodrive, Central ENAT-HSI ou qualquer outro sistema existente**. A integração futura será feita por contrato/API, sem compartilhamento estrutural de banco.
