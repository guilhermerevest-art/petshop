import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Plus, Search } from "lucide-react";
import { formatBrPhone } from "@petshop/core";
import { buttonClasses } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/panel";
import { searchCustomers } from "@/lib/customers";
import { requireShop } from "@/lib/shop";

export const metadata: Metadata = { title: "Clientes" };

export default async function CustomersPage(props: PageProps<"/app/clientes">) {
  const ctx = await requireShop({ capability: "customers.manage" });
  const query = await props.searchParams;
  const q = typeof query.q === "string" ? query.q : "";
  const results = await searchCustomers(ctx, q);

  return (
    <>
      <PageHeader
        title="Clientes"
        description="Tutores e pets atendidos pelo pet shop."
        actions={
          <Link href="/app/clientes/novo" className={buttonClasses({})}>
            <Plus className="size-4" aria-hidden /> Novo cliente
          </Link>
        }
      />
      <form role="search" className="mb-6 flex max-w-xl gap-2">
        <label htmlFor="busca" className="sr-only">
          Buscar por tutor, celular ou pet
        </label>
        <Input
          id="busca"
          name="q"
          defaultValue={q}
          placeholder="Buscar por tutor, celular ou pet"
          autoComplete="off"
        />
        <button
          type="submit"
          className={buttonClasses({ variant: "secondary", className: "h-12 shrink-0" })}
        >
          <Search className="size-4" aria-hidden /> Buscar
        </button>
      </form>

      {results.length === 0 ? (
        <div className="max-w-xl rounded-painel border border-dashed border-rejunte-forte p-8 text-center">
          <p className="font-medium">
            {q ? `Nenhum cliente encontrado para "${q}".` : "Nenhum cliente ainda."}
          </p>
          <p className="mt-1 text-tinta-suave">
            {q
              ? "Confira a grafia ou busque pelo celular."
              : "Cadastre o primeiro tutor e o pet dele."}
          </p>
          <Link href="/app/clientes/novo" className={buttonClasses({ className: "mt-5" })}>
            <Plus className="size-4" aria-hidden /> Novo cliente
          </Link>
        </div>
      ) : (
        <ul className="overflow-hidden rounded-painel border border-rejunte bg-rejunte">
          {results.map((customer) => (
            <li key={customer.id} className="[&:not(:first-child)]:mt-px">
              <Link
                href={`/app/clientes/${customer.id}`}
                className="flex items-center gap-4 bg-white px-5 py-4 hover:bg-espuma"
              >
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{customer.name}</span>
                  <span className="block text-[15px] text-tinta-suave tabular">
                    {formatBrPhone(customer.phone)}
                  </span>
                </span>
                <span className="hidden flex-wrap justify-end gap-1.5 sm:flex">
                  {customer.pets.map((pet) => (
                    <span
                      key={pet.id}
                      className="rounded-azulejo bg-azulejo-claro px-2 py-0.5 text-sm text-azulejo-escuro"
                    >
                      {pet.name} <span className="text-azulejo-escuro/70">{pet.size}</span>
                    </span>
                  ))}
                </span>
                <ChevronRight className="size-5 shrink-0 text-tinta-suave" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
