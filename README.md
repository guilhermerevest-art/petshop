# PetShop

Plataforma SaaS (multi-tenant) de gestão para pet shops de banho e tosa: agenda por vagas, WhatsApp do próprio pet shop, PIX direto na conta, checklist de atendimento, vendas, estoque e recorrência.

## Situação

**Fase 0 (fundação) pronta:**

- cadastro do pet shop e assinatura pelo Stripe (com simulador para testes);
- assistente de configuração: dados, horários e vagas, serviços com preço e tempo por porte, PIX com QR Code de teste, conexão do WhatsApp por QR Code ou código de pareamento, convites da equipe;
- papéis (dono, gerente, recepção, banhista);
- isolamento entre pet shops garantido pelo banco (RLS);
- painel da plataforma e worker de monitoramento do WhatsApp.

A seguir vem a Fase 1 (agenda do dia, clientes e pets, checklist, comanda e caixa). Veja o [roadmap no PRD](docs/PRD.md#10-roadmap-por-fases).

## Documentação

- [PRD](docs/PRD.md): produto, regras de negócio e roadmap
- [Design](docs/design.md): identidade visual e escrita
- [Desenvolvimento local](docs/desenvolvimento.md)
- [Implantação](docs/infra.md): Coolify, Vercel, Stripe e Evolution API

## Stack

- **Web:** Next.js 16 + TypeScript + Tailwind na Vercel (`gru1`)
- **Banco:** PostgreSQL na VPS (Coolify), Drizzle ORM, RLS por pet shop
- **Autenticação:** Better Auth (organizações = pet shops)
- **WhatsApp:** Evolution API na VPS, uma instância por pet shop
- **Pagamentos:** PIX estático (BR Code) dos tutores; Stripe Billing para a assinatura dos pet shops
- **Worker:** pg-boss em Docker no Coolify
