import type { Metadata } from "next";
import Link from "next/link";
import { Brand } from "@/components/brand";
import { NewShopForm } from "@/components/auth/new-shop-form";
import { requireUser } from "@/lib/shop";

export const metadata: Metadata = { title: "Novo pet shop" };

export default async function NewShopPage() {
  await requireUser("/app/novo-pet-shop");
  return (
    <div className="min-h-dvh px-4 py-6 sm:px-10">
      <Link href="/app" className="inline-block rounded-md">
        <Brand />
      </Link>
      <main className="mx-auto mt-16 max-w-[420px]">
        <h1 className="text-[30px]">Abrir um pet shop</h1>
        <p className="mt-2 mb-8 text-tinta-suave">
          Cada pet shop tem a própria assinatura, equipe, agenda e WhatsApp.
        </p>
        <NewShopForm />
      </main>
    </div>
  );
}
