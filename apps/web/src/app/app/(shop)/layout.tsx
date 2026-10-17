import { AccessBanner } from "@/components/access-banner";
import { AccountFooter } from "@/components/account-footer";
import { MobileNav, SidebarNav, type NavProps } from "@/components/app-nav";
import { STEP_KEYS } from "@/lib/onboarding";
import { can } from "@/lib/permissions";
import { requireShop } from "@/lib/shop";
import { listUserShops } from "@/lib/shops";

export default async function ShopLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireShop({ allowWithoutAccess: true });
  const shops = await listUserShops(ctx.user.id);
  const done = STEP_KEYS.filter((key) => ctx.profile.onboarding[key]).length;
  const canBilling = can(ctx.role, "billing.manage");

  const nav: NavProps = {
    showSetup: done < STEP_KEYS.length && can(ctx.role, "shop.edit"),
    setupProgress: { done, total: STEP_KEYS.length },
    canBilling,
    isPlatformAdmin: ctx.isPlatformAdmin,
    footer: <AccountFooter user={ctx.user} shop={ctx.organization} role={ctx.role} shops={shops} />,
  };

  return (
    <div className="min-h-dvh lg:flex">
      <SidebarNav {...nav} />
      <div className="min-w-0 flex-1">
        <MobileNav {...nav} />
        <AccessBanner access={ctx.access} canBilling={canBilling} />
        <main id="conteudo" className="mx-auto w-full max-w-[1040px] px-4 pt-6 pb-16 sm:px-8 sm:pt-10">
          {children}
        </main>
      </div>
    </div>
  );
}
