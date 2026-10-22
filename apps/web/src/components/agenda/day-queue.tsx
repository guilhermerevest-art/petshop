import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { formatTime } from "@petshop/core";
import { ActionButton } from "@/components/action-button";
import { Badge } from "@/components/ui/badge";
import type { BoardEntry } from "@/lib/agenda";
import { NEXT_STATUS, PET_STATUS_LABELS, statusTone } from "@/lib/status";
import { updatePetStatusAction } from "@/server/agenda-actions";

/** Fila do dia: cada pet com o próximo passo a um toque. */
export function DayQueue({ entries, inactive }: { entries: BoardEntry[]; inactive: BoardEntry[] }) {
  const open = entries.filter((e) => e.status !== "concluido");
  const done = entries.filter((e) => e.status === "concluido");
  return (
    <section aria-labelledby="fila" className="flex flex-col gap-3">
      <h2 id="fila" className="text-xl">
        Fila do dia
      </h2>
      {entries.length === 0 ? (
        <p className="rounded-painel border border-dashed border-rejunte-forte p-5 text-tinta-suave">
          Nenhum pet agendado neste dia.
        </p>
      ) : null}
      {open.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {open.map((entry) => (
            <QueueItem key={entry.appointmentPetId} entry={entry} />
          ))}
        </ul>
      ) : null}
      {done.length > 0 ? (
        <details className="rounded-painel border border-rejunte bg-white">
          <summary className="cursor-pointer px-4 py-3 text-[15px] font-medium">
            Entregues ({done.length})
          </summary>
          <ul className="border-t border-rejunte">
            {done.map((entry) => (
              <SimpleItem key={entry.appointmentPetId} entry={entry} />
            ))}
          </ul>
        </details>
      ) : null}
      {inactive.length > 0 ? (
        <details className="rounded-painel border border-rejunte bg-white">
          <summary className="cursor-pointer px-4 py-3 text-[15px] font-medium">
            Cancelados e faltas ({inactive.length})
          </summary>
          <ul className="border-t border-rejunte">
            {inactive.map((entry) => (
              <SimpleItem key={entry.appointmentPetId} entry={entry} />
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}

function QueueItem({ entry }: { entry: BoardEntry }) {
  const next = NEXT_STATUS[entry.status];
  return (
    <li className="flex flex-col gap-3 rounded-painel border border-rejunte bg-white p-4">
      <Link href={`/app/agenda/${entry.appointmentId}`} className="group flex items-start gap-3">
        <span className="w-12 shrink-0 pt-0.5 font-medium tabular">{formatTime(entry.start)}</span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5 font-medium group-hover:underline">
            {entry.petName}
            <span className="text-sm font-normal text-tinta-suave">{entry.petSize}</span>
            {entry.hasAlerts ? (
              <AlertTriangle
                className="size-4 text-[#8a5a00]"
                aria-label="Tem cuidados especiais"
              />
            ) : null}
          </span>
          <span className="block truncate text-sm text-tinta-suave">{entry.customerName}</span>
          <span className="block text-sm">{entry.services.join(", ")}</span>
        </span>
        <Badge tone={statusTone(entry.status)}>{PET_STATUS_LABELS[entry.status]}</Badge>
      </Link>
      {next ? (
        <ActionButton
          action={updatePetStatusAction}
          hidden={{ appointmentPetId: entry.appointmentPetId, to: next.to }}
          variant={entry.status === "pronto" ? "primary" : "secondary"}
          size="sm"
          pendingLabel="Salvando…"
        >
          {next.label}
        </ActionButton>
      ) : null}
    </li>
  );
}

function SimpleItem({ entry }: { entry: BoardEntry }) {
  return (
    <li className="[&:not(:first-child)]:border-t [&:not(:first-child)]:border-rejunte">
      <Link
        href={`/app/agenda/${entry.appointmentId}`}
        className="flex items-center gap-3 px-4 py-3 text-[15px] hover:bg-espuma"
      >
        <span className="w-12 shrink-0 tabular">{formatTime(entry.start)}</span>
        <span className="min-w-0 flex-1 truncate">
          {entry.petName} <span className="text-tinta-suave">· {entry.customerName}</span>
        </span>
        <Badge tone={statusTone(entry.status)}>{PET_STATUS_LABELS[entry.status]}</Badge>
      </Link>
    </li>
  );
}
