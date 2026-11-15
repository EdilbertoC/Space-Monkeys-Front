import type { components, operations } from "./generated/schema.ts";

export type Schemas = components["schemas"];
export type Biome = Schemas["Biome"];
export type Series = Schemas["Series"];
export type BBox = [west: number, south: number, east: number, north: number];

/** Exactly one area selector, as required by all history endpoints. */
export type AreaSelector =
  | { biome: Biome; bbox?: never; area_id?: never }
  | { bbox: string; biome?: never; area_id?: never }
  | { area_id: string; bbox?: never; biome?: never };

export type HistoryQuery<Id extends keyof operations> = Omit<
  NonNullable<operations[Id]["parameters"]["query"]>,
  "bbox" | "biome" | "area_id"
> &
  AreaSelector;

export type CalendarQuery = HistoryQuery<"getCalendar">;
export type ClimatologyQuery = HistoryQuery<"getClimatology">;
export type AnomalyQuery = HistoryQuery<"getAnomaly">;
export type SeasonQuery = HistoryQuery<"getSeason">;
export type TrendQuery = HistoryQuery<"getTrend">;
export type MapQuery = HistoryQuery<"getMap">;
