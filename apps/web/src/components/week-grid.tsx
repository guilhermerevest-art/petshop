import { formatTime, slotsForDay, WEEKDAY_SHORT, type CapacityRule, type Weekday } from "@petshop/core";
import { cn } from "@/lib/cn";

const ORDER: Weekday[] = [1, 2, 3, 4, 5, 6, 0];

/** Prévia da semana: cada célula mostra as vagas daquele horário como azulejos. */
export function WeekGrid({ rules, className }: { rules: CapacityRule[]; className?: string }) {
  const byDay = new Map(ORDER.map((day) => [day, new Map(slotsForDay(rules, day).map((s) => [s.start, s.capacity]))]));
  const times = [...new Set([...byDay.values()].flatMap((slots) => [...slots.keys()]))].sort((a, b) => a - b);

  if (times.length === 0) {
    return (
      <div className={cn("rounded-painel border border-dashed border-rejunte-forte p-6 text-center text-tinta-suave", className)}>
        Abra pelo menos um dia para ver a semana.
      </div>
    );
  }

  return (
    <div className={cn("overflow-x-auto rounded-painel bg-rejunte p-[3px]", className)} role="table" aria-label="Vagas por horário na semana">
      <div className="grid min-w-[520px] grid-cols-[52px_repeat(7,minmax(0,1fr))] gap-[3px]" role="rowgroup">
        <div role="row" className="contents">
          <span role="columnheader" className="rounded-azulejo bg-white">
            <span className="sr-only">Horário</span>
          </span>
          {ORDER.map((day) => (
            <span key={day} role="columnheader" className="rounded-azulejo bg-white py-1.5 text-center text-sm font-medium">
              {WEEKDAY_SHORT[day]}
            </span>
          ))}
        </div>
        {times.map((time) => (
          <div key={time} role="row" className="contents">
            <span role="rowheader" className="flex items-center justify-center rounded-azulejo bg-espuma text-xs font-medium text-tinta-suave tabular">
              {formatTime(time)}
            </span>
            {ORDER.map((day) => {
              const capacity = byDay.get(day)?.get(time) ?? 0;
              return (
                <span
                  key={day}
                  role="cell"
                  aria-label={capacity ? `${WEEKDAY_SHORT[day]} ${formatTime(time)}: ${capacity} vagas` : `${WEEKDAY_SHORT[day]} ${formatTime(time)}: fechado`}
                  className={cn(
                    "flex min-h-9 items-center gap-1 rounded-azulejo px-1.5",
                    capacity ? "bg-white" : "bg-[repeating-linear-gradient(135deg,#eef3f2_0_6px,#f7faf9_6px_12px)]",
                  )}
                >
                  {capacity > 0 ? (
                    <>
                      <span className="flex flex-wrap gap-[2px]" aria-hidden>
                        {Array.from({ length: Math.min(capacity, 6) }).map((_, index) => (
                          <span key={index} className="size-2 rounded-[2px] bg-azulejo" />
                        ))}
                      </span>
                      {capacity > 6 ? <span className="text-xs text-tinta-suave tabular">{capacity}</span> : null}
                    </>
                  ) : null}
                </span>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
