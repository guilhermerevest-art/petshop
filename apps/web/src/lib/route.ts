import "server-only";
import { can, type Capability } from "./permissions";
import { loadShopContext, type ShopContext } from "./shop";

/** Para rotas de API usadas pelas telas: devolve o pet shop ou uma resposta de erro. */
export async function shopForRoute(capability: Capability): Promise<ShopContext | Response> {
  const ctx = await loadShopContext();
  if (ctx === "no-session") return Response.json({ error: "Sessão encerrada." }, { status: 401 });
  if (ctx === "no-shop" || !can(ctx.role, capability)) {
    return Response.json({ error: "Sem permissão." }, { status: 403 });
  }
  return ctx;
}
