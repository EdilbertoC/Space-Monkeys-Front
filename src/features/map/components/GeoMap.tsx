// SI-assisted: written with Claude (Anthropic), reviewed by the Space Monkeys team. See README.
// Georeferenced map: real lon/lat projected onto the Natural Earth basemap. Layers are
// API data only: historical fire cell-days (/history/map), live fused fires (/fires/live)
// and the 7-day forecast (/forecast). Nothing is placed at a made-up position.
import "../styles/geo-map.css";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type PointerEvent,
  type ReactNode,
} from "react";
import type { Schemas, Series } from "../../../shared/api/types";
import {
  BRAZIL_BOUNDS,
  cellSize,
  latToY,
  lonToX,
  MAP_HEIGHT,
  MAP_WIDTH,
  viewBoxFor,
  xToLon,
  yToLat,
  type Bounds,
} from "../../../shared/geo/projection";

type HistoryCell = Schemas["Map"]["cells"][number];
type FireFeature = Schemas["FireFeature"];
type ForecastCell = Schemas["Forecast"]["cells"][number];

const BASEMAP = `${import.meta.env.BASE_URL}world-map.svg`;

// The basemap outlines are drawn inline (not as <image>) so borders can use
// non-scaling-stroke and keep the same screen width at any zoom. Fetched once per page load.
let basemapPaths: Promise<string[]> | null = null;
function loadBasemapPaths() {
  basemapPaths ??= fetch(BASEMAP)
    .then((r) => (r.ok ? r.text() : Promise.reject(new Error(`basemap ${r.status}`))))
    .then((text) =>
      [...new DOMParser().parseFromString(text, "image/svg+xml").querySelectorAll("path")]
        .map((p) => p.getAttribute("d") ?? "")
        .filter(Boolean),
    )
    .catch((err) => {
      basemapPaths = null; // let a later mount retry
      throw err;
    });
  return basemapPaths;
}

function useBasemapPaths() {
  const [paths, setPaths] = useState<string[] | null>(null);
  useEffect(() => {
    let alive = true;
    loadBasemapPaths().then(
      (p) => alive && setPaths(p),
      () => {}, // keep the <image> fallback
    );
    return () => {
      alive = false;
    };
  }, []);
  return paths;
}

export function GeoMap({
  bounds = BRAZIL_BOUNDS,
  label,
  children,
  legend,
  large = false,
  drawing = false,
  onBoxDrawn,
  selection = null,
  minSpan = 16,
}: {
  bounds?: Bounds;
  label: string;
  children?: ReactNode;
  legend?: ReactNode;
  large?: boolean;
  /** While true, dragging draws a lon/lat box (reported through onBoxDrawn) instead of panning. */
  drawing?: boolean;
  onBoxDrawn?: (box: Bounds) => void;
  /** Outline of the area being analysed. */
  selection?: Bounds | null;
  /** Smallest span in degrees the initial view shows, so small areas keep some surroundings. */
  minSpan?: number;
}) {
  const [sketch, setSketch] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(
    null,
  );
  const base = viewBoxFor(bounds, undefined, minSpan);
  const baseKey = `${base.x},${base.y},${base.width},${base.height}`;
  const [view, setView] = useState<ViewBox>(base);
  const [dragging, setDragging] = useState(false);
  const land = useBasemapPaths();
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<{ x: number; y: number; view: ViewBox; unitsPerPx: number } | null>(null);
  const viewRef = useRef(view);
  viewRef.current = view;

  // A new area or period resets the view to fit it.
  useEffect(() => setView(base), [baseKey]);

  /** Zoom by `factor` (>1 zooms in) keeping the map point under (cx, cy) fixed. */
  const zoomAt = useCallback(
    (factor: number, cx?: number, cy?: number) => {
      setView((v) => {
        const width = clamp(v.width / factor, base.width / MAX_ZOOM, base.width / MIN_ZOOM);
        const f = v.width / width;
        const px = cx ?? v.x + v.width / 2;
        const py = cy ?? v.y + v.height / 2;
        return {
          x: px - (px - v.x) / f,
          y: py - (py - v.y) / f,
          width,
          height: v.height / f,
        };
      });
    },
    [base.width],
  );

  // Wheel zoom needs a non-passive listener to stop the page from scrolling.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const p = toMap(svg, e.clientX, e.clientY);
      zoomAt(e.deltaY < 0 ? WHEEL_STEP : 1 / WHEEL_STEP, p?.x, p?.y);
    };
    svg.addEventListener("wheel", onWheel, { passive: false });
    return () => svg.removeEventListener("wheel", onWheel);
  }, [zoomAt]);

  const onPointerDown = (e: PointerEvent<SVGSVGElement>) => {
    if (e.button !== 0) return;
    const ctm = e.currentTarget.getScreenCTM();
    if (!ctm) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    if (drawing) {
      const p = toMap(e.currentTarget, e.clientX, e.clientY);
      if (p) setSketch({ x0: p.x, y0: p.y, x1: p.x, y1: p.y });
      return;
    }
    drag.current = { x: e.clientX, y: e.clientY, view: viewRef.current, unitsPerPx: 1 / ctm.a };
    setDragging(true);
  };
  const onPointerMove = (e: PointerEvent<SVGSVGElement>) => {
    if (sketch) {
      const p = toMap(e.currentTarget, e.clientX, e.clientY);
      if (p) setSketch({ ...sketch, x1: p.x, y1: p.y });
      return;
    }
    const d = drag.current;
    if (!d) return;
    setView({
      ...d.view,
      x: d.view.x - (e.clientX - d.x) * d.unitsPerPx,
      y: d.view.y - (e.clientY - d.y) * d.unitsPerPx,
    });
  };
  const endDrag = () => {
    if (sketch) {
      // Snap outward to the 0.1° grid of the record; ignore clicks and tiny drags.
      const snap = (v: number, up: boolean) => (up ? Math.ceil(v * 10) : Math.floor(v * 10)) / 10;
      const west = snap(xToLon(Math.min(sketch.x0, sketch.x1)), false);
      const east = snap(xToLon(Math.max(sketch.x0, sketch.x1)), true);
      const south = snap(yToLat(Math.max(sketch.y0, sketch.y1)), false);
      const north = snap(yToLat(Math.min(sketch.y0, sketch.y1)), true);
      setSketch(null);
      if (east - west >= 0.2 && north - south >= 0.2) onBoxDrawn?.([west, south, east, north]);
      return;
    }
    drag.current = null;
    setDragging(false);
  };

  // Track the element size so the viewBox matches its aspect ratio (no letterbox bands).
  const [size, setSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry!.contentRect;
      setSize((s) => (s.w === width && s.h === height ? s : { w: width, h: height }));
    });
    ro.observe(svg);
    return () => ro.disconnect();
  }, []);
  const shown = fitAspect(view, size.w, size.h);
  const px = size.w > 0 ? shown.width / size.w : shown.width / 800;

  const zoom = base.width / view.width;
  return (
    <div className={`geo-map ${large ? "large" : ""}`}>
      <svg
        ref={svgRef}
        className={drawing ? "drawing" : dragging ? "dragging" : ""}
        viewBox={`${shown.x} ${shown.y} ${shown.width} ${shown.height}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label={label}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onDoubleClick={(e) => {
          if (drawing) return;
          const p = toMap(e.currentTarget, e.clientX, e.clientY);
          zoomAt(BUTTON_STEP, p?.x, p?.y);
        }}
      >
        <rect
          className="geo-sea"
          x={-MAP_WIDTH}
          y={-MAP_HEIGHT}
          width={MAP_WIDTH * 3}
          height={MAP_HEIGHT * 3}
        />
        {land ? (
          <g className="geo-land">
            {land.map((d, i) => (
              <path key={i} d={d} />
            ))}
          </g>
        ) : (
          <image href={BASEMAP} x={0} y={0} width={MAP_WIDTH} height={MAP_HEIGHT} />
        )}
        <GeoGraticule vb={shown} px={px} />
        <MapPixel.Provider value={px}>{children}</MapPixel.Provider>
        {selection && (
          <rect
            className="geo-selection"
            x={lonToX(selection[0])}
            y={latToY(selection[3])}
            width={lonToX(selection[2]) - lonToX(selection[0])}
            height={latToY(selection[1]) - latToY(selection[3])}
          />
        )}
        {sketch && (
          <rect
            className="geo-sketch"
            x={Math.min(sketch.x0, sketch.x1)}
            y={Math.min(sketch.y0, sketch.y1)}
            width={Math.abs(sketch.x1 - sketch.x0)}
            height={Math.abs(sketch.y1 - sketch.y0)}
          />
        )}
      </svg>
      <div className="geo-zoom" role="group" aria-label="Map zoom">
        <button
          type="button"
          aria-label="Zoom in"
          title="Zoom in"
          disabled={zoom >= MAX_ZOOM - 1e-6}
          onClick={() => zoomAt(BUTTON_STEP)}
        >
          +
        </button>
        <button
          type="button"
          aria-label="Zoom out"
          title="Zoom out"
          disabled={zoom <= MIN_ZOOM + 1e-6}
          onClick={() => zoomAt(1 / BUTTON_STEP)}
        >
          −
        </button>
        <button
          type="button"
          aria-label="Reset view"
          title="Reset view to the selected area"
          className="geo-zoom-reset"
          onClick={() => setView(base)}
        >
          ⟲
        </button>
      </div>
      {legend && <div className="geo-legend">{legend}</div>}
      <span className="geo-attribution">Basemap: Natural Earth (public domain)</span>
    </div>
  );
}

type ViewBox = { x: number; y: number; width: number; height: number };

/** Map units per screen pixel, for layers that draw fixed-size markers. */
const MapPixel = createContext(0.05);

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 40;
const BUTTON_STEP = 1.6;
const WHEEL_STEP = 1.2;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Screen point → map (viewBox) units, accounting for the letterboxing of "meet". */
function toMap(svg: SVGSVGElement, clientX: number, clientY: number) {
  const ctm = svg.getScreenCTM();
  if (!ctm) return null;
  return new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
}

/** Grow `v` around its centre so it has the aspect ratio of a w × h element (no letterbox). */
function fitAspect(v: ViewBox, w: number, h: number): ViewBox {
  if (w <= 0 || h <= 0) return v;
  const target = w / h;
  const cx = v.x + v.width / 2;
  const cy = v.y + v.height / 2;
  const width = v.width / v.height < target ? v.height * target : v.width;
  const height = width / target;
  return { x: cx - width / 2, y: cy - height / 2, width, height };
}

/** Grid spacing in degrees: the smallest "nice" step that keeps at most ~7 lines across. */
const GRID_STEPS = [0.1, 0.25, 0.5, 1, 2, 5, 10, 20, 30];

function gridStep(spanDegrees: number) {
  return GRID_STEPS.find((s) => spanDegrees / s <= 7) ?? 30;
}

function degreeLabel(value: number, step: number, pos: string, neg: string) {
  const digits = step < 0.5 ? 2 : step < 1 ? 1 : 0;
  return `${Math.abs(value).toFixed(digits)}°${value > 0 ? pos : value < 0 ? neg : ""}`;
}

/**
 * Lon/lat grid for the visible area. The view always matches the element's aspect ratio, so
 * lines run edge to edge; the spacing adapts to the zoom and labels keep a constant size on
 * screen (`px` = map units per screen pixel). Strokes use non-scaling-stroke (see CSS).
 */
function GeoGraticule({ vb, px }: { vb: ViewBox; px: number }) {
  const lonSpan = (vb.width * 360) / MAP_WIDTH;
  const step = gridStep(lonSpan);
  const west = (vb.x * 360) / MAP_WIDTH - 180;
  const east = west + lonSpan;
  const north = 85 - (vb.y * 145) / MAP_HEIGHT;
  const south = north - (vb.height * 145) / MAP_HEIGHT;
  const font = 11 * px;
  const lines: ReactNode[] = [];
  for (let i = Math.ceil(west / step); i * step <= east; i++) {
    const lon = +(i * step).toFixed(4);
    if (lon < -180 || lon > 180) continue;
    const x = lonToX(lon);
    lines.push(
      <g key={`lon${lon}`}>
        <line className="geo-grid" x1={x} x2={x} y1={vb.y} y2={vb.y + vb.height} />
        <text
          className="geo-grid-label"
          fontSize={font}
          x={x + 4 * px}
          y={vb.y + vb.height - 6 * px}
        >
          {degreeLabel(lon, step, "E", "W")}
        </text>
      </g>,
    );
  }
  for (let i = Math.ceil(south / step); i * step <= north; i++) {
    const lat = +(i * step).toFixed(4);
    if (lat < -60 || lat > 85) continue;
    const y = latToY(lat);
    lines.push(
      <g key={`lat${lat}`}>
        <line className="geo-grid" x1={vb.x} x2={vb.x + vb.width} y1={y} y2={y} />
        <text className="geo-grid-label" fontSize={font} x={vb.x + 46 * px} y={y - 4 * px}>
          {degreeLabel(lat, step, "N", "S")}
        </text>
      </g>,
    );
  }
  return <g className="geo-graticule">{lines}</g>;
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

/** Live fires are points, not areas: radius in screen pixels (2.5–5 px by confidence). */
export function LiveFiresLayer({ fires }: { fires: FireFeature[] }) {
  const px = useContext(MapPixel);
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
            r={px * (2.5 + 2.5 * p.confidence)}
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

type Detection = Schemas["DetectionCollection"]["features"][number];

/** Age class of a detection: 1 = 6 hours old or less, 2 = up to 24 hours, 3 = older. */
export function ageClass(time: string, now: number): 1 | 2 | 3 {
  const hours = (now - Date.parse(time)) / 3_600_000;
  return hours <= 6 ? 1 : hours <= 24 ? 2 : 3;
}

/**
 * Raw VIIRS detections as points (one 375 m pixel each), coloured by age and drawn oldest
 * first so the newest stay on top. Radius in screen pixels.
 */
export function DetectionsLayer({
  detections,
  now,
  describe,
}: {
  detections: Detection[];
  now: number;
  describe: (d: Detection) => string;
}) {
  const px = useContext(MapPixel);
  const ordered = [...detections].sort((a, b) =>
    a.properties.time.localeCompare(b.properties.time),
  );
  return (
    <g className="geo-detections">
      {ordered.map((d) => {
        const [lon, lat] = d.geometry.coordinates as [number, number];
        return (
          <circle
            key={d.id}
            className={`geo-det age${ageClass(d.properties.time, now)}`}
            cx={lonToX(lon)}
            cy={latToY(lat)}
            r={px * 3}
          >
            <title>{describe(d)}</title>
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
