import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SignInForm } from "@/components/auth/sign-in-form";
import { Notice } from "@/components/ui/notice";
import { getSession } from "@/lib/shop";

export const metadata: Metadata = { title: "Entrar" };

export default async function SignInPage(props: PageProps<"/entrar">) {
  const query = await props.searchParams;
  const next = typeof query.next === "string" ? query.next : undefined;
  const session = await getSession();
  if (session) redirect(next && next.startsWith("/") ? next : "/app");
  return (
    <>
      <h1 className="text-[30px]">Entrar</h1>
      <p className="mt-2 mb-8 text-tinta-suave">
        Dono do pet shop entra com o e-mail; a equipe, com o usuário.
      </p>
      {query.senha === "alterada" ? (
        <Notice tone="success" className="mb-6">
          Senha alterada. Entre com a nova senha.
        </Notice>
      ) : null}
      <SignInForm next={next} />
      <p className="mt-8 text-[15px] text-tinta-suave">
        Ainda não tem conta?{" "}
        <Link href="/criar-conta" className="font-medium text-azulejo underline underline-offset-2">
          Criar conta do pet shop
        </Link>
      </p>
    </>
  );
}
