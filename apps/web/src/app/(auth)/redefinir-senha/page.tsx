import type { Metadata } from "next";
import Link from "next/link";
import { ResetPasswordForm } from "@/components/auth/password-forms";
import { Notice } from "@/components/ui/notice";

export const metadata: Metadata = { title: "Nova senha" };

export default async function ResetPasswordPage(props: PageProps<"/redefinir-senha">) {
  const query = await props.searchParams;
  const token = typeof query.token === "string" ? query.token : null;
  return (
    <>
      <h1 className="text-[30px]">Crie uma nova senha</h1>
      <div className="mt-8">
        {token && query.error !== "INVALID_TOKEN" ? (
          <ResetPasswordForm token={token} />
        ) : (
          <Notice tone="error" title="Este link expirou ou já foi usado.">
            <Link href="/esqueci-senha" className="font-medium text-azulejo underline underline-offset-2">
              Peça um novo link
            </Link>
            .
          </Notice>
        )}
      </div>
    </>
  );
}
