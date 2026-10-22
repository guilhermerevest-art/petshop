import type { Metadata } from "next";
import Link from "next/link";
import { AcceptInvitationButton, InvitationSignUpForm } from "@/components/auth/invitation-forms";
import { SignInForm } from "@/components/auth/sign-in-form";
import { Notice } from "@/components/ui/notice";
import { getInvitation } from "@/lib/invitations";
import { getSession } from "@/lib/shop";
import { signOutAction } from "@/server/auth-actions";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Convite para a equipe" };

export default async function InvitationPage(props: PageProps<"/convite/[id]">) {
  const { id } = await props.params;
  const invitation = await getInvitation(id);

  if (!invitation || invitation.state !== "pending") {
    const message = !invitation
      ? "Este convite não existe."
      : invitation.state === "accepted"
        ? "Este convite já foi aceito."
        : invitation.state === "expired"
          ? "Este convite expirou."
          : "Este convite foi cancelado.";
    return (
      <>
        <h1 className="text-[30px]">Convite indisponível</h1>
        <Notice tone="warning" className="mt-6" title={message}>
          Peça um novo convite para quem chamou você para a equipe.
        </Notice>
        <p className="mt-8 text-[15px]">
          <Link href="/entrar" className="font-medium text-azulejo underline underline-offset-2">
            Ir para entrar
          </Link>
        </p>
      </>
    );
  }

  const session = await getSession();
  const intro = (
    <>
      <h1 className="text-[30px]">Você foi convidado para o {invitation.organizationName}</h1>
      <p className="mt-2 mb-8 text-tinta-suave">
        {invitation.inviterName} chamou você para a equipe como{" "}
        <strong className="font-medium text-tinta">{invitation.roleLabel}</strong>.
      </p>
    </>
  );

  if (session) {
    if (session.user.email.toLowerCase() === invitation.email.toLowerCase()) {
      return (
        <>
          {intro}
          <AcceptInvitationButton
            invitationId={invitation.id}
            organizationName={invitation.organizationName}
          />
        </>
      );
    }
    return (
      <>
        {intro}
        <Notice tone="warning" title="Este convite é para outro e-mail.">
          Você está conectado como {session.user.email}, mas o convite foi enviado para{" "}
          {invitation.email}.
        </Notice>
        <form action={signOutAction} className="mt-6">
          <Button type="submit" variant="secondary" size="lg">
            Sair e entrar com {invitation.email}
          </Button>
        </form>
      </>
    );
  }

  return (
    <>
      {intro}
      {invitation.hasAccount ? (
        <>
          <p className="mb-5 text-[15px] text-tinta-suave">
            Você já tem conta. Entre para aceitar o convite.
          </p>
          <SignInForm next={`/convite/${invitation.id}`} email={invitation.email} />
        </>
      ) : (
        <InvitationSignUpForm invitationId={invitation.id} email={invitation.email} />
      )}
    </>
  );
}
