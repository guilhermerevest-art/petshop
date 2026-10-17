"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function NavLink({
  href,
  icon,
  children,
  exact = false,
  onNavigate,
}: {
  href: string;
  icon: ReactNode;
  children: ReactNode;
  exact?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const active = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex h-11 items-center gap-3 rounded-campo px-3 text-[15px] transition-colors",
        active ? "bg-azulejo-claro font-medium text-azulejo-escuro" : "text-tinta hover:bg-espuma",
      )}
    >
      <span className={cn("[&>svg]:size-5", active ? "text-azulejo" : "text-tinta-suave")} aria-hidden>
        {icon}
      </span>
      {children}
    </Link>
  );
}
