import Link from "next/link";
import { Brand } from "@/components/brand";
import { buttonClasses } from "@/components/ui/button";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex max-w-[1120px] items-center justify-between px-4 py-5 sm:px-8">
        <Link href="/" className="rounded-md">
          <Brand />
        </Link>
        <nav className="flex items-center gap-2" aria-label="Conta">
          <Link href="/entrar" className={buttonClasses({ variant: "ghost" })}>
            Entrar
          </Link>
          <Link href="/criar-conta" className={buttonClasses({ className: "hidden sm:inline-flex" })}>
            Criar conta
          </Link>
        </nav>
      </header>
      {children}
      <footer className="mt-24 border-t border-rejunte">
        <div className="mx-auto flex max-w-[1120px] flex-col gap-3 px-4 py-8 text-[15px] text-tinta-suave sm:flex-row sm:justify-between sm:px-8">
          <p>PetShop, gestão para banho e tosa.</p>
          <nav className="flex gap-5" aria-label="Documentos">
            <Link href="/termos" className="hover:text-tinta">
              Termos de uso
            </Link>
            <Link href="/privacidade" className="hover:text-tinta">
              Privacidade
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
