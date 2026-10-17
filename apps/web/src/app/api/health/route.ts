import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

/** Para o monitor de disponibilidade (Uptime Kuma): confere a aplicação e o banco. */
export async function GET() {
  try {
    await db().execute(sql`select 1`);
    return Response.json({ ok: true }, { headers: { "cache-control": "no-store" } });
  } catch {
    return Response.json({ ok: false }, { status: 503 });
  }
}
