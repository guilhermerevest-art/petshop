import type { Metadata, Viewport } from "next";
import { Toaster } from "sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "PetShop: gestão para banho e tosa", template: "%s – PetShop" },
  description:
    "Agenda por vagas, WhatsApp do seu número, PIX direto na sua conta e checklist de atendimento. Tudo num lugar só.",
};

export const viewport: Viewport = {
  themeColor: "#f4f7f6",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        {children}
        <Toaster
          position="top-center"
          toastOptions={{
            classNames: {
              toast:
                "!rounded-campo !border !border-rejunte !bg-white !text-tinta !font-sans !text-[15px]",
              success: "[&_[data-icon]]:!text-azulejo",
              error: "[&_[data-icon]]:!text-alerta",
            },
          }}
        />
      </body>
    </html>
  );
}
