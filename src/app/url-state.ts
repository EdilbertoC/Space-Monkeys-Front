// SI-assisted: written with Claude (Anthropic), reviewed by the Space Monkeys team. See README.
// The view, area and Territory choices live in the URL, so an analysis can be shared as a link.
// Only values the app itself offers are read back; anything else falls back to the default.
import type { AreaChoice } from "../features/history/model/area";
import type { Biome } from "../shared/api/types";

const BIOMES: readonly Biome[] = [
  "Amazon",
  "Caatinga",
  "Cerrado",
  "Atlantic Forest",
  "Pampa",
  "Pantanal",
];
const BBOX = /^bbox:-?\d+(\.\d+)?(,-?\d+(\.\d+)?){3}$/;

export function formatArea(area: AreaChoice): string {
  if (area.kind === "biome") return area.biome;
  if (area.kind === "country") return "BR";
  return `bbox:${area.bbox}`;
}

export function parseArea(value: string | null): AreaChoice | null {
  if (!value) return null;
  if (value === "BR") return { kind: "country", country: "BR" };
  const biome = BIOMES.find((b) => b === value);
  if (biome) return { kind: "biome", biome };
  if (BBOX.test(value)) return { kind: "bbox", bbox: value.slice("bbox:".length) };
  return null;
}

export function readParam(name: string): string | null {
  try {
    return new URLSearchParams(window.location.search).get(name);
  } catch {
    return null;
  }
}

/** Set (string) or remove (null) query parameters without adding history entries. */
export function writeParams(updates: Record<string, string | null>): void {
  try {
    const url = new URL(window.location.href);
    for (const [name, value] of Object.entries(updates)) {
      if (value === null || value === "") url.searchParams.delete(name);
      else url.searchParams.set(name, value);
    }
    window.history.replaceState(null, "", url);
  } catch {
    // The URL is a convenience; the page works without it.
  }
}
