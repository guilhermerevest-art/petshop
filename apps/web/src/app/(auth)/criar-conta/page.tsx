import type { Metadata } from "next";
import Link from "next/link";
import { SignUpForm } from "@/components/auth/sign-up-form";

export const metadata: Metadata = { title: "Criar conta" };

export default function SignUpPage() {
  return (
    <>
      <h1 className="text-[30px]">Crie a conta do seu pet shop</h1>
      <p className="mt-2 mb-8 text-tinta-suave">
        Em poucos minutos você configura horários, serviços, PIX e o WhatsApp do pet shop.
      </p>
      <SignUpForm />
      <p className="mt-8 text-[15px] text-tinta-suave">
        Já tem conta?{" "}
        <Link href="/entrar" className="font-medium text-azulejo underline underline-offset-2">
          Entrar
        </Link>
      </p>
    </>
  );
}
