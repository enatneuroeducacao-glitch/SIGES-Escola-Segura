# SIGES — Escola Segura | PC V2 — Dashboard + Configurações

Base local do SIGES para desenvolvimento incremental no PC.

## Iniciar

Na pasta raiz:

```bat
npm install
npm run dev
```

Abra:

```text
http://localhost:5173
```

## Acesso administrativo inicial de teste

- Usuário: `admin`
- Senha: `admin`

A conta é criada automaticamente no primeiro início da API. **É uma credencial exclusiva do ambiente local de desenvolvimento.**

### Primeiro acesso

1. Entre com `admin` / `admin`.
2. Abra **Configurações**.
3. Entre em **Segurança**.
4. Altere imediatamente a senha administrativa.
5. Depois de publicar em ambiente real, substitua a credencial de teste e a chave JWT (`SIGES_SECRET`).

## O que foi consolidado nesta versão

- Login por e-mail ou usuário.
- Conta administrativa ENAT inicial `admin` / `admin` para testes locais.
- Painel administrativo com indicadores-base.
- Menu administrativo completo para evolução por camadas.
- Configurações reais do sistema, separadas por áreas:
  - Sistema
  - Acessos e perfis
  - Segurança
  - Governança
  - Privacidade
  - Certificação
  - HSI-DOTH-P
  - Notificações
  - Auditoria
- Alteração de senha do administrador dentro do sistema.
- Gestão inicial de status de usuários: ativo, pendente e bloqueado.
- Registro de ações administrativas no log de auditoria.
- Regras iniciais de governança para reivindicações.
- Regras de minimização e visualização restrita de dados.
- Parâmetros iniciais de certificação ENAT e HSI-DOTH-P.

## Observação de segurança

Esta versão é uma **base local de desenvolvimento**. Antes de qualquer publicação pública, devem ser configurados segredo JWT forte, HTTPS, armazenamento seguro de credenciais, recuperação de senha por e-mail e banco de dados apropriado para produção.
