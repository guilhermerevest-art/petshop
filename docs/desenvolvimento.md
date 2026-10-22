# Desenvolvimento local

## Requisitos

- Node.js 22 e pnpm 10 (`corepack enable`)
- PostgreSQL 16 (local ou pelo `docker-compose.dev.yml`)

## Primeira vez

```bash
pnpm install

# Postgres pelo Docker (ou use um Postgres local)
docker compose -f docker-compose.dev.yml up -d

# Cria os papéis petshop_owner/petshop_app e os bancos petshop e petshop_test
PGHOST=localhost PGUSER=postgres PGPASSWORD=postgres ./scripts/dev-db.sh

# Tabelas, políticas de RLS e permissões
DATABASE_URL_OWNER=postgres://petshop_owner:petshop_owner@localhost:5432/petshop pnpm db:migrate
```

Crie `apps/web/.env.local`:

```bash
APP_URL=http://localhost:3000
DATABASE_URL=postgres://petshop_app:petshop_app@localhost:5432/petshop
PLATFORM_ADMIN_EMAILS=seu-email@exemplo.com.br
```

Sem as chaves do Stripe e da Evolution, o sistema usa **simuladores**:

- o checkout da assinatura é uma tela de teste (`/app/assinatura/simulada`), que também simula atraso e cancelamento;
- o WhatsApp mostra um QR Code ilustrativo e "conecta" sozinho depois de alguns segundos. As mensagens aparecem no log do servidor.

E-mails (convites, recuperação de senha) também vão para o log enquanto `SMTP_URL` estiver vazio.

## Rodar

```bash
pnpm --filter @petshop/web dev     # http://localhost:3000
pnpm --filter @petshop/worker dev  # precisa de DATABASE_URL e DATABASE_URL_OWNER
```

## Testes

```bash
pnpm test        # unidade e integração (usa o banco petshop_test)
pnpm typecheck
pnpm lint
pnpm e2e         # navegador (Playwright): sobe o servidor de desenvolvimento sozinho
```

Para guardar prints de cada tela durante o teste de navegador: `E2E_SCREENSHOTS=/caminho/da/pasta pnpm e2e`.

## Mudanças no banco

1. Altere o schema em `packages/db/src/schema/`.
2. Gere a migração: `pnpm db:generate` (dê um nome claro com `-- --name descricao`).
3. Aplique: `pnpm db:migrate`.

Toda tabela com dados de um pet shop precisa de `organization_id` e da política `tenantPolicy` (ver `packages/db/src/schema/app.ts`). No código, acesse essas tabelas sempre por `withTenant` (ou `inShop` no app web). Sem isso o banco não devolve nenhuma linha. `withSystem` é só para webhooks, worker e painel da plataforma.

Se mudar plugins ou campos da autenticação (`apps/web/src/lib/auth.ts`), gere de novo o schema dela com `pnpm dlx auth@1.7.10 generate` e crie uma migração.

## Estrutura

| Pasta | Conteúdo |
|---|---|
| `apps/web` | Next.js 16: site, gestão, painel da plataforma, API e webhooks (Vercel) |
| `apps/worker` | Filas e tarefas agendadas com pg-boss (Docker no Coolify) |
| `packages/core` | Regras de negócio sem dependências: PIX (BR Code), vagas da agenda, assinatura, documentos, telefone |
| `packages/db` | Schema Drizzle, migrações, RLS, `withTenant`/`withSystem` |
| `packages/integrations` | Evolution API, Stripe, e-mail e os simuladores |
| `docs` | PRD, design, implantação |
