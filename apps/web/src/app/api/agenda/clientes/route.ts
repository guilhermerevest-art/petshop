import type { NextRequest } from "next/server";
import { getCustomerListItem, searchCustomers } from "@/lib/customers";
import { shopForRoute } from "@/lib/route";

/** Busca de tutores para o agendamento: `?q=` (nome, celular ou pet) ou `?id=`. */
export async function GET(request: NextRequest) {
  const ctx = await shopForRoute("agenda.book");
  if (ctx instanceof Response) return ctx;
  const params = request.nextUrl.searchParams;
  const id = params.get("id");
  if (id) {
    const customer = /^[0-9a-f-]{36}$/i.test(id) ? await getCustomerListItem(ctx, id) : null;
    return Response.json({ customers: customer ? [customer] : [] });
  }
  const q = params.get("q") ?? "";
  if (q.trim().length < 2) return Response.json({ customers: [] });
  return Response.json({ customers: await searchCustomers(ctx, q, 8) });
}
