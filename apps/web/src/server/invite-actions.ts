"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { normalizeBrPhone } from "@petshop/core";
import { auth } from "@/lib/auth";
import { authErrorMessage, cookieHeaderFrom } from "@/lib/auth-errors";
import { fail, zodFieldErrors, type ActionResult } from "@/lib/action-result";
import { getInvitation } from "@/lib/invitations";

export async function acceptInvitationAction(_: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const invitationId = String(formData.get("invitationId") ?? "");
  try {
    await auth().api.acceptInvitation({ body: { invitationId }, headers: await headers() });
  } catch (error) {
    return fail(authErrorMessage(error));
  }
  redirect("/app");
}

const signUpSchema = z.object({
  invitationId: z.string().min(1),
  name: z.string().trim().min(2, "Digite seu nome."),
  phone: z
    .string()
    .trim()
    .refine((value) => normalizeBrPhone(value) !== null, "Digite o celular com DDD."),
  password: z.string().min(8, "A senha precisa ter pelo menos 8 caracteres."),
});

/** Cria a conta de quem foi convidado e já aceita o convite. */
export async function acceptInvitationWithSignUpAction(
  _: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = signUpSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail("Confira os campos destacados.", zodFieldErrors(parsed.error.issues));
  const invitation = await getInvitation(parsed.data.invitationId);
  if (!invitation || invitation.state !== "pending") return fail("Este convite não está mais disponível.");

  try {
    const { headers: responseHeaders } = await auth().api.signUpEmail({
      body: {
        name: parsed.data.name,
        email: invitation.email,
        password: parsed.data.password,
        phone: normalizeBrPhone(parsed.data.phone)!,
      },
      headers: await headers(),
      returnHeaders: true,
    });
    await auth().api.acceptInvitation({
      body: { invitationId: invitation.id },
      headers: cookieHeaderFrom(responseHeaders),
    });
  } catch (error) {
    return fail(authErrorMessage(error));
  }
  redirect("/app");
}
