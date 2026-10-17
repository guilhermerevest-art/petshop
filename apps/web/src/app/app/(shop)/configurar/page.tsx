import { redirect } from "next/navigation";
import { firstPendingStep } from "@/lib/onboarding";
import { requireShop } from "@/lib/shop";

export default async function SetupIndexPage() {
  const ctx = await requireShop({ capability: "shop.edit" });
  const pending = firstPendingStep(ctx.profile.onboarding);
  redirect(pending ? `/app/configurar/${pending}` : "/app/configurar/pronto");
}
