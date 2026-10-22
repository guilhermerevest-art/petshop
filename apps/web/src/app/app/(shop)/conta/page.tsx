import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { formatBrPhone } from "@petshop/core";
import { user } from "@petshop/db";
import { ChangePasswordForm } from "@/components/auth/change-password-form";
import { Notice } from "@/components/ui/notice";
import { PageHeader, Panel, PanelSection } from "@/components/ui/panel";
import { db } from "@/lib/db";
import { ROLE_LABELS } from "@/lib/permissions";
import { requireShop } from "@/lib/shop";
import { isStaffEmail } from "@/lib/usernames";

export const metadata: Metadata = { title: "Minha conta" };

export default async function AccountPage(props: PageProps<"/app/conta">) {
  const query = await props.searchParams;
  const ctx = await requireShop({ allowWithoutAccess: true });
  const me = await db().query.user.findFirst({ where: eq(user.id, ctx.user.id) });
  const login = me?.username && isStaffEmail(ctx.user.email) ? me.username : ctx.user.email;
  return (
    <>
      <PageHeader title="Minha conta" />
      <div className="flex max-w-xl flex-col gap-6">
        {query.senha === "alterada" ? (
          <Notice tone="success" title="Senha alterada.">
            Nos outros aparelhos, entre de novo com a senha nova.
          </Notice>
        ) : null}
        <Panel>
          <PanelSection>
            <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-6 gap-y-2">
              <dt className="text-tinta-suave">Nome</dt>
              <dd>{ctx.user.name}</dd>
              <dt className="text-tinta-suave">Entra com</dt>
              <dd className="break-all">{login}</dd>
              {ctx.user.phone ? (
                <>
                  <dt className="text-tinta-suave">Celular</dt>
                  <dd>{formatBrPhone(ctx.user.phone)}</dd>
                </>
              ) : null}
              <dt className="text-tinta-suave">Papel</dt>
              <dd>
                {ROLE_LABELS[ctx.primaryRole]} no {ctx.organization.name}
              </dd>
            </dl>
          </PanelSection>
        </Panel>
        <Panel>
          <PanelSection>
            <h2 className="mb-5 text-lg">Trocar senha</h2>
            <ChangePasswordForm />
          </PanelSection>
        </Panel>
      </div>
    </>
  );
}
