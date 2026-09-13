# SIGES — Relatório Consolidado do Nível 2

## Dados abertos, suficiência de evidências e decisão operacional

**Status:** fechamento técnico do Nível 2.  
**Regra:** somente dados existentes ou obtidos de fontes públicas oficialmente correspondentes; lacunas permanecem declaradas.  
**Natureza:** triagem técnica interna do SIGES. Não constitui certificação automática nem substitui validação humana, documental ou vistoria de campo.

### Objetivo
Consolidar, por escola, a disponibilidade de evidências territoriais e a providência operacional recomendada pelo SIGES: **NECESSITA DE ALUNO GUIA**, **NECESSITA DE RELATÓRIOS COMPLEMENTARES** ou **ESCOLA COM DADOS SUFICIENTES PARA SELO ESCOLA SEGURA**.

### Evidências
A cobertura usa nove grupos: Velocidade km/h, VDM, Sinistros 3 anos, Travessias, Calçada, Sinalização, Iluminação, Embarque/Desembarque e Infraestrutura cicloviária. Um grupo só é considerado disponível quando existe valor no campo principal ou em seu campo oficial correspondente.

### Fontes públicas
CBVJ, DETRANS e SIMGeo, em integração somente leitura. A correspondência é nominal quando aplicável; ausência de fonte específica não é convertida em informação negativa.

### Critério interno de triagem
- **SELO:** cobertura ≥ 78%, HSI-DOTH-P ≥ 70, IPE Territorial 3.2 ≥ 70 e prioridade diferente de P1/P2.
- **ALUNO GUIA:** cobertura < 45% ou prioridade P1/P2.
- **COMPLEMENTARES:** demais situações.

Esses critérios são internos do SIGES e não representam padrão legal ou certificação oficial.

### Resultado consolidado
Os quantitativos devem ser calculados dinamicamente a partir da matriz carregada pelo sistema em cada execução. Nenhum quantitativo é congelado neste documento para evitar duplicação ou desatualização.

Para cada escola, o consolidado deve preservar identificação, cobertura, dados disponíveis, dados ausentes, classificação e providência recomendada.

### Limitações
Não preencher lacunas por inferência. Campos sem evidência permanecem vazios e reduzem a cobertura. O sistema não concede automaticamente o Selo Escola Segura.

### Encerramento
O Nível 2 estará fechado após a apresentação do consolidado dinâmico no SIGES e sua validação funcional no deployment da branch, mantendo rastreabilidade das fontes, preservação das lacunas e validação humana para decisões institucionais.
