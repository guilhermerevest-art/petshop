import "server-only";
import { asc, eq } from "drizzle-orm";
import { member, organization } from "@petshop/db";
import { db } from "./db";

/** Pet shops de que a pessoa faz parte (para trocar entre eles). */
export async function listUserShops(userId: string) {
  return db()
    .select({ id: organization.id, name: organization.name, role: member.role })
    .from(member)
    .innerJoin(organization, eq(organization.id, member.organizationId))
    .where(eq(member.userId, userId))
    .orderBy(asc(organization.name));
}
