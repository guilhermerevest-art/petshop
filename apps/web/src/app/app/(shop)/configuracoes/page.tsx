import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/ui/panel";
import { STEPS } from "@/lib/onboarding";
import { requireShop } from "@/lib/shop";

export const metadata: Metadata = { title: "Configurações" };

export default async function SettingsIndexPage() {
  await requireShop();
  return (
    <>
      <PageHeader title="Configurações" description="Tudo o que define como o pet shop funciona no sistema." />
      <ul className="max-w-2xl overflow-hidden rounded-painel border border-rejunte bg-rejunte">
        {STEPS.map((step) => (
          <li key={step.key} className="[&:not(:first-child)]:mt-px">
            <Link href={`/app/configuracoes/${step.key}`} className="flex items-center gap-4 bg-white px-5 py-4 hover:bg-espuma">
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{step.title}</span>
                <span className="block text-[15px] text-tinta-suave">{step.summary}</span>
              </span>
              <ChevronRight className="size-5 text-tinta-suave" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
