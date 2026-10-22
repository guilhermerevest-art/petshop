import { cn } from "@/lib/cn";

type Tile =
  | {
      kind: "pet";
      pet: string;
      service: string;
      size: string;
      ready?: boolean;
      continues?: boolean;
    }
  | { kind: "free" };

const ROWS: { time: string; tiles: Tile[] }[] = [
  {
    time: "08:00",
    tiles: [
      { kind: "pet", pet: "Thor", service: "Banho", size: "P" },
      { kind: "pet", pet: "Mel", service: "Banho e tosa", size: "M" },
      { kind: "free" },
    ],
  },
  {
    time: "09:00",
    tiles: [
      { kind: "pet", pet: "Luna", service: "Banho", size: "G", ready: true },
      { kind: "pet", pet: "Mel", service: "Banho e tosa", size: "M", continues: true },
      { kind: "pet", pet: "Bidu", service: "Tosa na tesoura", size: "P" },
    ],
  },
  {
    time: "10:00",
    tiles: [
      { kind: "pet", pet: "Pipoca", service: "Hidratação", size: "P" },
      { kind: "free" },
      { kind: "pet", pet: "Bidu", service: "Tosa na tesoura", size: "P", continues: true },
    ],
  },
  { time: "11:00", tiles: [{ kind: "free" }, { kind: "free" }, { kind: "free" }] },
];

/** O quadro do dia em azulejos: a assinatura visual do produto. */
export function DayBoard({
  animated = true,
  className,
}: {
  animated?: boolean;
  className?: string;
}) {
  let order = 0;
  return (
    <figure className={cn("w-full max-w-[560px]", className)}>
      <div className="mb-4 flex items-baseline justify-between">
        <p className="text-lg font-[650]">Sexta, 17 de outubro</p>
        <p className="text-sm text-tinta-suave tabular">3 vagas por horário</p>
      </div>
      <div className="rounded-painel bg-rejunte p-[3px]">
        {ROWS.map((row) => (
          <div
            key={row.time}
            className="grid grid-cols-[56px_repeat(3,minmax(0,1fr))] gap-[3px] [&:not(:first-child)]:mt-[3px]"
          >
            <div className="flex items-center justify-center rounded-azulejo bg-espuma text-sm font-medium text-tinta-suave tabular">
              {row.time}
            </div>
            {row.tiles.map((tile, index) => {
              const delay = animated ? `${order++ * 70}ms` : undefined;
              if (tile.kind === "free") {
                return (
                  <div
                    key={index}
                    style={{ animationDelay: delay }}
                    className={cn(
                      "flex min-h-[64px] items-center rounded-azulejo bg-azulejo-claro/70 px-3 text-sm text-azulejo-escuro/70",
                      animated && "animate-encaixe",
                    )}
                  >
                    Vaga livre
                  </div>
                );
              }
              return (
                <div
                  key={index}
                  style={{ animationDelay: delay }}
                  className={cn(
                    "flex min-h-[64px] flex-col justify-center rounded-azulejo px-3 py-2",
                    tile.ready
                      ? "bg-patinho text-tinta"
                      : tile.continues
                        ? "bg-azulejo/75 text-white"
                        : "bg-azulejo text-white",
                    animated && "animate-encaixe",
                  )}
                >
                  <span className="text-[15px] leading-tight font-medium">
                    {tile.pet}
                    <span
                      className={cn(
                        "ml-1.5 text-xs font-normal",
                        tile.ready ? "text-tinta/70" : "text-white/75",
                      )}
                    >
                      {tile.size}
                    </span>
                  </span>
                  <span
                    className={cn(
                      "text-xs leading-tight",
                      tile.ready ? "text-tinta/80" : "text-white/80",
                    )}
                  >
                    {tile.ready ? "Pronto para buscar" : tile.continues ? "continua" : tile.service}
                  </span>
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <figcaption className="mt-4 max-w-[46ch] text-[15px] text-tinta-suave">
        Cada azulejo é uma vaga. O pet ocupa todos os horários do atendimento, e o tutor recebe a
        foto pelo WhatsApp quando fica pronto.
      </figcaption>
    </figure>
  );
}
