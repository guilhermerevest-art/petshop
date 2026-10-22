import { createAccessControl } from "better-auth/plugins/access";
import {
  defaultStatements,
  adminAc,
  ownerAc,
  memberAc,
} from "better-auth/plugins/organization/access";

export const ROLES = ["owner", "manager", "reception", "groomer"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  owner: "Dono",
  manager: "Gerente",
  reception: "Recepção",
  groomer: "Banhista ou tosador",
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  owner: "Tudo, inclusive assinatura, PIX e equipe.",
  manager: "Toda a operação, equipe, serviços e horários. Não mexe na assinatura nem no PIX.",
  reception: "Agenda, clientes, vendas e caixa.",
  groomer: "Fila do dia e checklist dos atendimentos. Não vê valores.",
};

/** Papéis que podem ser escolhidos ao convidar alguém (dono só por transferência). */
export const INVITABLE_ROLES: Role[] = ["manager", "reception", "groomer"];

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

/** Permissões do sistema. A autenticação usa as de organização; o resto é checado pelo próprio app. */
const CAPABILITIES = {
  "shop.edit": ["owner", "manager"],
  "schedule.edit": ["owner", "manager"],
  "services.edit": ["owner", "manager"],
  "services.view": ["owner", "manager", "reception"],
  "team.manage": ["owner", "manager"],
  "customers.manage": ["owner", "manager", "reception"],
  "agenda.book": ["owner", "manager", "reception"],
  "agenda.overbook": ["owner", "manager"],
  "agenda.operate": ["owner", "manager", "reception", "groomer"],
  "prices.view": ["owner", "manager", "reception"],
  /** Comanda, pagamentos e caixa. */
  "sales.manage": ["owner", "manager", "reception"],
  "products.manage": ["owner", "manager"],
  "commissions.manage": ["owner", "manager"],
  "reports.view": ["owner", "manager"],
  "whatsapp.manage": ["owner", "manager"],
  "pix.manage": ["owner"],
  "billing.manage": ["owner"],
} as const satisfies Record<string, readonly Role[]>;

export type Capability = keyof typeof CAPABILITIES;

export function can(role: string | null | undefined, capability: Capability): boolean {
  if (!role) return false;
  return role
    .split(",")
    .map((r) => r.trim())
    .some((r) => (CAPABILITIES[capability] as readonly string[]).includes(r));
}

export function primaryRole(role: string | null | undefined): Role {
  const roles = (role ?? "").split(",").map((r) => r.trim());
  return ROLES.find((r) => roles.includes(r)) ?? "groomer";
}

// Controle de acesso das ações de organização da autenticação (convidar, remover, mudar papel).
export const ac = createAccessControl(defaultStatements);
export const roles = {
  owner: ac.newRole(ownerAc.statements),
  manager: ac.newRole(adminAc.statements),
  reception: ac.newRole(memberAc.statements),
  groomer: ac.newRole(memberAc.statements),
};
