import Link from "next/link";
import { Brand } from "@/components/brand";
import { buttonClasses } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="min-h-dvh px-4 py-6 sm:px-10">
      <Brand />
      <main className="mx-auto mt-24 max-w-md">
        <h1 className="text-[30px]">Página não encontrada</h1>
        <p className="mt-2 text-tinta-suave">O endereço pode ter mudado ou estar digitado errado.</p>
        <Link href="/app" className={buttonClasses({ size: "lg", className: "mt-8" })}>
          Ir para o início
        </Link>
      </main>
    </div>
  );
}
