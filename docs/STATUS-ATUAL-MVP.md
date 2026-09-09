# SIGES — Status atual do MVP

## Núcleo ativo
- Frontend Vite/React em `frontend/src/siges-main.jsx`.
- Base territorial 3.2 carregada de `frontend/data/joinville-3-2-data.gz.b64`.
- Fonte mestre territorial em modo somente leitura.
- Radar Territorial com agregação por corredor em `RadarIntelligence.jsx`.
- Motor de agregação separado em `radar-intelligence.js`.
- Núcleo de inteligência backend separado do frontend e sem acesso direto ao NeuroDrive/Central ENAT-HSI.

## Fluxo operacional em evolução
Dashboard → Radar → corredor → escola → evidência → risco → reivindicação → plano de ação → verificação.

## Limitações atuais
- A autenticação frontend ainda é uma barreira inicial de ambiente controlado, não autenticação de produção.
- Persistência operacional ainda está no navegador/localStorage.
- O endpoint de saúde da API foi criado, mas ainda precisa ser ligado ao servidor Express existente.
- A camada de Aluno Guia dedicada será reintegrada depois da estabilização do fluxo territorial.

## Regra de segurança
Nenhuma evolução deste MVP deve importar código, credenciais ou banco do NeuroDrive ou da Central ENAT-HSI. Integrações futuras devem ocorrer por contrato de API autorizado e rastreável.
