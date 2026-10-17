# PetShop

Plataforma SaaS (multi-tenant) de gestão de ponta a ponta para pet shops: tutores e pets, agenda com autoagendamento, PIX, recibos e lembretes pelo WhatsApp do próprio pet shop, checklist de atendimento, PDV, estoque, recorrência e relatórios.

> Projeto em fase de definição. Comece pelo [PRD](docs/PRD.md).

## Stack prevista

- **Web:** Next.js + TypeScript na Vercel (região `gru1`)
- **Banco:** PostgreSQL na VPS em Campinas (Coolify)
- **WhatsApp:** Evolution API na VPS (Coolify), uma instância por pet shop, conectada por QR Code
- **Pagamentos dos tutores:** PIX estático (BR Code gerado pelo sistema, com a chave do pet shop)
- **Assinatura dos pet shops:** Stripe Billing
