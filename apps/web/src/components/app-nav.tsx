"use client";

import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  Building2,
  CalendarClock,
  CreditCard,
  House,
  ListChecks,
  Menu,
  MessageCircle,
  QrCode,
  Scissors,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import { Brand } from "./brand";
import { NavLink } from "./nav-link";

export interface NavProps {
  showSetup: boolean;
  setupProgress: { done: number; total: number };
  canBilling: boolean;
  isPlatformAdmin: boolean;
  footer: React.ReactNode;
}

function NavItems({ showSetup, setupProgress, canBilling, isPlatformAdmin, onNavigate }: NavProps & { onNavigate?: () => void }) {
  return (
    <nav aria-label="Menu principal" className="flex flex-col gap-1">
      <NavLink href="/app" exact icon={<House />} onNavigate={onNavigate}>
        Início
      </NavLink>
      {showSetup ? (
        <NavLink href="/app/configurar" icon={<ListChecks />} onNavigate={onNavigate}>
          <span className="flex flex-1 items-center justify-between">
            Primeiros passos
            <span className="text-sm text-tinta-suave tabular">
              {setupProgress.done}/{setupProgress.total}
            </span>
          </span>
        </NavLink>
      ) : null}
      <p className="mt-5 mb-1 px-3 text-sm font-medium text-tinta-suave">Pet shop</p>
      <NavLink href="/app/configuracoes/horarios" icon={<CalendarClock />} onNavigate={onNavigate}>
        Horários e vagas
      </NavLink>
      <NavLink href="/app/configuracoes/servicos" icon={<Scissors />} onNavigate={onNavigate}>
        Serviços e preços
      </NavLink>
      <NavLink href="/app/configuracoes/equipe" icon={<Users />} onNavigate={onNavigate}>
        Equipe
      </NavLink>
      <NavLink href="/app/configuracoes/whatsapp" icon={<MessageCircle />} onNavigate={onNavigate}>
        WhatsApp
      </NavLink>
      <NavLink href="/app/configuracoes/pix" icon={<QrCode />} onNavigate={onNavigate}>
        PIX
      </NavLink>
      <NavLink href="/app/configuracoes/dados" icon={<Building2 />} onNavigate={onNavigate}>
        Dados do pet shop
      </NavLink>
      {canBilling ? (
        <NavLink href="/app/assinatura" icon={<CreditCard />} onNavigate={onNavigate}>
          Assinatura
        </NavLink>
      ) : null}
      {isPlatformAdmin ? (
        <>
          <p className="mt-5 mb-1 px-3 text-sm font-medium text-tinta-suave">Plataforma</p>
          <NavLink href="/admin" icon={<ShieldCheck />} onNavigate={onNavigate}>
            Painel da plataforma
          </NavLink>
        </>
      ) : null}
    </nav>
  );
}

export function SidebarNav(props: NavProps) {
  return (
    <aside className="sticky top-0 hidden h-dvh w-[264px] shrink-0 flex-col border-r border-rejunte bg-white px-3 py-5 lg:flex">
      <div className="px-3 pb-6">
        <Brand />
      </div>
      <div className="flex-1 overflow-y-auto">
        <NavItems {...props} />
      </div>
      <div className="border-t border-rejunte pt-3">{props.footer}</div>
    </aside>
  );
}

export function MobileNav(props: NavProps) {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-rejunte bg-white/95 px-4 backdrop-blur lg:hidden">
      <Brand />
      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Trigger className="inline-flex h-11 items-center gap-2 rounded-campo px-3 font-medium hover:bg-espuma">
          <Menu className="size-5" aria-hidden />
          Menu
        </Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-tinta/30" />
          <Dialog.Content className="fixed inset-y-0 right-0 z-50 flex w-[min(320px,88vw)] flex-col bg-white px-3 py-4 shadow-xl">
            <div className="flex items-center justify-between px-3 pb-4">
              <Dialog.Title className="text-lg font-[650]">Menu</Dialog.Title>
              <Dialog.Close className="inline-flex size-11 items-center justify-center rounded-campo hover:bg-espuma" aria-label="Fechar menu">
                <X className="size-5" aria-hidden />
              </Dialog.Close>
            </div>
            <Dialog.Description className="sr-only">Navegação do sistema</Dialog.Description>
            <div className="flex-1 overflow-y-auto">
              <NavItems {...props} onNavigate={() => setOpen(false)} />
            </div>
            <div className="border-t border-rejunte pt-3">{props.footer}</div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </header>
  );
}
