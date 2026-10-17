import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { organization } from "better-auth/plugins";
import { schema } from "@petshop/db";
import { db } from "./db";
import { env } from "./env";
import { ac, roles, ROLE_LABELS, isRole } from "./permissions";
import { mailer } from "./providers";

function createAuth() {
  const e = env();
  return betterAuth({
    appName: "PetShop",
    baseURL: e.APP_URL,
    secret: e.BETTER_AUTH_SECRET,
    database: drizzleAdapter(db(), {
      provider: "pg",
      schema: {
        user: schema.user,
        session: schema.session,
        account: schema.account,
        verification: schema.verification,
        organization: schema.organization,
        member: schema.member,
        invitation: schema.invitation,
      },
    }),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      autoSignIn: true,
      resetPasswordTokenExpiresIn: 60 * 60,
      sendResetPassword: async ({ user, url }) => {
        await mailer().send({
          to: user.email,
          subject: "Crie uma nova senha",
          text: `Olá, ${user.name}.\n\nPara criar uma nova senha, abra este link (vale por 1 hora):\n${url}\n\nSe não foi você que pediu, ignore este e-mail.`,
        });
      },
    },
    user: {
      additionalFields: {
        phone: { type: "string", required: false, input: true },
      },
    },
    session: {
      expiresIn: 60 * 60 * 24 * 30,
      updateAge: 60 * 60 * 24,
    },
    rateLimit: {
      enabled: e.NODE_ENV === "production",
      window: 60,
      max: 30,
    },
    plugins: [
      organization({
        ac,
        roles,
        creatorRole: "owner",
        allowUserToCreateOrganization: true,
        invitationExpiresIn: 60 * 60 * 24 * 7,
        cancelPendingInvitationsOnReInvite: true,
        sendInvitationEmail: async (data) => {
          const role = isRole(data.role) ? ROLE_LABELS[data.role] : data.role;
          const link = new URL(`/convite/${data.id}`, e.APP_URL).toString();
          await mailer().send({
            to: data.email,
            subject: `${data.inviter.user.name} convidou você para ${data.organization.name}`,
            text: `Olá!\n\n${data.inviter.user.name} convidou você para fazer parte da equipe do ${data.organization.name} como ${role}.\n\nPara aceitar, abra o link (vale por 7 dias):\n${link}`,
          });
        },
      }),
      nextCookies(),
    ],
  });
}

type Auth = ReturnType<typeof createAuth>;
const store = globalThis as unknown as { __petshopAuth?: Auth };

export function auth(): Auth {
  return (store.__petshopAuth ??= createAuth());
}
