import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Search } from "lucide-react";
import { formatBRL } from "@petshop/core";
import { ProductDialog } from "@/components/products/product-dialog";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/panel";
import { isLowStock, listProducts } from "@/lib/products";
import { requireShop } from "@/lib/shop";

export const metadata: Metadata = { title: "Produtos e estoque" };

export default async function ProductsPage(props: PageProps<"/app/produtos">) {
  const ctx = await requireShop({ capability: "products.manage" });
  const query = await props.searchParams;
  const q = typeof query.q === "string" ? query.q : "";
  const onlyLow = query.baixo === "1";
  const list = await listProducts(ctx, q, onlyLow);
  const lowCount = onlyLow ? list.length : list.filter(isLowStock).length;

  return (
    <>
      <PageHeader
        title="Produtos e estoque"
        description="O que é vendido no balcão. O estoque baixa sozinho quando a comanda é paga."
        actions={<ProductDialog />}
      />
      <form role="search" className="mb-4 flex max-w-xl gap-2">
        <label htmlFor="busca" className="sr-only">
          Buscar produto
        </label>
        <Input
          id="busca"
          name="q"
          defaultValue={q}
          placeholder="Nome ou código de barras"
          autoComplete="off"
        />
        {onlyLow ? <input type="hidden" name="baixo" value="1" /> : null}
        <button
          type="submit"
          className={buttonClasses({ variant: "secondary", className: "h-12 shrink-0" })}
        >
          <Search className="size-4" aria-hidden /> Buscar
        </button>
      </form>
      <div className="mb-5 flex gap-2">
        <Link
          href="/app/produtos"
          className={buttonClasses({ variant: onlyLow ? "ghost" : "secondary", size: "sm" })}
        >
          Todos
        </Link>
        <Link
          href="/app/produtos?baixo=1"
          className={buttonClasses({ variant: onlyLow ? "secondary" : "ghost", size: "sm" })}
        >
          Estoque baixo{lowCount ? ` (${lowCount})` : ""}
        </Link>
      </div>
      {list.length === 0 ? (
        <div className="max-w-xl rounded-painel border border-dashed border-rejunte-forte p-8 text-center">
          <p className="font-medium">
            {onlyLow
              ? "Nenhum produto com estoque baixo."
              : q
                ? `Nada encontrado para "${q}".`
                : "Nenhum produto ainda."}
          </p>
          {!q && !onlyLow ? (
            <p className="mt-1 text-tinta-suave">
              Cadastre rações, petiscos e acessórios para vender na comanda.
            </p>
          ) : null}
        </div>
      ) : (
        <ul className="overflow-hidden rounded-painel border border-rejunte bg-rejunte">
          {list.map((product) => (
            <li key={product.id} className="[&:not(:first-child)]:mt-px">
              <Link
                href={`/app/produtos/${product.id}`}
                className="flex items-center gap-4 bg-white px-5 py-3.5 hover:bg-espuma"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{product.name}</span>
                  <span className="block text-sm text-tinta-suave">
                    {formatBRL(product.priceCents)}
                    {product.category ? ` · ${product.category}` : ""}
                  </span>
                </span>
                {product.trackStock ? (
                  isLowStock(product) ? (
                    <Badge tone={product.stockQuantity <= 0 ? "danger" : "attention"}>
                      {product.stockQuantity} em estoque
                    </Badge>
                  ) : (
                    <span className="text-[15px] text-tinta-suave tabular">
                      {product.stockQuantity} em estoque
                    </span>
                  )
                ) : (
                  <span className="text-sm text-tinta-suave">sem controle</span>
                )}
                <ChevronRight className="size-5 shrink-0 text-tinta-suave" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
