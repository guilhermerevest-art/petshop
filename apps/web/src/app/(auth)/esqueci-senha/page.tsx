import type { Metadata } from "next";
import Link from "next/link";
import { ForgotPasswordForm } from "@/components/auth/password-forms";

export const metadata: Metadata = { title: "Esqueci a senha" };

export default function ForgotPasswordPage() {
  return (
    <>
      <h1 className="text-[30px]">Esqueceu a senha?</h1>
      <p className="mt-2 mb-8 text-tinta-suave">Digite o e-mail da conta. Vamos mandar um link para você criar uma nova.</p>
      <ForgotPasswordForm />
      <p className="mt-8 text-[15px]">
        <Link href="/entrar" className="font-medium text-azulejo underline underline-offset-2">
          Voltar para entrar
        </Link>
      </p>
    </>
  );
}
