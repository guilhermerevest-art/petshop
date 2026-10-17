import "server-only";
import { eq } from "drizzle-orm";
import { invitation, organization, user } from "@petshop/db";
import { db } from "./db";
import { isRole, ROLE_LABELS } from "./permissions";

export interface InvitationView {
  id: string;
  email: string;
  roleLabel: string;
  organizationId: string;
  organizationName: string;
  inviterName: string;
  state: "pending" | "expired" | "accepted" | "canceled";
  hasAccount: boolean;
}

/** Dados públicos de um convite, para a página de aceite. */
export async function getInvitation(id: string): Promise<InvitationView | null> {
  const [row] = await db()
    .select({
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      status: invitation.status,
      expiresAt: invitation.expiresAt,
      organizationId: invitation.organizationId,
      organizationName: organization.name,
      inviterName: user.name,
    })
    .from(invitation)
    .innerJoin(organization, eq(organization.id, invitation.organizationId))
    .innerJoin(user, eq(user.id, invitation.inviterId))
    .where(eq(invitation.id, id))
    .limit(1);
  if (!row) return null;
  const existing = await db().query.user.findFirst({ where: eq(user.email, row.email.toLowerCase()) });
  const state =
    row.status === "accepted"
      ? "accepted"
      : row.status === "canceled" || row.status === "rejected"
        ? "canceled"
        : row.expiresAt < new Date()
          ? "expired"
          : "pending";
  return {
    id: row.id,
    email: row.email,
    roleLabel: isRole(row.role) ? ROLE_LABELS[row.role] : "Equipe",
    organizationId: row.organizationId,
    organizationName: row.organizationName,
    inviterName: row.inviterName,
    state,
    hasAccount: Boolean(existing),
  };
}
