import type { Metadata } from "next";
import Link from "next/link";
import { and, count, eq, isNull } from "drizzle-orm";
import {
  formatBrPhone,
  formatLocalDate,
  todayIn,
  SUBSCRIPTION_STATUS_LABELS,
  weeklyCapacity,
  type CapacityRule,
  type SubscriptionStatus,
  type Weekday,
} from "@petshop/core";
import { capacityRules, member, pixSettings, services } from "@petshop/db";
import { buttonClasses } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { WeekGrid } from "@/components/week-grid";
import { getDayBoard } from "@/lib/agenda";
import { cn } from "@/lib/cn";
import { db } from "@/lib/db";
import { formatShortDate } from "@/lib/format";
import { firstPendingStep, STEPS } from "@/lib/onboarding";
import { can } from "@/lib/permissions";
import { inShop, requireShop } from "@/lib/shop";
import { getWhatsApp } from "@/lib/whatsapp";

export const metadata: Metadata = { title: "Início" };

function StatusCell({
  title,
  value,
  detail,
  href,
  tone = "neutral",
}: {
  title: string;
  value: string;
  detail?: string;
  href?: string;
  tone?: "neutral" | "ok" | "attention";
}) {
  const body = (
    <>
      <span className="text-sm text-tinta-suave">{title}</span>
      <span
        className={cn(
          "mt-1 flex items-center gap-2 text-lg font-[650]",
          tone === "attention" && "text-[#7a4f00]",
        )}
      >
        <span
          aria-hidden
          className={cn(
            "size-2.5 rounded-[3px]",
            tone === "ok" ? "bg-azulejo" : tone === "attention" ? "bg-patinho" : "bg-rejunte-forte",
          )}
        />
        {value}
      </span>
      {detail ? <span className="mt-0.5 text-sm text-tinta-suave">{detail}</span> : null}
    </>
  );
  return href ? (
    <Link
      href={href}
      className="flex flex-col bg-white px-5 py-4 transition-colors hover:bg-espuma"
    >
      {body}
    </Link>
  ) : (
    <div className="flex flex-col bg-white px-5 py-4">{body}</div>
  );
}

export default async function HomePage(props: PageProps<"/app">) {
  const ctx = await requireShop();
  const query = await props.searchParams;
  const orgId = ctx.organization.id;

  const today = todayIn(ctx.profile.timezone);
  const [board, rules, [serviceCount], pix, whatsapp, [memberCount]] = await Promise.all([
    getDayBoard(ctx, today),
    inShop(ctx, (tx) =>
      tx.select().from(capacityRules).where(eq(capacityRules.organizationId, orgId)),
    ),
    inShop(ctx, (tx) =>
      tx
        .select({ value: count() })
        .from(services)
        .where(and(eq(services.organizationId, orgId), isNull(services.deletedAt))),
    ),
    inShop(ctx, (tx) =>
      tx.query.pixSettings.findFirst({ where: eq(pixSettings.organizationId, orgId) }),
    ),
    getWhatsApp(ctx),
    db().select({ value: count() }).from(member).where(eq(member.organizationId, orgId)),
  ]);

  const capacity: CapacityRule[] = rules.map((r) => ({
    weekday: r.weekday as Weekday,
    start: r.startTime.slice(0, 5),
    end: r.endTime.slice(0, 5),
    intervalMinutes: r.intervalMinutes,
    slots: r.slots,
  }));
  const done = STEPS.filter((step) => ctx.profile.onboarding[step.key]).length;
  const pendingStep = firstPendingStep(ctx.profile.onboarding);
  const canSetup = can(ctx.role, "shop.edit");
  const sub = ctx.subscription;
  const subStatus = sub?.status as SubscriptionStatus | undefined;
  const firstName = ctx.user.name.split(" ")[0];

  return (
    <>
      <div className="mb-8">
        <h1 className="text-[30px] sm:text-[34px]">Olá, {firstName}</h1>
        <p className="mt-1 text-tinta-suave">{ctx.organization.name}</p>
      </div>

      {query.aviso === "sem-permissao" ? (
        <Notice
          tone="warning"
          className="mb-6"
          title="Seu papel na equipe não dá acesso a essa tela."
        >
          Se precisar, peça ao dono do pet shop.
        </Notice>
      ) : null}

      {canSetup && pendingStep ? (
        <section
          className="mb-8 rounded-painel border border-rejunte bg-white p-5 sm:p-6"
          aria-labelledby="configuracao"
        >
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 id="configuracao" className="text-xl">
                Termine de configurar o pet shop
              </h2>
              <p className="mt-1 text-tinta-suave">
                {done} de {STEPS.length} etapas prontas. Próxima:{" "}
                {STEPS.find((s) => s.key === pendingStep)?.title.toLowerCase()}.
              </p>
              <div className="mt-4 flex gap-1.5" aria-hidden>
                {STEPS.map((step) => (
                  <span
                    key={step.key}
                    className={cn(
                      "h-3 w-10 rounded-[4px]",
                      ctx.profile.onboarding[step.key]
                        ? "bg-azulejo"
                        : step.key === pendingStep
                          ? "bg-patinho"
                          : "bg-rejunte",
                    )}
                  />
                ))}
              </div>
            </div>
            <Link href={`/app/configurar/${pendingStep}`} className={buttonClasses({ size: "lg" })}>
              Continuar configuração
            </Link>
          </div>
        </section>
      ) : null}

      <section aria-labelledby="hoje" className="mb-10">
        <div className="mb-3 flex items-baseline justify-between gap-2">
          <h2 id="hoje" className="text-xl">
            Hoje, <span className="font-normal text-tinta-suave">{formatLocalDate(today)}</span>
          </h2>
        </div>
        <div className="flex flex-col gap-4 rounded-painel border border-rejunte bg-white p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <dl className="flex gap-8">
            <div>
              <dt className="text-sm text-tinta-suave">Pets agendados</dt>
              <dd className="text-3xl font-[650] tabular">{board.entries.length}</dd>
            </div>
            <div>
              <dt className="text-sm text-tinta-suave">Vagas livres</dt>
              <dd className="text-3xl font-[650] tabular">
                {Math.max(0, board.capacityTotal - board.occupiedTotal)}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-tinta-suave">Prontos</dt>
              <dd className="text-3xl font-[650] tabular">
                {board.entries.filter((e) => e.status === "pronto").length}
              </dd>
            </div>
          </dl>
          <div className="flex flex-wrap gap-2">
            <Link href="/app/agenda" className={buttonClasses({ variant: "secondary" })}>
              Abrir agenda
            </Link>
            {can(ctx.role, "agenda.book") ? (
              <Link href="/app/agenda/novo" className={buttonClasses({})}>
                Agendar
              </Link>
            ) : null}
          </div>
        </div>
      </section>

      <section aria-label="Situação do pet shop" className="mb-10">
        <div className="grid grid-cols-1 gap-px overflow-hidden rounded-painel border border-rejunte bg-rejunte sm:grid-cols-2 lg:grid-cols-3">
          <StatusCell
            title="Assinatura"
            value={subStatus ? SUBSCRIPTION_STATUS_LABELS[subStatus] : "Sem assinatura"}
            detail={
              subStatus === "trialing" && sub?.trialEnd
                ? `Teste grátis até ${formatShortDate(sub.trialEnd)}`
                : sub?.currentPeriodEnd && subStatus === "active"
                  ? `Próxima cobrança em ${formatShortDate(sub.currentPeriodEnd)}`
                  : undefined
            }
            href={can(ctx.role, "billing.manage") ? "/app/assinatura" : undefined}
            tone={ctx.access.mode === "full" ? "ok" : "attention"}
          />
          <StatusCell
            title="WhatsApp"
            value={
              whatsapp?.status === "connected"
                ? "Conectado"
                : whatsapp?.status === "connecting"
                  ? "Conectando"
                  : "Desconectado"
            }
            detail={
              whatsapp?.status === "connected" && whatsapp.phoneNumber
                ? formatBrPhone(whatsapp.phoneNumber)
                : "Conecte para avisar os clientes"
            }
            href={can(ctx.role, "whatsapp.manage") ? "/app/configuracoes/whatsapp" : undefined}
            tone={whatsapp?.status === "connected" ? "ok" : "attention"}
          />
          <StatusCell
            title="PIX"
            value={pix ? "Chave cadastrada" : "Sem chave"}
            detail={pix ? pix.merchantName : "Cadastre para cobrar os clientes"}
            href={can(ctx.role, "shop.edit") ? "/app/configuracoes/pix" : undefined}
            tone={pix ? "ok" : "attention"}
          />
          <StatusCell
            title="Vagas por semana"
            value={String(weeklyCapacity(capacity))}
            detail={capacity.length ? "Conforme a grade de horários" : "Defina os horários"}
            href={can(ctx.role, "schedule.edit") ? "/app/configuracoes/horarios" : undefined}
            tone={capacity.length ? "ok" : "attention"}
          />
          <StatusCell
            title="Serviços"
            value={String(serviceCount?.value ?? 0)}
            detail="Com preço e tempo por porte"
            href={can(ctx.role, "services.view") ? "/app/configuracoes/servicos" : undefined}
            tone={serviceCount?.value ? "ok" : "attention"}
          />
          <StatusCell
            title="Equipe"
            value={`${memberCount?.value ?? 1} ${memberCount?.value === 1 ? "pessoa" : "pessoas"}`}
            href={can(ctx.role, "team.manage") ? "/app/configuracoes/equipe" : undefined}
          />
        </div>
      </section>

      {capacity.length > 0 ? (
        <section aria-labelledby="semana">
          <div className="mb-3 flex items-baseline justify-between gap-2">
            <h2 id="semana" className="text-xl">
              Sua semana
            </h2>
            {can(ctx.role, "schedule.edit") ? (
              <Link
                href="/app/configuracoes/horarios"
                className="text-[15px] font-medium text-azulejo underline underline-offset-2"
              >
                Mudar horários
              </Link>
            ) : null}
          </div>
          <WeekGrid rules={capacity} />
        </section>
      ) : null}
    </>
  );
}
