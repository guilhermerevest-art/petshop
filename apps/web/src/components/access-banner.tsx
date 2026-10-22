import Link from "next/link";
import type { Access } from "@petshop/core";

/** Aviso fixo quando a assinatura está atrasada ou em modo somente leitura. */
export function AccessBanner({ access, canBilling }: { access: Access; canBilling: boolean }) {
  if (access.mode !== "warning" && access.mode !== "read_only") return null;
  const days = access.daysUntilChange ?? 0;
  const text =
    access.mode === "warning"
      ? `O pagamento da assinatura está atrasado. Em ${days} ${days === 1 ? "dia" : "dias"} o sistema passa a funcionar só para consulta.`
      : "A assinatura não está em dia. O sistema está só para consulta: nada pode ser criado ou alterado.";
  return (
    <div role="status" className="border-b border-patinho/60 bg-patinho-claro">
      <div className="mx-auto flex max-w-[1040px] flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <p className="text-[15px]">{text}</p>
        {canBilling ? (
          <Link
            href="/app/assinatura"
            className="shrink-0 font-medium text-tinta underline underline-offset-2"
          >
            Regularizar pagamento
          </Link>
        ) : (
          <span className="shrink-0 text-sm text-tinta-suave">Avise o dono do pet shop.</span>
        )}
      </div>
    </div>
  );
}
