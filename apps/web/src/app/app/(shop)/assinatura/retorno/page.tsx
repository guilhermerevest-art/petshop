import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Notice } from "@/components/ui/notice";
import { Spinner } from "@/components/ui/spinner";
import { saveSubscription } from "@/lib/billing";
import { billing } from "@/lib/providers";
import { requireShop } from "@/lib/shop";

export const metadata: Metadata = { title: "Confirmando assinatura" };

/** Retorno do checkout: grava a assinatura na hora, sem esperar o webhook chegar. */
export default async function CheckoutReturnPage(props: PageProps<"/app/assinatura/retorno">) {
  const ctx = await requireShop({ allowWithoutAccess: true });
  const query = await props.searchParams;
  const sessionId = typeof query.session_id === "string" ? query.session_id : null;
  if (ctx.access.canUseApp) redirect("/app/configurar");

  if (sessionId) {
    const sub = await billing()
      .getCheckoutSubscription(sessionId)
      .catch((error) => {
        console.error("getCheckoutSubscription", error);
        return null;
      });
    if (sub && sub.organizationId === ctx.organization.id) {
      await saveSubscription(ctx.organization.id, sub);
      redirect("/app/configurar");
    }
  }

  return (
    <div className="max-w-xl">
      <meta httpEquiv="refresh" content="4" />
      <h1 className="flex items-center gap-3 text-[28px]">
        <Spinner className="size-6 text-azulejo" /> Confirmando o pagamento
      </h1>
      <p className="mt-3 text-tinta-suave">Isso leva alguns segundos. A página atualiza sozinha.</p>
      <Notice className="mt-8" title="Demorando mais que o normal?">
        <Link
          href="/app/assinatura"
          className="font-medium text-azulejo underline underline-offset-2"
        >
          Volte para a assinatura
        </Link>{" "}
        e confira o status.
      </Notice>
    </div>
  );
}
