import { Fragment } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { formatTime } from "@petshop/core";
import type { BoardEntry, DayBoard } from "@/lib/agenda";
import { cn } from "@/lib/cn";
import { PET_STATUS_LABELS } from "@/lib/status";

/** O quadro do dia em azulejos: cada coluna é uma vaga, e o pet ocupa todos os horários do atendimento. */
export function DayGrid({
  board,
  date,
  canBook,
  pastBefore,
}: {
  board: DayBoard;
  date: string;
  canBook: boolean;
  /** Minutos do dia antes dos quais as vagas livres já passaram. */
  pastBefore: number;
}) {
  if (board.rows.length === 0) return <div />;
  return (
    <section aria-labelledby="quadro" className="min-w-0">
      <h2 id="quadro" className="sr-only">
        Quadro de vagas
      </h2>
      <div className="-mx-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
        <div
          className="grid gap-[3px] rounded-painel bg-rejunte p-[3px]"
          style={{
            gridTemplateColumns: `56px repeat(${board.lanes}, minmax(116px, 1fr))`,
            minWidth: 56 + board.lanes * 119,
          }}
        >
          {board.rows.map((row, rowIndex) => (
            <Fragment key={row.slot.start}>
              <div className="flex items-center justify-center rounded-azulejo bg-espuma text-sm font-medium text-tinta-suave tabular">
                {formatTime(row.slot.start)}
              </div>
              {row.cells.map((cell, lane) => {
                if (cell === undefined) {
                  return (
                    <div
                      key={lane}
                      aria-hidden
                      className="min-h-[68px] rounded-azulejo bg-rejunte"
                    />
                  );
                }
                if (cell === null) {
                  const past = row.slot.start < pastBefore - 15;
                  if (!canBook || past) {
                    return (
                      <div
                        key={lane}
                        className="flex min-h-[68px] items-center rounded-azulejo bg-white/70 px-3 text-sm text-tinta-suave/70"
                      >
                        {past ? "" : "Livre"}
                      </div>
                    );
                  }
                  return (
                    <Link
                      key={lane}
                      href={`/app/agenda/novo?data=${date}&hora=${row.slot.start}`}
                      className="group flex min-h-[68px] items-center rounded-azulejo bg-azulejo-claro/70 px-3 text-sm text-azulejo-escuro/75 hover:bg-azulejo-claro hover:text-azulejo-escuro"
                    >
                      <span>
                        Vaga livre
                        <span className="sr-only"> às {formatTime(row.slot.start)}</span>
                        <span className="ml-1 opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100">
                          +
                        </span>
                      </span>
                    </Link>
                  );
                }
                const first = rowIndex === 0 || cell.start >= row.slot.start;
                return <Tile key={lane} entry={cell} first={first} />;
              })}
            </Fragment>
          ))}
        </div>
      </div>
    </section>
  );
}

const toneByStatus: Record<string, string> = {
  agendado: "bg-azulejo text-white",
  check_in: "bg-azulejo-escuro text-white",
  em_atendimento: "bg-azulejo-escuro text-white",
  pronto: "bg-patinho text-tinta",
  concluido: "bg-white text-tinta-suave border border-rejunte-forte",
};

function Tile({ entry, first }: { entry: BoardEntry; first: boolean }) {
  const light = entry.status === "pronto" || entry.status === "concluido";
  return (
    <Link
      href={`/app/agenda/${entry.appointmentId}`}
      className={cn(
        "flex min-h-[68px] flex-col justify-center rounded-azulejo px-3 py-2 transition-[filter] hover:brightness-110",
        toneByStatus[entry.status],
        !first && "opacity-80",
      )}
    >
      <span className="flex items-center gap-1 text-[15px] leading-tight font-medium">
        <span className="truncate">{entry.petName}</span>
        <span className={cn("text-xs font-normal", light ? "text-tinta/70" : "text-white/75")}>
          {entry.petSize}
        </span>
        {entry.hasAlerts ? (
          <AlertTriangle
            className={cn("ml-auto size-3.5 shrink-0", light ? "text-[#8a5a00]" : "text-patinho")}
            aria-label="Tem cuidados especiais"
          />
        ) : null}
      </span>
      <span
        className={cn("truncate text-xs leading-tight", light ? "text-tinta/80" : "text-white/80")}
      >
        {first
          ? entry.status === "agendado"
            ? entry.services.join(", ")
            : PET_STATUS_LABELS[entry.status]
          : "continua"}
        {first && entry.overbooked ? " · encaixe" : ""}
      </span>
    </Link>
  );
}
