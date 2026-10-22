# Implantação

Como colocar a plataforma no ar: banco e serviços na VPS (Coolify), aplicação web na Vercel, cobrança no Stripe.

```mermaid
flowchart LR
    V[Vercel gru1<br/>apps/web] -->|SSL| PG[(Postgres<br/>VPS Coolify)]
    W[Worker<br/>Coolify] --> PG
    V -->|HTTPS + chave| EVO[Evolution API<br/>Coolify]
    W --> EVO
    EVO -->|webhook| V
    ST[Stripe] -->|webhook| V
    V --> ST
```

## 1. Postgres (Coolify)

### Dois usuários, com papéis diferentes

O isolamento entre pet shops depende do RLS do Postgres, e **superusuários ignoram o RLS**. Por isso:

| Usuário | Para quê | Pode ser superusuário? |
|---|---|---|
| `petshop_owner` | Dono das tabelas. Usado só para rodar migrações. | Não precisa (e é melhor que não seja) |
| `petshop_app` | Usado pela aplicação (Vercel) e pelo worker. | **Nunca** |

O usuário criado pelo Coolify ao subir o Postgres (`POSTGRES_USER`) é superusuário. Use-o só para criar os dois acima. A aplicação confere isso ao iniciar: se a `DATABASE_URL` usar um usuário que ignora o RLS, ela recusa as requisições e o `/api/health` responde 503.

Conectado como o superusuário (pelo terminal do Coolify ou `psql`):

```sql
CREATE ROLE petshop_owner LOGIN PASSWORD 'troque-esta-senha-1';
CREATE ROLE petshop_app LOGIN PASSWORD 'troque-esta-senha-2';
CREATE DATABASE petshop OWNER petshop_owner;
\c petshop
GRANT CONNECT ON DATABASE petshop TO petshop_app;
-- Confira: nenhum dos dois deve aparecer com rolsuper ou rolbypassrls = true
SELECT rolname, rolsuper, rolbypassrls FROM pg_roles WHERE rolname LIKE 'petshop_%';
```

Se você já criou um usuário para a aplicação com outro nome (ex.: `app_petshop`), tudo bem: confira que ele **não** é superusuário nem tem `BYPASSRLS` e informe o nome em `DB_APP_ROLE` ao rodar as migrações.

### Acesso pela internet

A Vercel não tem IP de saída fixo nos planos comuns, então o Postgres precisa aceitar conexões externas:

- exija SSL (no Coolify: *Enable SSL* no recurso do Postgres);
- use senhas fortes e uma porta diferente da 5432;
- recomendado: coloque um **PgBouncer** em modo `transaction` na frente e exponha só ele. Enquanto o volume for pequeno, a conexão direta funciona, porque a aplicação abre no máximo 3 conexões por instância.

### Backups

No recurso do Postgres no Coolify, ative **Scheduled Backups** diários, enviando para um armazenamento S3 fora da VPS (Cloudflare R2, Backblaze B2 ou Amazon S3), com retenção de 30 dias. Teste a restauração uma vez por mês num banco separado.

### Migrações

As migrações criam as tabelas, as políticas de RLS e dão acesso ao `petshop_app`. Rode a cada versão nova, antes do deploy da aplicação. Há duas formas:

- **Pelo GitHub Actions:** crie o secret `DATABASE_URL_OWNER` (no environment `production` do repositório) e rode o workflow *Migrar banco de produção* em Actions. Se o papel da aplicação tiver outro nome, crie a variável `DB_APP_ROLE`.
- **Do seu computador:**

  ```bash
  DATABASE_URL_OWNER="postgres://petshop_owner:SENHA@SEU_HOST:PORTA/petshop?sslmode=require" \
  DB_APP_ROLE=petshop_app pnpm db:migrate
  ```

## 2. Evolution API (Coolify)

1. Em *New Resource*, escolha o serviço **Evolution API** do catálogo do Coolify (ou um Docker Compose com a imagem `evoapicloud/evolution-api:v2.3.7`).
2. Variáveis importantes:
   - `AUTHENTICATION_API_KEY`: gere uma chave longa (`openssl rand -hex 32`). É a `EVOLUTION_API_KEY` da aplicação.
   - `DATABASE_CONNECTION_URI`: um banco **separado**, só da Evolution (ex.: `evolution`).
   - `CONFIG_SESSION_PHONE_CLIENT=PetShop`: nome que aparece em *Aparelhos conectados* no celular.
   - `QRCODE_LIMIT=30`: quantos QR Codes são gerados antes de desistir de uma tentativa.
   - Deixe o webhook global **desligado**: o sistema configura o webhook de cada pet shop sozinho.
3. Dê um domínio com HTTPS (ex.: `whatsapp.seudominio.com.br`). Esse é o `EVOLUTION_API_URL`.
4. Cada instância do WhatsApp usa memória. Acompanhe o uso da VPS conforme os pet shops entram.

## 3. Worker (Coolify)

Processo que monitora as conexões de WhatsApp e envia os lembretes da véspera (a partir das 18h no fuso de cada pet shop). Nas próximas fases, também as campanhas.

1. *New Resource → Application*, a partir deste repositório no GitHub.
2. Build pack **Dockerfile**, com `apps/worker/Dockerfile` e contexto na raiz do repositório.
3. Porta `8080`, health check em `/health`.
4. Variáveis:

| Variável | Valor |
|---|---|
| `DATABASE_URL` | Conexão do `petshop_app` (pode ser pela rede interna do Coolify) |
| `QUEUE_DATABASE_URL` | Conexão direta do `petshop_owner` (a fila cria o schema `pgboss`) |
| `APP_URL` | Endereço público do sistema |
| `EVOLUTION_API_URL`, `EVOLUTION_API_KEY` | Os mesmos da aplicação |
| `SMTP_URL`, `EMAIL_FROM` | Os mesmos da aplicação |
| `WHATSAPP_MONITOR_CRON`, `REMINDERS_CRON` | Opcionais. Padrão: a cada 5 e a cada 15 minutos |

## 4. Stripe

Use uma conta Stripe no Brasil, em nome da empresa da plataforma.

1. **Produto e preço:** em *Product catalog*, crie o produto (ex.: "Plano PetShop") com um preço **recorrente** mensal em BRL. Copie o ID do preço (`price_...`) para `STRIPE_PRICE_ID`.
2. **Formas de pagamento:** em *Settings → Payment methods*, deixe ativo o cartão. O boleto só funciona em assinaturas cobradas por fatura; ative-o se for oferecer.
3. **Portal do cliente:** em *Settings → Billing → Customer portal*, ative a atualização de forma de pagamento, o histórico de faturas e o cancelamento (ao fim do período).
4. **Cobrança de inadimplentes:** em *Settings → Billing → Subscriptions and emails*, ative *Smart Retries* e os e-mails de falha de pagamento.
5. **Webhook:** em *Developers → Webhooks*, crie um endpoint `https://SEU_DOMINIO/api/webhooks/stripe` com os eventos:
   - `checkout.session.completed`
   - `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`
   - `customer.subscription.paused`, `customer.subscription.resumed`, `customer.subscription.trial_will_end`
   - `invoice.paid`, `invoice.payment_failed`

   Copie o *Signing secret* (`whsec_...`) para `STRIPE_WEBHOOK_SECRET`.
6. **Chaves:** `STRIPE_SECRET_KEY` (`sk_live_...` em produção; `sk_test_...` em homologação).
7. **Nota fiscal:** o Stripe não emite NFS-e. Combine com o contador como emitir as notas das mensalidades.

## 5. Vercel

1. Importe o repositório. Em *Root Directory*, escolha `apps/web`. O framework (Next.js) e o pnpm são detectados sozinhos.
2. Plano **Pro**: o plano Hobby não permite uso comercial.
3. A região das Functions já vem do `apps/web/vercel.json` (`gru1`, São Paulo, perto da VPS em Campinas).
4. Variáveis de ambiente (ver `.env.example`):

| Variável | Observação |
|---|---|
| `APP_URL` | Ex.: `https://app.seudominio.com.br` |
| `DATABASE_URL` | Papel `petshop_app`, com `?sslmode=require` |
| `BETTER_AUTH_SECRET` | `openssl rand -base64 32` |
| `PLATFORM_ADMIN_EMAILS` | Seu e-mail, para acessar `/admin` |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID`, `BILLING_TRIAL_DAYS` | Do passo 4 |
| `EVOLUTION_API_URL`, `EVOLUTION_API_KEY`, `EVOLUTION_WEBHOOK_TOKEN` | Do passo 2; o token você gera (`openssl rand -hex 24`) |
| `SMTP_URL`, `EMAIL_FROM` | Recuperação de senha do dono e avisos (ex.: WhatsApp desconectado) |

5. **Previews:** os deploys de preview nunca podem usar o banco de produção. Configure as variáveis do ambiente *Preview* apontando para um banco de homologação, com `BILLING_PROVIDER=fake` e `MESSAGING_PROVIDER=fake` (ou chaves de teste).

## 6. Depois do primeiro deploy

1. Acesse `https://SEU_DOMINIO/api/health`: deve responder `{"ok":true}`.
2. Crie a conta do primeiro pet shop e faça uma assinatura de teste com um cartão de teste do Stripe (em homologação).
3. Conecte o WhatsApp de um número de testes e envie a mensagem de teste.
4. Cadastre o `/api/health` da aplicação e o `/health` do worker no Uptime Kuma (ou outro monitor).
