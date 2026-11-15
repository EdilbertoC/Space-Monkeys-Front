// SI-assisted: written with Claude (Anthropic), reviewed by the Space Monkeys team. See README.
// Area of the Territory page on a map. By default each cell shows the CHANGE between the two
// periods (fire cell-days per year in B minus A, blue = less, orange = more), which is the
// map form of the page's question; "Period A" / "Period B" show one period's levels. With a
// month window (Jul–Oct) the cells count only those months of each year, like the chart. While
// drawing, fire in the rest of Brazil is drawn in neutral grey to show where to draw; a drag
// becomes the lon/lat box of the new area of interest.
import { useEffect, useState } from "react";
import { historyApi } from "../../../app/api";
import { useApi } from "../../../shared/api/useApi";
import type { Schemas } from "../../../shared/api/types";
import {
  boundsOf,
  BRAZIL_BOUNDS,
  cellSize,
  latToY,
  lonToX,
  type Bounds,
} from "../../../shared/geo/projection";
import { PanelState } from "../../history/components/HistoryParts";
import { areaKey, areaLabel, areaSelector, type AreaChoice } from "../../history/model/area";
import type { Meta } from "../../history/model/history-view";
import { GeoMap, HistoryCellsLayer } from "../../map/components/GeoMap";
import {
  isAllYear,
  monthsLabel,
  monthWindowSpans,
  rangeLabel,
  type MonthRange,
  type YearRange,
} from "../model/territory";
import { Spinner, useKeep } from "./loading";

type MapAnswer = Schemas["Map"];
type Cell = MapAnswer["cells"][number];
type Mode = "change" | "a" | "b";
type GridDegrees = "0.1" | "0.25" | "0.5" | "1" | "auto";

/** Cells of one period, summed over its years (whole years or one month window per year). */
type PeriodCells = { cells: Cell[]; grid: number; years: number; key: string };

const windowSpans = (range: YearRange, months: MonthRange) =>
  monthWindowSpans(range, months, today());

/** Sum the cells of several answers on one grid, by cell id. */
function sumCells(answers: MapAnswer[]): Cell[] {
  const add = (x: number | null, y: number | null) =>
    x === null && y === null ? null : (x ?? 0) + (y ?? 0);
  const byId = new Map<number, Cell>();
  for (const answer of answers)
    for (const c of answer.cells) {
      const prev = byId.get(c.cell_id);
      byId.set(
        c.cell_id,
        prev
          ? {
              ...prev,
              harmonized: add(prev.harmonized, c.harmonized),
              modis: add(prev.modis, c.modis),
              viirs: add(prev.viirs, c.viirs),
            }
          : { ...c },
      );
    }
  return [...byId.values()];
}

/**
 * The month window of one period: one /history/map call per year (the endpoint takes a single
 * date span), all on `grid` so the cells line up, summed per cell.
 */
function useWindowCells(
  area: AreaChoice,
  range: YearRange | null,
  months: MonthRange,
  grid: number | null,
) {
  const windowed = !isAllYear(months);
  return useApi<PeriodCells>(
    windowed && range && grid !== null
      ? async (signal) => {
          const spans = windowSpans(range, months);
          const answers = await Promise.all(
            spans.map((s) =>
              historyApi.getMap(
                { ...areaSelector(area), ...s, cell_degrees: String(grid) as GridDegrees },
                { signal },
              ),
            ),
          );
          return {
            cells: sumCells(answers),
            grid,
            years: Math.max(1, spans.length),
            key: `${range.from}-${range.to}|${months.from}-${months.to}|${grid}`,
          };
        }
      : null,
    [areaKey(area), range?.from, range?.to, months.from, months.to, grid],
  );
}

/** A whole-years answer in the same shape. */
function wholeYears(answer: MapAnswer | null): PeriodCells | null {
  return answer
    ? {
        cells: answer.cells,
        grid: answer.grid_degrees,
        years: yearsIn(answer.period),
        key: `${answer.period.start}${answer.period.end}|all|${answer.grid_degrees}`,
      }
    : null;
}

const BRAZIL_AREA: AreaChoice = { kind: "country", country: "BR" };

const today = () => new Date().toISOString().slice(0, 10);
const spanOf = (r: YearRange) => {
  const end = `${r.to}-12-31`;
  return { start: `${r.from}-01-01`, end: end > today() ? today() : end };
};

/** Map cells of one area and period; `grid` "auto" lets the API pick the finest grid. */
function useCells(area: AreaChoice | null, range: YearRange | null, grid: GridDegrees | null) {
  return useApi(
    area && range && grid
      ? (signal) =>
          historyApi.getMap(
            { ...areaSelector(area), ...spanOf(range), cell_degrees: grid },
            { signal },
          )
      : null,
    [area ? areaKey(area) : null, range?.from, range?.to, grid],
  );
}

/** Both periods of the area on one grid, so cells can be subtracted. */
function usePeriodCells(area: AreaChoice, periods: { a: YearRange; b: YearRange } | null) {
  const a = useCells(area, periods?.a ?? null, "auto");
  const b = useCells(area, periods?.b ?? null, "auto");
  const ga = a.data?.grid_degrees;
  const gb = b.data?.grid_degrees;
  // "auto" can pick different grids for the two periods; refetch the finer one on the coarser.
  const common = ga !== undefined && gb !== undefined ? Math.max(ga, gb) : null;
  const fix = (g: number | undefined) =>
    common !== null && g !== undefined && g !== common ? (String(common) as GridDegrees) : null;
  const a2 = useCells(area, fix(ga) ? (periods?.a ?? null) : null, fix(ga));
  const b2 = useCells(area, fix(gb) ? (periods?.b ?? null) : null, fix(gb));
  const finalA = fix(ga) ? a2 : a;
  const finalB = fix(gb) ? b2 : b;
  return { a: finalA, b: finalB };
}

export default function TerritoryMap({
  meta,
  area,
  periods,
  drawing,
  onDrawingChange,
  onAreaChange,
  months,
}: {
  meta: Meta;
  area: AreaChoice;
  periods: { a: YearRange; b: YearRange } | null;
  drawing: boolean;
  onDrawingChange: (drawing: boolean) => void;
  onAreaChange: (area: AreaChoice) => void;
  /** Months counted in each year, as on the rest of the page. */
  months: MonthRange;
}) {
  const [mode, setMode] = useState<Mode>("change");
  const [error, setError] = useState<string | null>(null);
  const isBrazil = area.kind === "country";

  const own = usePeriodCells(area, periods);
  // While a period changes, the previous cells stay (dimmed) until the new ones arrive.
  const keptA = useKeep(own.a, areaKey(area));
  const keptB = useKeep(own.b, areaKey(area));
  // With a month window, the whole-year answers only fix the grid (their last known one, so
  // the window requests start at once) and the map's extent; cells come per year.
  const windowed = !isAllYear(months);
  const season = windowed ? monthsLabel(months) : null;
  const ga = keptA.data?.grid_degrees;
  const gb = keptB.data?.grid_degrees;
  const windowGrid = ga !== undefined && gb !== undefined ? Math.max(ga, gb) : null;
  const winA = useWindowCells(area, periods?.a ?? null, months, windowGrid);
  const winB = useWindowCells(area, periods?.b ?? null, months, windowGrid);
  const keptWinA = useKeep(winA, areaKey(area));
  const keptWinB = useKeep(winB, areaKey(area));
  const dataA = windowed ? keptWinA.data : wholeYears(keptA.data);
  const dataB = windowed ? keptWinB.data : wholeYears(keptB.data);
  const shownRange = periods ? periods[mode === "a" ? "a" : "b"] : null;
  // Fire in the rest of Brazil as grey context, only while drawing: at all times it would
  // cover the basemap in a grey blanket (fire is almost everywhere at coarse grids).
  const context = useCells(drawing && !isBrazil ? BRAZIL_AREA : null, shownRange, "auto");

  // Esc cancels drawing.
  useEffect(() => {
    if (!drawing) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onDrawingChange(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawing, onDrawingChange]);
  useEffect(() => {
    if (!drawing) setError(null);
  }, [drawing]);

  const box: Bounds | null =
    area.kind === "bbox" ? (area.bbox.split(",").map(Number) as Bounds) : null;
  const levelData = mode === "a" ? dataA : dataB;
  // The extent comes from whole years, so changing the months does not move the map.
  const extentCells = [...(keptA.data?.cells ?? []), ...(keptB.data?.cells ?? [])];
  const half = (keptB.data?.grid_degrees ?? keptA.data?.grid_degrees ?? 0.1) / 2;
  const fireExtent = boundsOf(extentCells);
  const bounds: Bounds =
    box ??
    (fireExtent
      ? [fireExtent[0] - half, fireExtent[1] - half, fireExtent[2] + half, fireExtent[3] + half]
      : BRAZIL_BOUNDS);

  const maxCells = meta.limits?.max_area_cells ?? 50_000;
  const onBoxDrawn = ([w, s, e, n]: Bounds) => {
    const cells = Math.round((e - w) * 10) * Math.round((n - s) * 10);
    if (cells > maxCells) {
      setError(
        `That box has ${cells.toLocaleString("en-US")} cells; the limit is ${maxCells.toLocaleString("en-US")}. Draw a smaller one.`,
      );
      return;
    }
    setError(null);
    onDrawingChange(false);
    onAreaChange({ kind: "bbox", bbox: [w, s, e, n].map((v) => v.toFixed(1)).join(",") });
  };

  // Years travel with each period's cells, so stale cells are still divided right.
  const change =
    mode === "change" && dataA && dataB && dataA.grid === dataB.grid
      ? changeCells(dataA, dataB)
      : null;
  const ownError = own.a.error ?? own.b.error ?? winA.error ?? winB.error;
  const wholeLoading = own.a.status === "loading" || own.b.status === "loading";
  const winLoading =
    winA.status === "loading" || winB.status === "loading" || (windowGrid === null && wholeLoading);
  const loadingOwn = periods !== null && (windowed ? winLoading : wholeLoading);
  const hasCells = mode === "change" ? change !== null : levelData !== null;
  const refreshing = loadingOwn && hasCells;
  const firstLoad = loadingOwn && !hasCells;
  const grid = dataB?.grid ?? dataA?.grid ?? null;
  const seasons =
    periods && windowed
      ? windowSpans(periods.a, months).length + windowSpans(periods.b, months).length
      : 0;

  const title =
    mode === "change"
      ? "Where it changed"
      : `Where it burned, ${shownRange ? rangeLabel(shownRange) : "…"}${season ? `, ${season}` : ""}`;
  return (
    <section className="panel tr-map-panel">
      <div className="tr-map-head">
        <h2>{drawing ? "Draw the area to analyse" : title}</h2>
        <div className="tr-seg" role="group" aria-label="What the map shows">
          {(
            [
              ["change", "Change B vs A"],
              ["a", "Period A"],
              ["b", "Period B"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              aria-pressed={mode === k}
              className={mode === k ? "on" : ""}
              disabled={!periods}
              onClick={() => setMode(k)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      {drawing && (
        <p className="tr-draw-hint" role="status">
          Drag a box on the map. It snaps to the 0.1° grid. Esc cancels.
        </p>
      )}
      {error && (
        <p className="hw-note warn tr-draw-error" role="alert">
          {error}
        </p>
      )}
      {context.status === "error" && ownError ? (
        <PanelState error={ownError} />
      ) : (
        <div className={`tr-map-stage ${refreshing ? "refreshing" : ""}`} aria-busy={loadingOwn}>
          {(firstLoad || refreshing) && (
            <Spinner
              label={
                firstLoad
                  ? windowed
                    ? `Loading ${season} of ${seasons} years…`
                    : "Loading cells…"
                  : "Updating…"
              }
            />
          )}
          <GeoMap
            bounds={bounds}
            large
            minSpan={3}
            label={
              mode === "change"
                ? `Change in fire cell-days per cell in ${areaLabel(area)}${season ? `, ${season} of each year` : ""}, period B against period A`
                : `Fire cell-days per cell in ${areaLabel(area)}${season ? `, ${season} of each year` : ""}`
            }
            drawing={drawing}
            onBoxDrawn={onBoxDrawn}
            selection={box}
            legend={
              mode === "change" ? (
                <ChangeLegend
                  scale={change?.strong ?? null}
                  grid={grid}
                  loading={loadingOwn}
                  context={context.status === "success"}
                  season={season}
                />
              ) : (
                <LevelLegend
                  grid={grid}
                  loading={loadingOwn}
                  context={context.status === "success"}
                  season={season}
                />
              )
            }
          >
            {context.status === "success" && (
              <g className="geo-context">
                <HistoryCellsLayer
                  cells={context.data.cells}
                  series="harmonized"
                  gridDegrees={context.data.grid_degrees}
                />
              </g>
            )}
            {mode === "change" && change && grid !== null && (
              <ChangeCellsLayer key={change.key} cells={change.cells} gridDegrees={grid} />
            )}
            {mode !== "change" && levelData && (
              <g className="tr-fade-in" key={`${mode}${levelData.key}`}>
                <HistoryCellsLayer
                  cells={levelData.cells}
                  series="harmonized"
                  gridDegrees={levelData.grid}
                />
              </g>
            )}
          </GeoMap>
        </div>
      )}
    </section>
  );
}

type ChangeCell = {
  id: number;
  lat: number;
  lon: number;
  perYearA: number;
  perYearB: number;
  diff: number;
  cls: "n2" | "n1" | "z" | "p1" | "p2";
};

/**
 * Per cell: fire cell-days per year in B minus per year in A (a cell missing from one period
 * had no fire there). Classes are set against the 90th percentile of |difference|, so one
 * extreme cell does not wash the rest out: "similar" below 20% of it, "much" from 60%.
 */
function changeCells(mapA: PeriodCells, mapB: PeriodCells) {
  const na = mapA.years;
  const nb = mapB.years;
  const byId = new Map<number, { lat: number; lon: number; a: number; b: number }>();
  for (const c of mapA.cells)
    byId.set(c.cell_id, { lat: c.lat, lon: c.lon, a: c.harmonized ?? 0, b: 0 });
  for (const c of mapB.cells) {
    const prev = byId.get(c.cell_id);
    if (prev) prev.b = c.harmonized ?? 0;
    else byId.set(c.cell_id, { lat: c.lat, lon: c.lon, a: 0, b: c.harmonized ?? 0 });
  }
  const raw = [...byId.entries()].map(([id, v]) => ({
    id,
    lat: v.lat,
    lon: v.lon,
    perYearA: v.a / na,
    perYearB: v.b / nb,
    diff: v.b / nb - v.a / na,
  }));
  const mags = raw.map((c) => Math.abs(c.diff)).sort((x, y) => x - y);
  const p90 = mags.length ? mags[Math.min(mags.length - 1, Math.floor(mags.length * 0.9))]! : 0;
  const similar = p90 * 0.2;
  const strong = p90 * 0.6;
  const cells: ChangeCell[] = raw.map((c) => ({
    ...c,
    cls:
      Math.abs(c.diff) <= similar
        ? "z"
        : c.diff < 0
          ? c.diff <= -strong
            ? "n2"
            : "n1"
          : c.diff >= strong
            ? "p2"
            : "p1",
  }));
  return { cells, strong, key: `${mapA.key}/${mapB.key}` };
}

/** Length of an answer's period in years (dates are inclusive). */
function yearsIn(period: MapAnswer["period"]): number {
  const days = (Date.parse(period.end) - Date.parse(period.start)) / 86_400_000 + 1;
  return Math.max(days / 365.2425, 1 / 365);
}

const per = (v: number) => (v < 10 ? v.toFixed(1) : v.toFixed(0));

function ChangeCellsLayer({ cells, gridDegrees }: { cells: ChangeCell[]; gridDegrees: number }) {
  const size = cellSize(gridDegrees);
  return (
    <g className="tr-change tr-fade-in">
      {cells.map((c) => (
        <rect
          key={c.id}
          className={`tr-chg ${c.cls}`}
          x={lonToX(c.lon) - size.width / 2}
          y={latToY(c.lat) - size.height / 2}
          width={size.width}
          height={size.height}
        >
          <title>
            {`${c.lat.toFixed(2)}°, ${c.lon.toFixed(2)}° · ${per(c.perYearA)} → ${per(c.perYearB)} fire cell-days per year (${c.diff < 0 ? "−" : "+"}${per(Math.abs(c.diff))})`}
          </title>
        </rect>
      ))}
    </g>
  );
}

function ChangeLegend({
  scale,
  grid,
  loading,
  context,
  season,
}: {
  scale: number | null;
  grid: number | null;
  loading: boolean;
  context: boolean;
  season: string | null;
}) {
  const steps = [
    ["n2", "Much less"],
    ["n1", "Less"],
    ["z", "Similar"],
    ["p1", "More"],
    ["p2", "Much more"],
  ] as const;
  return (
    <div className="tr-map-legend">
      <div className="tr-scale">
        {steps.map(([cls, label]) => (
          <span key={cls}>
            <i className={`tr-chg-key ${cls}`} />
            {label}
          </span>
        ))}
      </div>
      <span className="tr-legend-note">
        {loading
          ? "Loading cells…"
          : `Fire cell-days ${season ? `in ${season} of each year` : "per year"} in each ${grid ?? 0.1}° cell, B against A${scale ? `. "Much" is beyond ±${per(scale)}` : ""}.`}
      </span>
      {context && (
        <span className="tr-context-key">
          <i /> Fire outside the area
        </span>
      )}
    </div>
  );
}

function LevelLegend({
  grid,
  loading,
  context,
  season,
}: {
  grid: number | null;
  loading: boolean;
  context: boolean;
  season: string | null;
}) {
  return (
    <div className="tr-map-legend">
      <div className="tr-scale">
        <span>
          <i className="geo-swatch l1" />
          Fewest
        </span>
        <span>
          <i className="geo-swatch l2" />
        </span>
        <span>
          <i className="geo-swatch l3" />
        </span>
        <span>
          <i className="geo-swatch l4" />
        </span>
        <span>
          <i className="geo-swatch l5" />
          Most
        </span>
      </div>
      <span className="tr-legend-note">
        {loading
          ? "Loading cells…"
          : `Fire cell-days in each ${grid ?? 0.1}° cell, ${season ? `${season} of each year` : "whole years"}.`}
      </span>
      {context && (
        <span className="tr-context-key">
          <i /> Fire outside the area
        </span>
      )}
    </div>
  );
}
