# SIGES — Escola Segura

Rebuild do Sistema Integrado de Gestão da Segurança Escolar, com navegação contextual baseada no HSI-DOTH-P Escolar 3.2.

> **Regra de arquitetura:** SIGES é um sistema independente. Não reutilizar, substituir ou alterar o projeto Neurodrive/Assistente do Instrutor nem a Central ENAT-HSI.

## Arquitetura atual

- Next.js + React + TypeScript
- Supabase para dados territoriais e módulos protegidos
- Tailwind CSS + Lucide
- GitHub: branch de reconstrução `rebuild-siges-3-1`
- Vercel: deve ser criado um projeto próprio para SIGES; não usar `assistente-instrutor-enat`

## Navegação por contexto

O dashboard não funciona como simples menu. Cada indicador abre a informação que o explica:

- Unidades → `/escolas`
- P1/P2/P3/P4 → listas filtradas por Prioridade Territorial 3.2
- Escola → `/escolas/[id]` com dossiê integrado
- Evidências → `/evidencias`
- Mapa territorial → `/mapa`
- Aluno Guia → `/aluno-guia`
- Intervenções → `/intervencoes`

## Dados territoriais

A matriz de trabalho contém 162 unidades. O SIGES **não deve inventar registros ausentes** para completar essa quantidade.

A planilha de referência utilizada para a carga é:

`HSI_DOTH_P_ESCOLAR_JOINVILLE_3_2_ALUNO_GUIA.xlsx`

A aba usada pelo gerador de seed é `MATRIZ 3.2` e deve conter exatamente 162 unidades.

### Gerar a carga SQL a partir da planilha

Coloque a planilha na raiz do repositório e execute:

```bash
python scripts/build_joinville_seed.py
```

O script gera:

```text
supabase/migrations/0012_joinville_162_seed_generated.sql
```

A migration usa `ON CONFLICT (name) DO UPDATE`, permitindo completar ou atualizar a base sem duplicar escolas. As colunas territoriais incluem evidência DETRANS, evidência de acidentes, IPE Territorial 3.2, prioridade territorial e justificativa.

## Supabase

A criação de um projeto Supabase dedicado para SIGES está temporariamente bloqueada pelo limite de projetos ativos da conta gratuita. Nenhum projeto existente deve ser pausado, excluído ou reutilizado sem autorização explícita.

As migrations estão em `supabase/migrations/` e devem ser aplicadas no projeto Supabase dedicado quando ele estiver disponível.

O módulo Aluno Guia possui RLS separado e não deve ser exposto como dado público. A tabela `student_guide_assessments` foi criada para avaliações individuais, com acesso autenticado.

## Desenvolvimento local

```bash
npm install
npm run dev
```

Configure no ambiente local:

```text
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
```

## Segurança e governança

- Dados territoriais públicos podem ser lidos anonimamente pelas políticas específicas de `units` e `evidence`.
- Avaliações individuais do Aluno Guia permanecem protegidas por RLS.
- Ausência de dado não é interpretada como ausência de risco.
- A Prioridade Territorial 3.2 é uma classificação de triagem; não substitui vistoria técnica ou decisão de engenharia.
- Proximidade/correlação territorial deve ser validada antes de qualquer decisão operacional.
