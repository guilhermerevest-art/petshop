import type { NextRequest } from "next/server";
import { isLocalDate } from "@petshop/core";
import { getAvailableTimes } from "@/lib/agenda";
import { shopForRoute } from "@/lib/route";

/** Horários livres num dia para pets com as durações informadas: `?data=2026-10-22&duracoes=60,120`. */
export async function GET(request: NextRequest) {
  const ctx = await shopForRoute("agenda.book");
  if (ctx instanceof Response) return ctx;
  const params = request.nextUrl.searchParams;
  const date = params.get("data") ?? "";
  const durations = (params.get("duracoes") ?? "")
    .split(",")
    .map(Number)
    .filter((n) => Number.isInteger(n) && n > 0 && n <= 24 * 60);
  if (!isLocalDate(date) || durations.length === 0 || durations.length > 10) {
    return Response.json({ error: "Parâmetros inválidos." }, { status: 400 });
  }
  return Response.json(await getAvailableTimes(ctx, date, durations));
}
