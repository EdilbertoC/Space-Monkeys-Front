// SI-assisted: written with Claude (Anthropic), reviewed by the Space Monkeys team. See README.
// Area of the Territory page on a map: fire cell-days across Brazil in period A or B
// (/history/map, dimmed, as context) with the analysed area's own cells on top and, for a
// drawn box, its outline. "Draw area" turns a drag into a lon/lat box that becomes the area
// of interest.
import { useState } from "react";
import { historyApi } from "../../../app/api";
import { useApi } from "../../../shared/api/useApi";
import { boundsOf, BRAZIL_BOUNDS, type Bounds } from "../../../shared/geo/projection";
import { PanelTitle } from "../../../shared/ui/ui";
import { PanelState } from "../../history/components/HistoryParts";
import { areaKey, areaLabel, areaSelector, type AreaChoice } from "../../history/model/area";
import type { Meta } from "../../history/model/history-view";
import { GeoMap, HistoryCellsLayer } from "../../map/components/GeoMap";
import { rangeLabel, type YearRange } from "../model/territory";

export default function TerritoryMap({
  meta,
  area,
  periods,
  onAreaChange,
}: {
  meta: Meta;
  area: AreaChoice;
  periods: { a: YearRange; b: YearRange } | null;
  onAreaChange: (area: AreaChoice) => void;
}) {
  const [which, setWhich] = useState<"a" | "b">("b");
  const [drawing, setDrawing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const range = periods?.[which] ?? null;
  const today = new Date().toISOString().slice(0, 10);
  const end = range ? (`${range.to}-12-31` > today ? today : `${range.to}-12-31`) : null;
  const start = range ? `${range.from}-01-01` : null;

  // Brazil as context so a box can be drawn anywhere; cell size adapts to the limit.
  const context = useApi(
    start && end
      ? (signal) =>
          historyApi.getMap({ country: "BR", start, end, cell_degrees: "auto" }, { signal })
      : null,
    [start, end],
  );
  // The analysed area's own cells (not needed when the area is Brazil itself).
  const isBrazil = area.kind === "country";
  const own = useApi(
    start && end && !isBrazil
      ? (signal) =>
          historyApi.getMap({ ...areaSelector(area), start, end, cell_degrees: "auto" }, { signal })
      : null,
    [areaKey(area), start, end],
  );

  const box: Bounds | null =
    area.kind === "bbox" ? (area.bbox.split(",").map(Number) as Bounds) : null;
  const ownCells = own.data?.cells ?? [];
  const half = (own.data?.grid_degrees ?? 0.1) / 2;
  const fireExtent = boundsOf(ownCells);
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
        `That box has ${cells.toLocaleString("en-US")} cells of 0.1°; the limit is ${maxCells.toLocaleString("en-US")}. Draw a smaller box.`,
      );
      return;
    }
    setError(null);
    setDrawing(false);
    onAreaChange({ kind: "bbox", bbox: [w, s, e, n].map((v) => v.toFixed(1)).join(",") });
  };

  const contextCells = context.data?.cells ?? [];
  const when = range ? rangeLabel(range) : "the selected period";
  return (
    <section className="panel tr-map-panel">
      <PanelTitle
        title="Area on the map"
        subtitle={
          drawing
            ? "Drag on the map to draw the area to analyse. It snaps to the 0.1° grid."
            : isBrazil
              ? `Fire cell-days across Brazil in ${when}, whole years. Use Draw area to analyse a box.`
              : `Bright squares: ${areaLabel(area)}; dim squares: the rest of Brazil. Fire cell-days in ${when}, whole years.${box ? " Dashed line: the drawn box." : ""}`
        }
      >
        <div className="segmented" role="group" aria-label="Period shown on the map">
          {(["a", "b"] as const).map((k) => (
            <button
              key={k}
              className={which === k ? "selected" : ""}
              aria-pressed={which === k}
              disabled={!periods}
              onClick={() => setWhich(k)}
            >
              {`Period ${k.toUpperCase()}${periods ? ` · ${rangeLabel(periods[k])}` : ""}`}
            </button>
          ))}
        </div>
        <button
          className={`hw-button ${drawing ? "active" : ""}`}
          aria-pressed={drawing}
          onClick={() => {
            setDrawing(!drawing);
            setError(null);
          }}
        >
          {drawing ? "Cancel drawing" : "Draw area"}
        </button>
      </PanelTitle>
      {error && (
        <p className="hw-note warn hw-pad" role="alert">
          {error}
        </p>
      )}
      {context.status === "error" ? (
        <PanelState error={context.error} />
      ) : (
        <GeoMap
          bounds={bounds}
          label={`Fire cell-days in ${areaLabel(area)} and the rest of Brazil`}
          drawing={drawing}
          onBoxDrawn={onBoxDrawn}
          selection={box}
          legend={
            <>
              <span>
                <i className="geo-swatch l1" />
                <i className="geo-swatch l3" />
                <i className="geo-swatch l5" /> Harmonized: fewer → more fire cell-days
                {own.data ? ` per ${own.data.grid_degrees}° cell` : ""}
              </span>
              <span>
                {own.status === "success"
                  ? `${ownCells.length.toLocaleString("en-US")} cells with fire in the area`
                  : context.status === "success"
                    ? `${contextCells.length.toLocaleString("en-US")} cells with fire in Brazil`
                    : range
                      ? "Loading cells…"
                      : "Waiting for the periods"}
              </span>
              {own.status === "error" && <span>Area cells unavailable</span>}
            </>
          }
        >
          {context.status === "success" && (
            <g className={isBrazil ? "" : "geo-context"}>
              <HistoryCellsLayer
                cells={contextCells}
                series="harmonized"
                gridDegrees={context.data.grid_degrees}
              />
            </g>
          )}
          {own.status === "success" && (
            <HistoryCellsLayer
              cells={ownCells}
              series="harmonized"
              gridDegrees={own.data.grid_degrees}
            />
          )}
        </GeoMap>
      )}
    </section>
  );
}
