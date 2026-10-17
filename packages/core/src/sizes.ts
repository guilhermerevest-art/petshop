export const SIZES = ["P", "M", "G", "GG"] as const;
export type Size = (typeof SIZES)[number];

export const SIZE_LABELS: Record<Size, string> = {
  P: "Pequeno",
  M: "Médio",
  G: "Grande",
  GG: "Gigante",
};

/** Limite superior de peso (kg) de cada porte; GG não tem limite. */
export type SizeRanges = { P: number; M: number; G: number };

export const DEFAULT_SIZE_RANGES: SizeRanges = { P: 10, M: 25, G: 45 };

export function sizeForWeight(weightKg: number, ranges: SizeRanges = DEFAULT_SIZE_RANGES): Size {
  if (weightKg <= ranges.P) return "P";
  if (weightKg <= ranges.M) return "M";
  if (weightKg <= ranges.G) return "G";
  return "GG";
}

export function isValidSizeRanges(ranges: SizeRanges): boolean {
  return ranges.P > 0 && ranges.P < ranges.M && ranges.M < ranges.G && ranges.G < 200;
}

export function describeSizeRange(size: Size, ranges: SizeRanges = DEFAULT_SIZE_RANGES): string {
  switch (size) {
    case "P":
      return `até ${ranges.P} kg`;
    case "M":
      return `${ranges.P} a ${ranges.M} kg`;
    case "G":
      return `${ranges.M} a ${ranges.G} kg`;
    case "GG":
      return `acima de ${ranges.G} kg`;
  }
}
