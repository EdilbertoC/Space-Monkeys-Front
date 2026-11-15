// SI-assisted: written with Claude (Anthropic), reviewed by the Space Monkeys team. See README.
// Georeferenced map: real lon/lat projected onto the Natural Earth basemap. Layers are
// API data only: historical fire cell-days (/history/map), live fused fires (/fires/live)
// and the 7-day forecast (/forecast). Nothing is placed at a made-up position.
import "../styles/geo-map.css";
import type { ReactNode } from "react";
import type { Schemas, Series } from "../../../shared/api/types";
import {
  BRAZIL_BOUNDS,
  cellSize,
  latToY,
  lonToX,
  MAP_HEIGHT,
  MAP_WIDTH,
  viewBoxFor,
  type Bounds,
} from "../../../shared/geo/projection";

type HistoryCell = Schemas["Map"]["cells"][number];
type FireFeature = Schemas["FireFeature"];
type ForecastCell = Schemas["Forecast"]["cells"][number];

const BASEMAP = `${import.meta.env.BASE_URL}world-map.svg`;

export function GeoMap({
  bounds = BRAZIL_BOUNDS,
  label,
  children,
  legend,
  large = false,
}: {
  bounds?: Bounds;
  label: string;
  children?: ReactNode;
  legend?: ReactNode;
  large?: boolean;
}) {
  const vb = viewBoxFor(bounds);
  return (
    <div className={`geo-map ${large ? "large" : ""}`}>
      <svg
        viewBox={`${vb.x} ${vb.y} ${vb.width} ${vb.height}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label={label}
      >
        <rect className="geo-sea" x={vb.x} y={vb.y} width={vb.width} height={vb.height} />
        <image href={BASEMAP} x={0} y={0} width={MAP_WIDTH} height={MAP_HEIGHT} />
        <GeoGraticule vb={vb} />
        {children}
      </svg>
      {legend && <div className="geo-legend">{legend}</div>}
      <span className="geo-attribution">Basemap: Natural Earth (public domain)</span>
    </div>
  );
}

function GeoGraticule({ vb }: { vb: { x: number; y: number; width: number; height: number } }) {
  const lines: ReactNode[] = [];
  for (let lon = -180; lon <= 180; lon += 10) {
    const x = lonToX(lon);
    if (x < vb.x || x > vb.x + vb.width) continue;
    lines.push(
      <g key={`lon${lon}`}>
        <line
          className="geo-grid"
          strokeWidth={vb.width * 0.0015}
          x1={x}
          x2={x}
          y1={vb.y}
          y2={vb.y + vb.height}
        />
        <text
          className="geo-grid-label"
          fontSize={vb.width * 0.018}
          x={x + vb.width * 0.004}
          y={vb.y + vb.height * 0.97}
        >
          {Math.abs(lon)}°{lon < 0 ? "W" : "E"}
        </text>
      </g>,
    );
  }
  for (let lat = -60; lat <= 80; lat += 10) {
    const y = latToY(lat);
    if (y < vb.y || y > vb.y + vb.height) continue;
    lines.push(
      <g key={`lat${lat}`}>
        <line
          className="geo-grid"
          strokeWidth={vb.width * 0.0015}
          x1={vb.x}
          x2={vb.x + vb.width}
          y1={y}
          y2={y}
        />
        <text
          className="geo-grid-label"
          fontSize={vb.width * 0.018}
          x={vb.x + vb.width * 0.005}
          y={y - vb.height * 0.006}
        >
          {Math.abs(lat)}°{lat < 0 ? "S" : lat > 0 ? "N" : ""}
        </text>
      </g>,
    );
  }
  return <>{lines}</>;
}

/** 0 = none, 1–5 by share of the maximum. */
export function level(value: number, max: number) {
  if (value <= 0 || max <= 0) return 0;
  const r = value / max;
  return r < 0.1 ? 1 : r < 0.25 ? 2 : r < 0.45 ? 3 : r < 0.7 ? 4 : 5;
}

export function HistoryCellsLayer({
  cells,
  series,
  gridDegrees,
}: {
  cells: HistoryCell[];
  series: Series;
  gridDegrees: number;
}) {
  const size = cellSize(gridDegrees);
  const values = cells.map((c) => c[series]);
  const max = Math.max(0, ...values.map((v) => v ?? 0));
  return (
    <g className="geo-cells">
      {cells.map((c, i) => {
        const v = values[i];
        if (v === null || v === undefined || v <= 0) return null;
        return (
          <rect
            key={c.cell_id}
            className={`geo-cell l${level(v, max)}`}
            x={lonToX(c.lon) - size.width / 2}
            y={latToY(c.lat) - size.height / 2}
            width={size.width}
            height={size.height}
          >
            <title>
              {`${c.lat.toFixed(2)}°, ${c.lon.toFixed(2)}° · harmonized ${fmt(c.harmonized)} · MODIS ${fmt(c.modis)} · VIIRS ${fmt(c.viirs)} fire cell-days`}
            </title>
          </rect>
        );
      })}
    </g>
  );
}

export function LiveFiresLayer({ fires, scale }: { fires: FireFeature[]; scale: number }) {
  return (
    <g className="geo-fires">
      {fires.map((f) => {
        const [lon, lat] = f.geometry.coordinates as [number, number];
        const p = f.properties;
        const sensor = p.sensors.length > 1 ? "multi" : (p.sensors[0] ?? "ABI").toLowerCase();
        return (
          <circle
            key={f.id}
            className={`geo-fire ${sensor}`}
            cx={lonToX(lon)}
            cy={latToY(lat)}
            r={scale * (0.6 + 0.6 * p.confidence)}
          >
            <title>
              {`Live fire · ${p.sensors.join(" + ")} · ${p.n_detections} detection${p.n_detections > 1 ? "s" : ""} · last seen ${p.last_seen.slice(0, 16).replace("T", " ")} UTC · confidence ${p.confidence.toFixed(2)} (heuristic)`}
            </title>
          </circle>
        );
      })}
    </g>
  );
}

export function ForecastLayer({
  cells,
  lead,
  resolution,
  date,
}: {
  cells: ForecastCell[];
  lead: number;
  resolution: number;
  date: string;
}) {
  const size = cellSize(resolution);
  return (
    <g className="geo-forecast">
      {cells.map((c) => {
        const p = c.p[lead] ?? 0;
        if (p <= 0) return null;
        const band = p >= 0.5 ? 4 : p >= 0.3 ? 3 : p >= 0.15 ? 2 : p >= 0.05 ? 1 : 0;
        if (!band) return null;
        return (
          <rect
            key={`${c.lat},${c.lon}`}
            className={`geo-fc b${band} ${c.anchored ? "anchored" : ""}`}
            x={lonToX(c.lon) - size.width / 2}
            y={latToY(c.lat) - size.height / 2}
            width={size.width}
            height={size.height}
          >
            <title>
              {`${c.lat.toFixed(2)}°, ${c.lon.toFixed(2)}° · ${date}: P(VIIRS fire) = ${(p * 100).toFixed(0)}%${c.anchored ? " · raised by a live fire" : ""}`}
            </title>
          </rect>
        );
      })}
    </g>
  );
}

const fmt = (v: number | null) =>
  v === null ? "no data" : Number.isInteger(v) ? String(v) : v.toFixed(1);
