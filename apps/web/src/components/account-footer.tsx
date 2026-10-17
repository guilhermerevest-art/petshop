import Link from "next/link";
import { ChevronsUpDown, LogOut, Plus } from "lucide-react";
import { ROLE_LABELS, primaryRole } from "@/lib/permissions";
import { signOutAction, switchShopAction } from "@/server/auth-actions";

export function AccountFooter({
  user,
  shop,
  role,
  shops,
}: {
  user: { name: string; email: string };
  shop: { id: string; name: string };
  role: string;
  shops: { id: string; name: string; role: string }[];
}) {
  const others = shops.filter((s) => s.id !== shop.id);
  return (
    <div className="flex flex-col gap-1">
      <details className="group rounded-campo">
        <summary className="flex min-h-12 cursor-pointer list-none items-center gap-3 rounded-campo px-3 py-2 hover:bg-espuma [&::-webkit-details-marker]:hidden">
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium">{shop.name}</span>
            <span className="block text-sm text-tinta-suave">{ROLE_LABELS[primaryRole(role)]}</span>
          </span>
          <ChevronsUpDown className="size-4 shrink-0 text-tinta-suave" aria-hidden />
        </summary>
        <div className="mt-1 flex flex-col gap-1 rounded-campo border border-rejunte bg-espuma p-1.5">
          {others.map((other) => (
            <form key={other.id} action={switchShopAction}>
              <input type="hidden" name="organizationId" value={other.id} />
              <button type="submit" className="flex h-10 w-full items-center rounded-lg px-2.5 text-left text-[15px] hover:bg-white">
                Trocar para {other.name}
              </button>
            </form>
          ))}
          <Link href="/app/novo-pet-shop" className="flex h-10 items-center gap-2 rounded-lg px-2.5 text-[15px] hover:bg-white">
            <Plus className="size-4" aria-hidden /> Abrir outro pet shop
          </Link>
        </div>
      </details>
      <div className="flex items-center gap-2 px-3 py-1">
        <span className="min-w-0 flex-1 truncate text-sm text-tinta-suave" title={user.email}>
          {user.name}
        </span>
        <form action={signOutAction}>
          <button type="submit" className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2 text-sm text-tinta-suave hover:bg-espuma hover:text-tinta">
            <LogOut className="size-4" aria-hidden /> Sair
          </button>
        </form>
      </div>
    </div>
  );
}
