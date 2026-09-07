# Núcleo de Inteligência SIGES

Esta pasta é o limite arquitetural entre o SIGES e futuras camadas de IA.

## Regras
- Não importa código do Neurodrive.
- Não importa código da Central ENAT-HSI.
- Não acessa bancos externos diretamente.
- Não possui poderes administrativos.
- Toda saída deve ser explicável, versionada e rastreável.

## Sinais previstos
`risk_signal`, `trend_signal`, `hotspot_signal`, `action_signal`, `data_quality_signal`.

## Entrada futura
Snapshots agregados do SIGES, com escopo, período, origem, confiança e traceId.

## Saída futura
Recomendações estruturadas, nunca comandos administrativos implícitos.

## Segurança
Segredos, chaves e credenciais devem permanecer em variáveis de ambiente no servidor. Nunca colocar credenciais em frontend ou neste diretório.
