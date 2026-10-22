import "server-only";
import { and, asc, desc, eq, ilike, isNull, lte, or } from "drizzle-orm";
import { products, stockMovements, user } from "@petshop/db";
import { inShop, type ShopContext } from "./shop";

export type Product = typeof products.$inferSelect;

export const STOCK_REASON_LABELS: Record<string, string> = {
  entrada: "Entrada",
  venda: "Venda",
  ajuste: "Ajuste de contagem",
  perda: "Perda",
  estorno: "Estorno",
};

export async function listProducts(ctx: ShopContext, query: string, onlyLow: boolean) {
  const term = query.trim().replace(/[%_]/g, "");
  return inShop(ctx, (tx) =>
    tx
      .select()
      .from(products)
      .where(
        and(
          eq(products.organizationId, ctx.organization.id),
          isNull(products.deletedAt),
          term ? or(ilike(products.name, `%${term}%`), eq(products.barcode, term)) : undefined,
          onlyLow
            ? and(eq(products.trackStock, true), lte(products.stockQuantity, products.minStock))
            : undefined,
        ),
      )
      .orderBy(asc(products.name)),
  );
}

export async function getProduct(ctx: ShopContext, id: string) {
  return inShop(ctx, async (tx) => {
    const product = await tx.query.products.findFirst({
      where: and(
        eq(products.id, id),
        eq(products.organizationId, ctx.organization.id),
        isNull(products.deletedAt),
      ),
    });
    if (!product) return null;
    const movements = await tx
      .select({ movement: stockMovements, actorName: user.name })
      .from(stockMovements)
      .leftJoin(user, eq(user.id, stockMovements.createdBy))
      .where(eq(stockMovements.productId, id))
      .orderBy(desc(stockMovements.createdAt))
      .limit(50);
    return { product, movements };
  });
}

export function isLowStock(p: Pick<Product, "trackStock" | "stockQuantity" | "minStock">): boolean {
  return p.trackStock && p.stockQuantity <= p.minStock;
}
