// SI-assisted: written with Claude (Anthropic), reviewed by the Space Monkeys team. See README.
// Fire map of the selected area: fire cell-days per 0.1° cell in the period
// (/history/map) and, optionally, the live fused fires (/fires/live).
import { useState } from "react";
import { historyApi, liveApi } from "../../../app/api";
import type { Series } from "../../../shared/api/types";
import { useApi } from "../../../shared/api/useApi";
import { boundsOf, BRAZIL_BOUNDS, type Bounds } from "../../../shared/geo/projection";
import { PanelTitle } from "../../../shared/ui/ui";
import { PanelState, describeError } from "../../history/components/HistoryParts";
import type { Period } from "../../history/components/PeriodOverview";
import { areaKey, areaLabel, areaSelector, type AreaChoice } from "../../history/model/area";
import { longDate, SERIES_LABEL } from "../../history/model/history-view";
import { GeoMap, HistoryCellsLayer, LiveFiresLayer } from "./GeoMap";

export default function FireMapPanel({
  area,
  period,
  large = false,
}: {
  area: AreaChoice;
  period: Period;
  large?: boolean;
}) {
  const [series, setSeries] = useState<Series>("harmonized");
  const [showLive, setShowLive] = useState(true);
  const map = useApi(
    (signal) =>
      historyApi.getMap({ ...areaSelector(area), ...period, cell_degrees: "auto" }, { signal }),
    [areaKey(area), period.start, period.end],
  );
  const live = useApi(showLive ? (signal) => liveApi.getFires(undefined, { signal }) : null, [
    showLive,
  ]);

  const cells = map.data?.cells ?? [];
  const areaBox = map.data?.area.bbox;
  const bounds: Bounds =
    (areaBox && areaBox.length === 4 ? (areaBox as Bounds) : null) ??
    boundsOf(cells) ??
    BRAZIL_BOUNDS;
  const fires = live.data?.features ?? [];

  return (
    <section className="panel hw-map-panel">
      <PanelTitle
        title="Fire map"
        subtitle={`${areaLabel(area)} · ${longDate(period.start)} – ${longDate(period.end)} UTC. Each square is a ${map.data ? `${map.data.grid_degrees}°` : "0.1°"} cell coloured by its fire cell-days in the period${map.data && map.data.grid_degrees > 0.1 ? " (the sum of its 0.1° cells; the area is too large for 0.1°)" : ""}.`}
      >
        <div className="segmented" role="group" aria-label="Map series">
          {(["harmonized", "modis", "viirs"] as const).map((s) => (
            <button
              key={s}
              className={series === s ? "selected" : ""}
              aria-pressed={series === s}
              onClick={() => setSeries(s)}
            >
              {s === "harmonized" ? "Harmonized" : s.toUpperCase()}
            </button>
          ))}
        </div>
        <label className="hw-check">
          <input
            type="checkbox"
            checked={showLive}
            onChange={(e) => setShowLive(e.target.checked)}
          />{" "}
          Live fires
        </label>
      </PanelTitle>
      {map.status === "error" ? (
        <PanelState error={map.error} />
      ) : (
        <GeoMap
          bounds={bounds}
          large={large}
          label={`Fire cell-days per 0.1° cell in ${areaLabel(area)}`}
          legend={
            <>
              <span>
                <i className="geo-swatch l1" />
                <i className="geo-swatch l3" />
                <i className="geo-swatch l5" /> {SERIES_LABEL[series]}: fewer → more fire cell-days
              </span>
              <span>
                {map.status === "success"
                  ? `${cells.length.toLocaleString("en-US")} cells with fire`
                  : "Loading cells…"}
              </span>
              {showLive && (
                <span>
                  <i className="dot geo-swatch abi" /> GOES ABI{" "}
                  <i className="dot geo-swatch viirs" /> VIIRS{" "}
                  <i className="dot geo-swatch modis" /> MODIS{" "}
                  <i className="dot geo-swatch multi" /> several sensors ·{" "}
                  {live.status === "success"
                    ? `${fires.length} live fires${live.data.updated_at ? `, updated ${live.data.updated_at.slice(11, 16)} UTC` : ""}`
                    : live.status === "error"
                      ? `live fires unavailable: ${describeError(live.error)}`
                      : "loading live fires…"}
                </span>
              )}
            </>
          }
        >
          {map.status === "success" && (
            <HistoryCellsLayer cells={cells} series={series} gridDegrees={map.data.grid_degrees} />
          )}
          {showLive && <LiveFiresLayer fires={fires} />}
        </GeoMap>
      )}
    </section>
  );
}
