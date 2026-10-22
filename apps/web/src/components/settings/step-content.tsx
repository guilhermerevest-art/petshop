import Link from "next/link";
import { and, asc, eq, gt, isNull } from "drizzle-orm";
import {
  formatBrPhone,
  formatDocument,
  type CapacityRule,
  type PixKeyType,
  type Size,
  type Weekday,
} from "@petshop/core";
import {
  capacityRules,
  invitation,
  member,
  pixSettings,
  servicePrices,
  services,
  user,
  type OnboardingStep,
} from "@petshop/db";
import { buttonClasses, Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { db } from "@/lib/db";
import { appUrl } from "@/lib/env";
import { nextStep } from "@/lib/onboarding";
import { can, isRole } from "@/lib/permissions";
import { inShop, type ShopContext } from "@/lib/shop";
import { SUGGESTED_SERVICES } from "@/lib/suggested-services";
import { getWhatsApp, toView } from "@/lib/whatsapp";
import { finishStepAction } from "@/server/settings-actions";
import { CapacityEditor } from "./capacity-editor";
import { PixForm } from "./pix-form";
import { PixTest } from "./pix-test";
import { ServicesManager, type ServiceItem } from "./services-manager";
import { ShopDataForm } from "./shop-data-form";
import { TeamManager } from "./team-manager";
import { WhatsAppConnect } from "./whatsapp-connect";

const time = (value: string) => value.slice(0, 5);

function nextHref(step: OnboardingStep) {
  const next = nextStep(step);
  return next ? `/app/configurar/${next}` : "/app/configurar/pronto";
}

/** Botões do rodapé das etapas que não têm um "Salvar e continuar" próprio. */
function WizardFooter({
  step,
  canContinue,
  optional,
}: {
  step: OnboardingStep;
  canContinue: boolean;
  optional: boolean;
}) {
  return (
    <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
      {canContinue ? (
        <form action={finishStepAction}>
          <input type="hidden" name="step" value={step} />
          <input type="hidden" name="complete" value={step === "equipe" ? "1" : "0"} />
          <Button type="submit" size="lg">
            Continuar
          </Button>
        </form>
      ) : null}
      {optional ? (
        <form action={finishStepAction}>
          <input type="hidden" name="step" value={step} />
          <input type="hidden" name="complete" value={step === "equipe" ? "1" : "0"} />
          <Button type="submit" variant="ghost">
            {step === "equipe" ? "Trabalho sozinho por enquanto" : "Fazer isso depois"}
          </Button>
        </form>
      ) : null}
    </div>
  );
}

export async function StepContent({
  step,
  ctx,
  wizard,
}: {
  step: OnboardingStep;
  ctx: ShopContext;
  wizard: boolean;
}) {
  const orgId = ctx.organization.id;

  switch (step) {
    case "dados": {
      const p = ctx.profile;
      return (
        <ShopDataForm
          wizard={wizard}
          values={{
            name: ctx.organization.name,
            legalName: p.legalName ?? "",
            document: p.document ? formatDocument(p.document) : "",
            phone: p.phone ? formatBrPhone(p.phone) : "",
            email: p.email ?? "",
            addressZip: p.addressZip ?? "",
            addressStreet: p.addressStreet ?? "",
            addressNumber: p.addressNumber ?? "",
            addressComplement: p.addressComplement ?? "",
            addressDistrict: p.addressDistrict ?? "",
            addressCity: p.addressCity ?? "",
            addressState: p.addressState ?? "",
            timezone: p.timezone,
          }}
        />
      );
    }

    case "horarios": {
      const rows = await inShop(ctx, (tx) =>
        tx
          .select()
          .from(capacityRules)
          .where(eq(capacityRules.organizationId, orgId))
          .orderBy(asc(capacityRules.weekday), asc(capacityRules.startTime)),
      );
      const rules: CapacityRule[] = rows.map((r) => ({
        weekday: r.weekday as Weekday,
        start: time(r.startTime),
        end: time(r.endTime),
        intervalMinutes: r.intervalMinutes,
        slots: r.slots,
      }));
      return (
        <CapacityEditor
          wizard={wizard}
          initialRules={
            rules.length > 0
              ? rules
              : [1, 2, 3, 4, 5]
                  .flatMap((weekday) => [
                    {
                      weekday: weekday as Weekday,
                      start: "08:00",
                      end: "12:00",
                      intervalMinutes: 60,
                      slots: 2,
                    },
                    {
                      weekday: weekday as Weekday,
                      start: "13:00",
                      end: "18:00",
                      intervalMinutes: 60,
                      slots: 2,
                    },
                  ])
                  .concat([
                    { weekday: 6, start: "08:00", end: "14:00", intervalMinutes: 60, slots: 2 },
                  ])
          }
        />
      );
    }

    case "servicos": {
      const rows = await inShop(ctx, (tx) =>
        tx
          .select()
          .from(services)
          .where(and(eq(services.organizationId, orgId), isNull(services.deletedAt)))
          .orderBy(asc(services.position), asc(services.createdAt)),
      );
      const prices = await inShop(ctx, (tx) =>
        tx.select().from(servicePrices).where(eq(servicePrices.organizationId, orgId)),
      );
      const items: ServiceItem[] = rows.map((service) => ({
        id: service.id,
        name: service.name,
        category: service.category,
        description: service.description,
        isAddon: service.isAddon,
        showInPortal: service.showInPortal,
        prices: prices
          .filter((p) => p.serviceId === service.id)
          .map((p) => ({
            size: p.size as Size,
            priceCents: p.priceCents,
            durationMinutes: p.durationMinutes,
          })),
      }));
      return (
        <>
          <ServicesManager
            services={items}
            suggested={SUGGESTED_SERVICES}
            sizeRanges={ctx.profile.sizeRanges}
            canEdit={can(ctx.role, "services.edit")}
          />
          {wizard ? (
            <WizardFooter step="servicos" canContinue={items.length > 0} optional={false} />
          ) : null}
        </>
      );
    }

    case "pix": {
      const pix = await inShop(ctx, (tx) =>
        tx.query.pixSettings.findFirst({ where: eq(pixSettings.organizationId, orgId) }),
      );
      const canEdit = can(ctx.role, "pix.manage");
      return (
        <div className="flex flex-col gap-6">
          {!canEdit ? <Notice>Só o dono do pet shop pode alterar a chave PIX.</Notice> : null}
          <PixForm
            canEdit={canEdit}
            values={{
              keyType:
                (pix?.keyType as PixKeyType) ??
                (ctx.profile.document?.length === 11 ? "cpf" : "cnpj"),
              key: pix?.key ?? "",
              merchantName: pix?.merchantName ?? ctx.organization.name.slice(0, 25),
              merchantCity: pix?.merchantCity ?? (ctx.profile.addressCity ?? "").slice(0, 15),
            }}
          />
          {pix ? (
            <PixTest
              pix={{
                keyType: pix.keyType as PixKeyType,
                key: pix.key,
                merchantName: pix.merchantName,
                merchantCity: pix.merchantCity,
              }}
            />
          ) : null}
          {wizard && pix ? (
            <div>
              <Link href={nextHref("pix")} className={buttonClasses({ size: "lg" })}>
                Continuar
              </Link>
            </div>
          ) : null}
        </div>
      );
    }

    case "whatsapp": {
      const row = await getWhatsApp(ctx);
      const view = toView(row);
      return (
        <>
          <WhatsAppConnect
            initial={view}
            defaultPhone={ctx.user.phone ?? ctx.profile.phone}
            nextHref={wizard ? nextHref("whatsapp") : undefined}
          />
          {wizard && view.status !== "connected" ? (
            <WizardFooter step="whatsapp" canContinue={false} optional />
          ) : null}
        </>
      );
    }

    case "equipe": {
      const members = await db()
        .select({
          id: member.id,
          role: member.role,
          userId: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone,
        })
        .from(member)
        .innerJoin(user, eq(user.id, member.userId))
        .where(eq(member.organizationId, orgId))
        .orderBy(asc(member.createdAt));
      const pending = await db()
        .select()
        .from(invitation)
        .where(
          and(
            eq(invitation.organizationId, orgId),
            eq(invitation.status, "pending"),
            gt(invitation.expiresAt, new Date()),
          ),
        )
        .orderBy(asc(invitation.createdAt));
      const whatsapp = await getWhatsApp(ctx);
      return (
        <>
          <TeamManager
            canManage={can(ctx.role, "team.manage")}
            whatsappConnected={whatsapp?.status === "connected"}
            members={members.map((m) => ({
              id: m.id,
              name: m.name,
              email: m.email,
              phone: m.phone,
              role: isRole(m.role.split(",")[0]) ? (m.role.split(",")[0] as never) : "groomer",
              isYou: m.userId === ctx.user.id,
            }))}
            invitations={pending.map((i) => ({
              id: i.id,
              email: i.email,
              role: isRole(i.role) ? i.role : "groomer",
              link: appUrl(`/convite/${i.id}`),
              expiresAt: i.expiresAt.toISOString(),
            }))}
          />
          {wizard ? (
            <WizardFooter
              step="equipe"
              canContinue={members.length > 1 || pending.length > 0}
              optional={members.length <= 1 && pending.length === 0}
            />
          ) : null}
        </>
      );
    }
  }
}
