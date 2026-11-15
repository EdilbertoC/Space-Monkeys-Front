// Isolated UI scenarios, not observed incidents, derived z-scores, calibrated
// FRP, biome classifications, geographic boundaries or responder advisories.
import type { SensorSelection } from "../../sensors/sensors.ts";
import type { CalendarScope } from "./calendar-data.ts";
import { CALENDAR_CUTOFF } from "./calendar-data.ts";
import type { AreaSelection, MapPoint } from "./exploration.ts";

export type PriorityScenario = {
  id: string;
  region: string;
  biome: string;
  status: "CRITICAL" | "WARNING";
  pattern: "Atypical Forest Wildfire" | "Recurring Agricultural";
  zScore: number;
  mockFrpMw: number;
  markerIndex: number;
  center: MapPoint;
  area: AreaSelection;
  date: string;
  illustrative: true;
};
const area = (x: number, y: number): AreaSelection => ({
  kind: "polygon",
  cells: [],
  points: [
    { x: x - 12, y: y - 9 },
    { x: x + 9, y: y - 12 },
    { x: x + 15, y: y + 5 },
    { x: x + 2, y: y + 13 },
    { x: x - 14, y: y + 7 },
  ],
});
export const PRIORITY_SCENARIOS: PriorityScenario[] = [
  {
    id: "tapajos-preview",
    region: "Tapajós basin",
    biome: "Amazon · Brazil",
    status: "CRITICAL",
    pattern: "Atypical Forest Wildfire",
    zScore: 4.72,
    mockFrpMw: 18420,
    markerIndex: 6,
    center: { x: 341.48, y: 270.08 },
    area: area(341.48, 270.08),
    date: CALENDAR_CUTOFF,
    illustrative: true,
  },
  {
    id: "xingu-preview",
    region: "Xingu corridor",
    biome: "Amazon · Brazil",
    status: "CRITICAL",
    pattern: "Atypical Forest Wildfire",
    zScore: 3.86,
    mockFrpMw: 12760,
    markerIndex: 8,
    center: { x: 324.18, y: 282.16 },
    area: area(324.18, 282.16),
    date: CALENDAR_CUTOFF,
    illustrative: true,
  },
  {
    id: "mato-grosso-preview",
    region: "Mato Grosso mosaic",
    biome: "Cerrado · Brazil",
    status: "WARNING",
    pattern: "Recurring Agricultural",
    zScore: 2.41,
    mockFrpMw: 8340,
    markerIndex: 217,
    center: { x: 372.62, y: 333.68 },
    area: area(372.62, 333.68),
    date: CALENDAR_CUTOFF,
    illustrative: true,
  },
  {
    id: "matopiba-preview",
    region: "MATOPIBA frontier",
    biome: "Cerrado · Brazil",
    status: "WARNING",
    pattern: "Recurring Agricultural",
    zScore: 2.18,
    mockFrpMw: 6920,
    markerIndex: 246,
    center: { x: 347.91, y: 316.52 },
    area: area(347.91, 316.52),
    date: CALENDAR_CUTOFF,
    illustrative: true,
  },
];
export function priorityScenarios(period: string, sensor: SensorSelection, scope: CalendarScope) {
  if (sensor !== "ALL" && sensor !== "All") return [];
  if (scope.kind === "Continent" && scope.name !== "South America") return [];
  if (scope.kind === "Country" && scope.name !== "Brazil") return [];
  const [start, end] = period.split("/");
  if (!start || !end) return [];
  return PRIORITY_SCENARIOS.filter((row) => row.date >= start && row.date <= end);
}
export function markerScenario(index: number, period: string) {
  const [start, end] = period.split("/");
  return PRIORITY_SCENARIOS.find(
    (row) => row.markerIndex === index && row.date >= start && row.date <= end,
  );
}
