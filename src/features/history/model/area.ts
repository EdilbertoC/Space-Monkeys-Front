// SI-assisted: written with Claude (Anthropic), reviewed by the Space Monkeys team. See README.
// The area of interest shared by every page: a Brazilian biome or a lon/lat box.
import type { AreaSelector, Biome } from "../../../shared/api/types.ts";

export type AreaChoice =
  | { kind: "biome"; biome: Biome }
  | { kind: "country"; country: "BR" }
  | { kind: "bbox"; bbox: string };

export const DEFAULT_AREA: AreaChoice = { kind: "biome", biome: "Pantanal" };

export function areaSelector(area: AreaChoice): AreaSelector {
  if (area.kind === "biome") return { biome: area.biome };
  if (area.kind === "country") return { country: area.country };
  return { bbox: area.bbox };
}

export function areaLabel(area: AreaChoice): string {
  if (area.kind === "biome") return `${area.biome} biome (IBGE 2019)`;
  if (area.kind === "country") return "Brazil (all biomes)";
  const [w, s, e, n] = area.bbox.split(",");
  return `Box ${s}° to ${n}° lat, ${w}° to ${e}° lon`;
}

export function areaKey(area: AreaChoice): string {
  if (area.kind === "biome") return `biome:${area.biome}`;
  if (area.kind === "country") return `country:${area.country}`;
  return `bbox:${area.bbox}`;
}

/** Inclusive number of UTC days in a "start/end" period. */
export function periodDays(start: string, end: string): number {
  return Math.round((Date.parse(end) - Date.parse(start)) / 86_400_000) + 1;
}

/** The last `days` days ending on `end` (inclusive, UTC). */
export function lastDays(end: string, days: number): { start: string; end: string } {
  const d = new Date(`${end}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - days + 1);
  return { start: d.toISOString().slice(0, 10), end };
}
