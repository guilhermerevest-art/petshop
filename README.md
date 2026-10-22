# PetShop

Plataforma SaaS (multi-tenant) de gestão para pet shops de banho e tosa: agenda por vagas, WhatsApp do próprio pet shop, PIX direto na conta, checklist de atendimento, vendas, estoque e recorrência.

## Situação

**Fase 0 (fundação) pronta:**

- cadastro do pet shop e assinatura pelo Stripe (com simulador para testes);
- assistente de configuração: dados, horários e vagas, serviços com preço e tempo por porte, PIX com QR Code de teste, conexão do WhatsApp por QR Code ou código de pareamento, acessos da equipe com usuário e senha criados pelo dono;
- papéis (dono, gerente, recepção, banhista);
- isolamento entre pet shops garantido pelo banco (RLS);
- painel da plataforma e worker de monitoramento do WhatsApp.

**Fase 1 (em andamento):**

- clientes e pets, com busca por tutor, celular ou pet, alertas de cuidados e histórico;
- agenda do dia em azulejos: cada coluna é uma vaga e o pet ocupa todos os horários do atendimento;
- agendamento em três passos, com cadastro rápido do cliente, horários livres calculados pelas vagas e encaixe (dono e gerente);
- fila do dia (chegou, em atendimento, pronto, entregue, não veio), cancelamento e dias especiais (feriados e vagas diferentes);
- WhatsApp automático: confirmação, chegada, pet pronto, cancelamento e lembrete na véspera às 18h.

A seguir: checklist com fotos, comanda, caixa, PIX com conferência e recibo. Veja o [roadmap no PRD](docs/PRD.md#10-roadmap-por-fases).

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
