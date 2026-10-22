import { checkDatabaseRole } from "@petshop/db";
import { db } from "@/lib/db";

/** Para o monitor de disponibilidade (Uptime Kuma): confere a aplicação, o banco e o isolamento. */
export async function GET() {
  try {
    const check = await checkDatabaseRole(db());
    if (check.bypassesRls) {
      return Response.json({ ok: false, error: "usuário do banco ignora o RLS" }, { status: 503 });
    }
    return Response.json({ ok: true }, { headers: { "cache-control": "no-store" } });
  } catch {
    return Response.json({ ok: false }, { status: 503 });
  }
}
