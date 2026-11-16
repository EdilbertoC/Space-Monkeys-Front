// SI-assisted: written with Claude (Anthropic), reviewed by the Space Monkeys team. See README.
// Fires now: raw VIIRS detections from /detections/recent (the worker keeps the last 48
// hours of FIRMS NRT), in the area of interest. VIIRS only: no MODIS, no GOES ABI and no
// event fused across sensors. Everything on the page speaks of the present.
//
// /detections/recent filters by box only. For a biome or Brazil, the page keeps the
// detections whose cell belongs to the area: the area's cells come from /history/map over
// the VIIRS era, used for geography only and never shown.
import { useEffect, useMemo, useState } from "react";
import { liveApi, slowHistoryApi, systemApi } from "../../../app/api";
import type { Schemas } from "../../../shared/api/types";
import { useApi } from "../../../shared/api/useApi";
import { useKeep } from "../../../shared/api/useKeep";
import { boundsOf, BRAZIL_BOUNDS, type Bounds } from "../../../shared/geo/projection";
import { PanelTitle } from "../../../shared/ui/ui";
import { Card, PanelState } from "../../history/components/HistoryParts";
import { areaKey, areaLabel, areaSelector, type AreaChoice } from "../../history/model/area";
import { coverageEnd, type Meta } from "../../history/model/history-view";
import { ageClass, DetectionsLayer, GeoMap } from "../../map/components/GeoMap";
import { MapHint, MapLegend, MapStage } from "../../map/components/MapParts";

type Detection = Schemas["DetectionCollection"]["features"][number];

const REFRESH_MS = 5 * 60_000;

const SATELLITE: Record<string, string> = {
  N20: "NOAA-20",
  N21: "NOAA-21",
  SNPP: "S-NPP",
  NPP: "S-NPP",
};
const satelliteName = (d: Detection) => {
  const s = d.properties.satellite ?? "";
  return SATELLITE[s] ?? (s || "VIIRS");
};

const clock = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)} ${iso.slice(11, 16)}`;
const place = (d: Detection) => {
  const [lon, lat] = d.geometry.coordinates as [number, number];
  return `${Math.abs(lat).toFixed(2)}°${lat < 0 ? "S" : "N"}, ${Math.abs(lon).toFixed(2)}°${lon < 0 ? "W" : "E"}`;
};
const frp = (d: Detection) =>
  d.properties.frp_mw == null ? "—" : `${d.properties.frp_mw.toFixed(1)} MW`;
const describe = (d: Detection) =>
  `${satelliteName(d)} · ${clock(d.properties.time)} UTC · ${place(d)} · FRP ${frp(d)}${d.properties.daynight === "N" ? " · night" : d.properties.daynight === "D" ? " · day" : ""}`;

/** Centre key of the `g`-degree cell holding a point, as the API writes cell centres. */
const cellKey = (lat: number, lon: number, g: number) =>
  `${((Math.floor(lat / g) + 0.5) * g).toFixed(3)},${((Math.floor(lon / g) + 0.5) * g).toFixed(3)}`;

type MapAnswer = Schemas["Map"];

// The area's cells take a few seconds to compute (all of Brazil is the slowest), and they do
// not change during a session: fetch them once per area, retry once if the server is busy,
// and let the request finish even when the page is left, so the next visit is instant.
const areaCellsCache = new Map<string, Promise<MapAnswer>>();
function loadAreaCells(meta: Meta, area: AreaChoice): Promise<MapAnswer> {
  const key = areaKey(area);
  let pending = areaCellsCache.get(key);
  if (!pending) {
    const query = {
      ...areaSelector(area),
      start: meta.coverage.viirs?.start ?? "2012-01-20",
      end: coverageEnd(meta),
      cell_degrees: "auto" as const,
    };
    pending = slowHistoryApi
      .getMap(query)
      .catch(() => slowHistoryApi.getMap(query))
      .catch((err: unknown) => {
        areaCellsCache.delete(key);
        throw err;
      });
    areaCellsCache.set(key, pending);
  }
  return pending;
}

/** The area's cells (for a biome or Brazil) and the box that frames them. */
function useArea(meta: Meta, area: AreaChoice, tick: number) {
  // `tick` lets Refresh retry after a failure; a cached answer comes back at once.
  const cells = useApi(area.kind === "bbox" ? null : () => loadAreaCells(meta, area), [
    areaKey(area),
    tick,
  ]);
  // While a refresh re-reads them, the cells already known for this area stay in use.
  const known = useKeep(cells, areaKey(area)).data;
  return useMemo(() => {
    if (area.kind === "bbox") {
      const box = area.bbox.split(",").map(Number) as Bounds;
      return { box, grid: null, keys: null, error: null };
    }
    if (!known) return { box: null, grid: null, keys: null, error: cells.error };
    const g = known.grid_degrees;
    const ext = boundsOf(known.cells) ?? BRAZIL_BOUNDS;
    const box: Bounds = [ext[0] - g / 2, ext[1] - g / 2, ext[2] + g / 2, ext[3] + g / 2];
    const keys = new Set(known.cells.map((c) => cellKey(c.lat, c.lon, g)));
    return { box, grid: g, keys, error: null };
  }, [area, known, cells.error]);
}

export default function LiveNow({ meta, area }: { meta: Meta; area: AreaChoice }) {
  const [tick, setTick] = useState(0);
  const shape = useArea(meta, area, tick);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), REFRESH_MS);
    return () => clearInterval(id);
  }, []);
  const bbox = shape.box ? shape.box.map((v) => v.toFixed(2)).join(",") : null;
  const raw = useApi(
    bbox
      ? (signal) => liveApi.getDetections({ bbox, sensor: "VIIRS", limit: 50_000 }, { signal })
      : null,
    [bbox, tick],
  );
  const status = useApi((signal) => systemApi.getStatus({ signal }), [tick]);
  // A refresh keeps the dots on screen (dimmed) until the new ones arrive.
  const kept = useKeep(raw, areaKey(area));

  const now = useMemo(() => Date.now(), [kept.data]);
  const detections = useMemo(() => {
    const all = (kept.data?.features ?? []).filter((d) => d.properties.sensor === "VIIRS");
    const { keys, grid } = shape;
    if (!keys || grid === null) return all;
    return all.filter((d) => {
      const [lon, lat] = d.geometry.coordinates as [number, number];
      return keys.has(cellKey(lat, lon, grid));
    });
  }, [kept.data, shape]);
  const newest = [...detections].sort((a, b) =>
    b.properties.time.localeCompare(a.properties.time),
  );

  const error = shape.error ?? raw.error;
  const firstLoad = !kept.data && !error;
  const updated = status.data?.live?.updated_at ?? null;

  return (
    <>
      <LiveKpis
        detections={detections}
        newest={newest}
        now={now}
        loading={firstLoad}
        error={error}
      />
      <section className="panel hw-map-panel">
        <PanelTitle
          title="Where VIIRS sees fire"
          subtitle={`${areaLabel(area)} · VIIRS detections of the last 48 hours${updated ? `, updated ${clock(updated)} UTC` : ""}. Each dot is one 375 m pixel that VIIRS flags as hot: not a count of fires, not burned area.`}
        >
          <button
            className="hw-button"
            onClick={() => setTick((t) => t + 1)}
            disabled={raw.status === "loading"}
          >
            Refresh
          </button>
        </PanelTitle>
        {error ? (
          <PanelState error={error} />
        ) : (
          <>
            <MapHint>
              Drag to move · scroll, double-click or +/− to zoom · ⟲ resets · hover a dot for its
              satellite, time and fire power. The page refreshes every 5 minutes.
            </MapHint>
            <MapStage
              firstLoad={firstLoad}
              refreshing={kept.refreshing}
              loadingLabel="Loading VIIRS detections…"
            >
              <GeoMap
                bounds={shape.box ?? BRAZIL_BOUNDS}
                large
                minSpan={3}
                label={`VIIRS fire detections of the last 48 hours in ${areaLabel(area)}`}
                legend={
                  <MapLegend
                    steps={[
                      ["age1", "6 h or less"],
                      ["age2", "6–24 h"],
                      ["age3", "Over 24 h"],
                    ]}
                    note={
                      firstLoad
                        ? "Loading VIIRS detections…"
                        : `Age of each detection. ${detections.length.toLocaleString("en-US")} VIIRS detections${shape.grid !== null ? ` in the area's ${shape.grid}° cells` : " in the box"}.`
                    }
                  />
                }
              >
                {kept.data && (
                  <g className="geo-fade-in" key={`${areaKey(area)}${updated ?? ""}`}>
                    <DetectionsLayer detections={detections} now={now} describe={describe} />
                  </g>
                )}
              </GeoMap>
            </MapStage>
          </>
        )}
      </section>
      <NewestTable newest={newest} loading={firstLoad} error={error} />
    </>
  );
}

function LiveKpis({
  detections,
  newest,
  now,
  loading,
  error,
}: {
  detections: Detection[];
  newest: Detection[];
  now: number;
  loading: boolean;
  error: Error | null;
}) {
  const state = error
    ? ({ status: "error", data: null, error } as const)
    : loading
      ? ({ status: "loading", data: null, error: null } as const)
      : undefined;
  const recent = detections.filter((d) => ageClass(d.properties.time, now) === 1).length;
  const latest = newest[0];
  const latestPass = latest ? newest.filter((d) => d.properties.time === latest.properties.time) : [];
  const strongest = detections.reduce<Detection | null>(
    (best, d) =>
      (d.properties.frp_mw ?? -1) > (best?.properties.frp_mw ?? -1) ? d : best,
    null,
  );
  const bySat = new Map<string, number>();
  for (const d of detections) bySat.set(satelliteName(d), (bySat.get(satelliteName(d)) ?? 0) + 1);
  const night = detections.filter((d) => d.properties.daynight === "N").length;
  return (
    <div className="hw-kpis">
      <Card title="VIIRS detections" state={state}>
        <strong className="hw-big">{detections.length.toLocaleString("en-US")}</strong>
        <small>
          375 m pixels flagged as hot in the last 48 hours · {recent.toLocaleString("en-US")} in
          the last 6 hours
        </small>
      </Card>
      <Card title="Latest pass" state={state}>
        {latest ? (
          <>
            <strong className="hw-big">{latest.properties.time.slice(11, 16)} UTC</strong>
            <small>
              {satelliteName(latest)} · {latestPass.length.toLocaleString("en-US")} detections on{" "}
              {clock(latest.properties.time).slice(0, 5)}
            </small>
          </>
        ) : (
          <small>VIIRS sees no fire in this area now.</small>
        )}
      </Card>
      <Card title="Strongest fire power" state={state}>
        {strongest && strongest.properties.frp_mw != null ? (
          <>
            <strong className="hw-big">{frp(strongest)}</strong>
            <small>
              {place(strongest)} · {satelliteName(strongest)} · {clock(strongest.properties.time)}{" "}
              UTC
            </small>
          </>
        ) : (
          <small>No fire radiative power to show.</small>
        )}
      </Card>
      <Card title="Satellites" state={state}>
        <strong className="hw-big">{bySat.size || "—"}</strong>
        <small>
          {[...bySat.entries()]
            .sort((a, b) => b[1] - a[1])
            .map(([s, n]) => `${s} ${n.toLocaleString("en-US")}`)
            .join(" · ") || "No VIIRS satellite sees fire here now"}
          {detections.length > 0 &&
            ` · ${(detections.length - night).toLocaleString("en-US")} by day, ${night.toLocaleString("en-US")} by night`}
        </small>
      </Card>
    </div>
  );
}

function NewestTable({
  newest,
  loading,
  error,
}: {
  newest: Detection[];
  loading: boolean;
  error: Error | null;
}) {
  return (
    <section className="panel hw-live-panel">
      <PanelTitle
        title="Newest VIIRS detections"
        subtitle="The 12 most recent pixels in the area, newest first. FRP is the fire radiative power VIIRS measures in the pixel."
      />
      {error ? (
        <PanelState error={error} />
      ) : loading ? (
        <PanelState />
      ) : newest.length === 0 ? (
        <PanelState error={new Error("VIIRS sees no fire in this area now.")} />
      ) : (
        <div className="hw-table-wrap">
          <table className="hw-table">
            <thead>
              <tr>
                <th>Time (UTC)</th>
                <th>Location</th>
                <th>Satellite</th>
                <th>FRP</th>
                <th>Day or night</th>
                <th>Pixel (scan × track)</th>
              </tr>
            </thead>
            <tbody>
              {newest.slice(0, 12).map((d) => {
                const p = d.properties;
                return (
                  <tr key={d.id}>
                    <td>{clock(p.time)}</td>
                    <td>{place(d)}</td>
                    <td>{satelliteName(d)}</td>
                    <td>{frp(d)}</td>
                    <td>{p.daynight === "N" ? "Night" : p.daynight === "D" ? "Day" : "—"}</td>
                    <td>
                      {p.scan_km != null && p.track_km != null
                        ? `${p.scan_km.toFixed(2)} × ${p.track_km.toFixed(2)} km`
                        : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
