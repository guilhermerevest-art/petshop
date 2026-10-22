import type { Metadata } from "next";
import Link from "next/link";
import { ForgotPasswordForm } from "@/components/auth/password-forms";

export const metadata: Metadata = { title: "Esqueci a senha" };

export default function ForgotPasswordPage() {
  return (
    <>
      <h1 className="text-[30px]">Esqueceu a senha?</h1>
      <p className="mt-2 text-tinta-suave">
        Digite o e-mail da conta. Vamos mandar um link para você criar uma nova.
      </p>
      <p className="mt-3 mb-8 text-[15px] text-tinta-suave">
        Entra com usuário em vez de e-mail? Peça ao dono ou ao gerente do pet shop para definir uma
        nova senha para você.
      </p>
      <ForgotPasswordForm />
      <p className="mt-8 text-[15px]">
        <Link href="/entrar" className="font-medium text-azulejo underline underline-offset-2">
          Voltar para entrar
        </Link>
      </p>
    </>
  );
}
