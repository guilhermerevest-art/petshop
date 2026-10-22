import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { formatBRL } from "@petshop/core";
import { ActionButton } from "@/components/action-button";
import { ProductDialog } from "@/components/products/product-dialog";
import { StockForm } from "@/components/products/stock-form";
import { Badge } from "@/components/ui/badge";
import { Panel, PanelSection } from "@/components/ui/panel";
import { formatDateTime } from "@/lib/format";
import { getProduct, isLowStock, STOCK_REASON_LABELS } from "@/lib/products";
import { requireShop } from "@/lib/shop";
import { archiveProductAction } from "@/server/product-actions";

export const metadata: Metadata = { title: "Produto" };

export default async function ProductPage(props: PageProps<"/app/produtos/[id]">) {
  const { id } = await props.params;
  const ctx = await requireShop({ capability: "products.manage" });
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const data = await getProduct(ctx, id);
  if (!data) notFound();
  const { product, movements } = data;
  const margin =
    product.costCents != null && product.priceCents > 0
      ? Math.round(((product.priceCents - product.costCents) / product.priceCents) * 100)
      : null;

  return (
    <>
      <Link
        href="/app/produtos"
        className="mb-4 inline-flex items-center gap-1 text-[15px] font-medium text-tinta-suave hover:text-tinta"
      >
        <ChevronLeft className="size-4" aria-hidden /> Produtos
      </Link>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[28px] sm:text-[32px]">{product.name}</h1>
          <p className="mt-1 text-tinta-suave">
            {formatBRL(product.priceCents)}
            {product.costCents != null ? ` · custo ${formatBRL(product.costCents)}` : ""}
            {margin !== null ? ` · margem ${margin}%` : ""}
            {product.barcode ? ` · código ${product.barcode}` : ""}
          </p>
        </div>
        <ProductDialog
          variant="secondary"
          product={{
            id: product.id,
            name: product.name,
            category: product.category,
            barcode: product.barcode,
            priceCents: product.priceCents,
            costCents: product.costCents,
            trackStock: product.trackStock,
            minStock: product.minStock,
          }}
        />
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex flex-col gap-6">
          <Panel>
            <PanelSection className="flex items-center justify-between gap-3">
              <p>
                <span className="block text-sm text-tinta-suave">Em estoque</span>
                <span className="text-3xl font-[650] tabular">
                  {product.trackStock ? product.stockQuantity : "—"}
                </span>
              </p>
              {product.trackStock && isLowStock(product) ? (
                <Badge tone={product.stockQuantity <= 0 ? "danger" : "attention"}>
                  {product.stockQuantity <= 0
                    ? "Sem estoque"
                    : `Abaixo do mínimo (${product.minStock})`}
                </Badge>
              ) : null}
            </PanelSection>
            <PanelSection>
              <h2 className="mb-4 text-lg">Movimentar estoque</h2>
              <StockForm productId={product.id} current={product.stockQuantity} />
            </PanelSection>
          </Panel>
        </div>
        <section aria-labelledby="historico">
          <h2 id="historico" className="mb-3 text-lg">
            Histórico
          </h2>
          {movements.length === 0 ? (
            <p className="text-tinta-suave">Nenhuma movimentação ainda.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {movements.map(({ movement, actorName }) => (
                <li
                  key={movement.id}
                  className="flex items-start justify-between gap-3 rounded-campo bg-white px-4 py-3 text-[15px]"
                >
                  <span>
                    <span className="block font-medium">
                      {STOCK_REASON_LABELS[movement.reason] ?? movement.reason}
                    </span>
                    <span className="block text-sm text-tinta-suave">
                      {formatDateTime(movement.createdAt)}
                      {actorName ? ` · ${actorName}` : ""}
                      {movement.note ? ` · ${movement.note}` : ""}
                    </span>
                  </span>
                  <span
                    className={
                      movement.delta > 0
                        ? "font-medium text-azulejo-escuro tabular"
                        : "font-medium text-alerta tabular"
                    }
                  >
                    {movement.delta > 0 ? `+${movement.delta}` : movement.delta}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <details className="mt-6">
            <summary className="cursor-pointer text-sm text-tinta-suave hover:text-alerta">
              Remover produto
            </summary>
            <div className="mt-3 flex flex-col gap-2">
              <p className="text-[15px] text-tinta-suave">
                Sai da lista de venda. As vendas antigas continuam registradas.
              </p>
              <ActionButton
                action={archiveProductAction}
                hidden={{ id: product.id }}
                variant="danger"
                size="sm"
                pendingLabel="Removendo…"
              >
                Remover {product.name}
              </ActionButton>
            </div>
          </details>
        </section>
      </div>
    </>
  );
}
