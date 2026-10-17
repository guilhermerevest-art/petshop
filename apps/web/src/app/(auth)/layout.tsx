import Link from "next/link";
import { Brand } from "@/components/brand";
import { DayBoard } from "@/components/day-board";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <div className="flex min-h-dvh flex-col px-4 py-6 sm:px-10 lg:px-16">
        <Link href="/" className="self-start rounded-md">
          <Brand />
        </Link>
        <main className="flex flex-1 flex-col justify-center py-10">
          <div className="w-full max-w-[420px]">{children}</div>
        </main>
      </div>
      <aside className="hidden border-l border-rejunte bg-white lg:flex lg:flex-col lg:justify-center lg:px-14">
        <DayBoard />
      </aside>
    </div>
  );
}
