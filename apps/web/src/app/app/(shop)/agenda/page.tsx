import type { Metadata } from "next";
import Link from "next/link";
import { CalendarPlus, ChevronLeft, ChevronRight } from "lucide-react";
import { addDays, formatLocalDate, isLocalDate, todayIn, utcToZoned } from "@petshop/core";
import { DayGrid } from "@/components/agenda/day-grid";
import { DayQueue } from "@/components/agenda/day-queue";
import { buttonClasses } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { getDayBoard } from "@/lib/agenda";
import { can } from "@/lib/permissions";
import { requireShop } from "@/lib/shop";

export const metadata: Metadata = { title: "Agenda" };

export default async function AgendaPage(props: PageProps<"/app/agenda">) {
  const ctx = await requireShop({ capability: "agenda.operate" });
  const query = await props.searchParams;
  const today = todayIn(ctx.profile.timezone);
  const date = typeof query.data === "string" && isLocalDate(query.data) ? query.data : today;
  const board = await getDayBoard(ctx, date);
  const canBook = can(ctx.role, "agenda.book");
  const free = Math.max(0, board.capacityTotal - board.occupiedTotal);
  const ready = board.entries.filter((e) => e.status === "pronto").length;
  const label = formatLocalDate(date);
  const now = utcToZoned(new Date(), ctx.profile.timezone);
  // Horários que já passaram não aparecem como vaga para agendar.
  const pastBefore = date < now.date ? 24 * 60 : date === now.date ? now.minutes : 0;

  return (
    <>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[15px] font-medium text-tinta-suave">
            {date === today
              ? "Hoje"
              : date === addDays(today, 1)
                ? "Amanhã"
                : date === addDays(today, -1)
                  ? "Ontem"
                  : "Agenda"}
          </p>
          <h1 className="text-[28px] first-letter:uppercase sm:text-[32px]">{label}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <nav aria-label="Trocar o dia" className="flex items-center gap-1">
            <Link
              href={`/app/agenda?data=${addDays(date, -1)}`}
              className={buttonClasses({ variant: "secondary", className: "w-11 px-0" })}
              aria-label="Dia anterior"
            >
              <ChevronLeft className="size-5" aria-hidden />
            </Link>
            {date !== today ? (
              <Link href="/app/agenda" className={buttonClasses({ variant: "secondary" })}>
                Hoje
              </Link>
            ) : null}
            <form className="flex">
              <label htmlFor="dia" className="sr-only">
                Ir para a data
              </label>
              <input
                id="dia"
                type="date"
                name="data"
                defaultValue={date}
                className="h-11 rounded-campo border border-rejunte-forte bg-white px-3 text-[15px] tabular"
              />
              <button
                type="submit"
                className={buttonClasses({ variant: "ghost", className: "ml-1" })}
              >
                Ir
              </button>
            </form>
            <Link
              href={`/app/agenda?data=${addDays(date, 1)}`}
              className={buttonClasses({ variant: "secondary", className: "w-11 px-0" })}
              aria-label="Próximo dia"
            >
              <ChevronRight className="size-5" aria-hidden />
            </Link>
          </nav>
          {canBook ? (
            <Link href={`/app/agenda/novo?data=${date}`} className={buttonClasses({})}>
              <CalendarPlus className="size-4" aria-hidden /> Agendar
            </Link>
          ) : null}
        </div>
      </div>

      {query.novo ? (
        <Notice tone="success" className="mb-5">
          Agendamento criado.
        </Notice>
      ) : null}
      {query.cancelado ? (
        <Notice tone="info" className="mb-5">
          Agendamento cancelado. As vagas voltaram para a agenda.
        </Notice>
      ) : null}

      {!board.open && board.entries.length === 0 ? (
        <div className="rounded-painel border border-dashed border-rejunte-forte p-8 text-center">
          <p className="font-medium">O pet shop não atende neste dia.</p>
          <p className="mt-1 text-tinta-suave">
            {can(ctx.role, "schedule.edit") ? (
              <>
                Ajuste em{" "}
                <Link
                  href="/app/configuracoes/horarios"
                  className="font-medium text-azulejo underline underline-offset-2"
                >
                  Horários e vagas
                </Link>
                .
              </>
            ) : (
              "Escolha outro dia."
            )}
          </p>
        </div>
      ) : (
        <>
          <dl className="mb-5 grid grid-cols-3 gap-[3px] overflow-hidden rounded-painel bg-rejunte p-[3px] sm:max-w-lg">
            <Stat label="Pets" value={board.entries.length} />
            <Stat label="Vagas livres" value={free} />
            <Stat label="Prontos" value={ready} highlight={ready > 0} />
          </dl>
          <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_340px]">
            <DayGrid board={board} date={date} canBook={canBook} pastBefore={pastBefore} />
            <DayQueue entries={board.entries} inactive={board.inactive} />
          </div>
        </>
      )}
    </>
  );
}

function Stat({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div
      className={
        highlight ? "rounded-azulejo bg-patinho px-4 py-3" : "rounded-azulejo bg-white px-4 py-3"
      }
    >
      <dt className="text-sm text-tinta-suave">{label}</dt>
      <dd className="text-2xl font-[650] tabular">{value}</dd>
    </div>
  );
}
