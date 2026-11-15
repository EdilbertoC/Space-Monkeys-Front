import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { GLOBAL_REGIONS } from "../../../shared/constants/geography";
import SelectControl from "../../../shared/ui/SelectControl";
import { Dot, format, Icon, PanelTitle } from "../../../shared/ui/ui";
import { getObservation } from "../../history/demo/demo-data";
import { selectionLabel, type AreaSelection } from "../../history/demo/exploration";
import { markerScenario } from "../../history/demo/priority-scenarios";
import { SensorDot, useSensorLayers } from "../../sensors/SensorControls";
import {
  hasDemoData,
  matchesSensor,
  SENSOR_IDS,
  SENSOR_METADATA,
  sensorLabel,
  unavailableMessage,
  type SensorId,
  type SensorSelection,
} from "../../sensors/sensors";
import mapData from "../demo/map-data.json";
import {
  describeMapMarker,
  mapCenterForRegion,
  panToMapPosition,
  placeHotspotTooltip,
  type MapLocationSelection,
} from "../model/map-location";
import HotspotTooltip from "./HotspotTooltip";
import MapAreaSelection, { type AreaTool } from "./MapAreaSelection";
import MapLocationDialog from "./MapLocationDialog";
export type MapViewRequest = { id: string; center: { x: number; y: number }; zoom: number };
export default function FireMap({
  region,
  setRegion,
  period,
  large = false,
  units,
  sensorFilter,
  areaSelection,
  anomalyPreview = false,
  initialAreaTool = "Pan",
  focusRequest,
}: {
  region: string;
  setRegion: (s: string) => void;
  period: string;
  large?: boolean;
  units: string;
  sensorFilter: SensorSelection;
  areaSelection?: { value: AreaSelection | null; onChange: (area: AreaSelection | null) => void };
  anomalyPreview?: boolean;
  initialAreaTool?: AreaTool;
  focusRequest?: MapViewRequest | null;
}) {
  const [areaTool, setAreaTool] = useState<AreaTool>(initialAreaTool);
  useEffect(() => setAreaTool(initialAreaTool), [initialAreaTool]);
  const mapObservation = useMemo(
    () => getObservation(period, 1, sensorFilter),
    [period, sensorFilter],
  );
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const { sensors, setSensors } = useSensorLayers();
  const [selected, setSelected] = useState<MapLocationSelection | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [focusedMarkerIndex, setFocusedMarkerIndex] = useState<number | null>(null);
  const [tooltip, setTooltip] = useState<{
    index: number;
    left: number;
    top: number;
  } | null>(null);
  const showTooltip = (element: SVGGElement, index: number) => {
    const canvas = element.closest(".map-canvas")!.getBoundingClientRect();
    const bounds = element.getBoundingClientRect();
    const matrix = element.getScreenCTM();
    const nearby = matrix
      ? visibleMarkerIndices.map((i) => {
          const marker = mapData.markers[i];
          return {
            x: matrix.a * Number(marker[0]) + matrix.c * Number(marker[1]) + matrix.e - canvas.left,
            y: matrix.b * Number(marker[0]) + matrix.d * Number(marker[1]) + matrix.f - canvas.top,
          };
        })
      : [];
    const position = placeHotspotTooltip(
      {
        x: bounds.left + bounds.width / 2 - canvas.left,
        y: bounds.top + bounds.height / 2 - canvas.top,
      },
      canvas,
      nearby,
    );
    setTooltip({ index, ...position });
  };
  const [showGrid, setShowGrid] = useState(true);
  const [layerMenu, setLayerMenu] = useState(false);
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    setZoom(anomalyPreview && region === "South America" ? 2 : 1);
    setPan({ x: 0, y: 0 });
    setSelected(null);
    setDetailsOpen(false);
    setFocusedMarkerIndex(null);
  }, [region, anomalyPreview]);
  useEffect(() => {
    if (!focusRequest) return;
    const center = mapCenterForRegion(region);
    setZoom(focusRequest.zoom);
    setPan(
      panToMapPosition(
        focusRequest.center,
        center,
        focusRequest.zoom * (region === "Global" ? 1 : 1.7),
      ),
    );
    setAreaTool("Polygon");
    setSelected(null);
    setDetailsOpen(false);
  }, [focusRequest, region]);
  useEffect(() => {
    setSelected(null);
    setDetailsOpen(false);
    setFocusedMarkerIndex(null);
  }, [period, sensorFilter]);
  useEffect(() => setTooltip(null), [region, period, sensorFilter, zoom, pan, detailsOpen]);
  const center = mapCenterForRegion(region);
  const scale = zoom * (region === "Global" ? 1 : 1.7);
  const visibleMarkerIndices = useMemo(
    () =>
      mapData.markers.flatMap((marker, i) => {
        const sensor = marker[2] === 0 ? "MODIS" : "VIIRS";
        return sensors[sensor] &&
          matchesSensor(sensorFilter, sensor) &&
          (region === "Global" || region === marker[4]) &&
          mapObservation.total > 0 &&
          !(mapObservation.days === 1 && i % 5 === 0) &&
          !(mapObservation.days <= 7 && i % 11 === 0)
          ? [i]
          : [];
      }),
    [sensors, sensorFilter, region, mapObservation.total, mapObservation.days],
  );
  const tabMarkerIndex =
    focusedMarkerIndex !== null && visibleMarkerIndices.includes(focusedMarkerIndex)
      ? focusedMarkerIndex
      : selected && visibleMarkerIndices.includes(selected.markerIndex)
        ? selected.markerIndex
        : visibleMarkerIndices[0];
  const inspectMarker = (index: number) => {
    ref.current
      ?.querySelector<SVGGElement>(`[data-marker-index="${index}"]`)
      ?.focus({ preventScroll: true });
    setSelected(describeMapMarker(mapData.markers[index], index));
    setFocusedMarkerIndex(index);
    setLayerMenu(false);
    setDetailsOpen(true);
  };
  const toggle = (s: SensorId) => {
    setSensors((p) => ({ ...p, [s]: !p[s] }));
    if (selected?.sensor === s) {
      setSelected(null);
      setDetailsOpen(false);
    }
  };
  return (
    <section
      className={`panel map-panel ${large ? "large-map" : ""} ${anomalyPreview ? "map-anomaly-preview" : ""}`}
      ref={ref}
    >
      <PanelTitle
        title={anomalyPreview ? "Geospatial anomaly explorer" : "Global fire activity"}
        subtitle={
          anomalyPreview
            ? "Amazon / Cerrado · illustrative pattern overlay"
            : "Satellite-detected thermal anomalies"
        }
      >
        <span className="subtle-label">
          <Dot color="orange" /> {mapObservation.dateLabel} · {mapObservation.mapLabel}
        </span>
        <span className="heading-divider" />
        <span className="demo-pill">DEMO DATA</span>
      </PanelTitle>
      {areaSelection && (
        <div className="area-toolbar">
          <div className="area-tool-buttons" role="group" aria-label="Map selection tools">
            {(["Pan", "Cell", "Multi-cell", "Rectangle", "Polygon"] as const).map((tool) => (
              <button
                key={tool}
                className={`button secondary ${areaTool === tool ? "selected" : ""}`}
                aria-pressed={areaTool === tool}
                onClick={() => setAreaTool(tool)}
              >
                {tool}
              </button>
            ))}
            <button
              className="button secondary"
              onClick={() => areaSelection.onChange(null)}
              disabled={!areaSelection.value}
            >
              Clear selection
            </button>
          </div>
          <span role="status">
            {selectionLabel(areaSelection.value)} ·{" "}
            {areaTool === "Polygon"
              ? "Click vertices; double-click or Enter to finish"
              : areaTool === "Rectangle"
                ? "Drag across the map to draw"
                : areaTool === "Multi-cell"
                  ? "Click cells to add or remove"
                  : areaTool === "Cell"
                    ? "Click a cell; arrow keys navigate"
                    : "Drag to pan · click a hotspot to inspect"}
          </span>
        </div>
      )}
      <div className="map-canvas">
        <div className="map-topbar">
          {areaSelection ? (
            <div className="map-region">
              <Icon name="globe" size={15} />
              <span>{areaSelection.value ? selectionLabel(areaSelection.value) : region}</span>
            </div>
          ) : (
            <SelectControl
              label="Map region"
              value={region}
              onChange={(name) => {
                setRegion(name);
                setPan({ x: 0, y: 0 });
                setZoom(1);
              }}
            >
              {GLOBAL_REGIONS.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </SelectControl>
          )}
          <button
            className={`map-layer-button ${layerMenu ? "active" : ""}`}
            onClick={() => setLayerMenu(!layerMenu)}
          >
            <Icon name="layers" size={15} /> Layers
          </button>
        </div>
        {layerMenu && (
          <div className="layer-menu">
            <strong>Map layers</strong>
            <label>
              <input
                type="checkbox"
                checked={showGrid}
                onChange={(e) => setShowGrid(e.target.checked)}
              />{" "}
              Coordinate grid
            </label>
            {SENSOR_IDS.map((s) => (
              <label key={s}>
                <input type="checkbox" checked={sensors[s]} onChange={() => toggle(s)} />{" "}
                {SENSOR_METADATA[s].label}{" "}
                {SENSOR_METADATA[s].tier === "extended" ? "· planned / no data" : "demo detections"}
              </label>
            ))}
          </div>
        )}
        <svg
          className="world-map"
          viewBox="0 0 1000 450"
          role="group"
          aria-label={`Illustrative wildfire detections in ${region}. Drag to pan and use the controls to zoom. Focus a marker and press Enter for location details; arrow keys move between markers.`}
          onPointerDown={(e) => {
            if ((e.target as Element).tagName === "circle") return;
            drag.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y };
            e.currentTarget.setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => {
            if (drag.current) {
              const f = 1000 / e.currentTarget.getBoundingClientRect().width;
              setPan({
                x: drag.current.px + (e.clientX - drag.current.x) * f,
                y: drag.current.py + (e.clientY - drag.current.y) * f,
              });
            }
          }}
          onPointerUp={() => {
            drag.current = null;
          }}
          onPointerCancel={() => {
            drag.current = null;
          }}
        >
          <defs>
            <radialGradient id="mapOcean">
              <stop offset="0" stopColor="#182631" />
              <stop offset="1" stopColor="#14212b" />
            </radialGradient>
            <filter id="hotGlow" x="-100%" y="-100%" width="300%" height="300%">
              <feGaussianBlur stdDeviation="2" />
            </filter>
          </defs>
          <rect width="1000" height="450" fill="url(#mapOcean)" />
          <g
            transform={`translate(${500 - center[0] * scale + pan.x} ${225 - center[1] * scale + pan.y}) scale(${scale})`}
          >
            {showGrid && (
              <g stroke="#344552" strokeWidth=".6" opacity=".4" strokeDasharray="2 5">
                {Array.from({ length: 13 }, (_, i) => (
                  <line key={`v${i}`} x1={i * 83.33} x2={i * 83.33} y1="0" y2="450" />
                ))}
                {Array.from({ length: 7 }, (_, i) => (
                  <line key={`h${i}`} x1="0" x2="1000" y1={i * 75} y2={i * 75} />
                ))}
              </g>
            )}
            <image href="/world-map.svg" width="1000" height="450" />
            <g className="map-labels" textAnchor="middle">
              <text x="220" y="146">
                NORTH AMERICA
              </text>
              <text x="344" y="313">
                SOUTH AMERICA
              </text>
              <text x="534" y="132">
                EUROPE
              </text>
              <text x="551" y="255">
                AFRICA
              </text>
              <text x="755" y="144">
                ASIA
              </text>
              <text x="885" y="355">
                AUSTRALIA
              </text>
              <text className="ocean-label" x="412" y="227">
                ATLANTIC OCEAN
              </text>
              <text className="ocean-label" x="120" y="300">
                PACIFIC OCEAN
              </text>
              <text className="ocean-label" x="725" y="345">
                INDIAN OCEAN
              </text>
            </g>
            {anomalyPreview && region === "South America" && (
              <g className="scenario-biome-labels" textAnchor="middle" pointerEvents="none">
                <text x="342" y="260">
                  AMAZON
                </text>
                <text x="357" y="312">
                  CERRADO
                </text>
              </g>
            )}
            <g>
              {mapData.markers.map(([x, y, sensor, radius, r], i) => {
                const s = sensor === 0 ? "MODIS" : "VIIRS";
                const scenario = anomalyPreview ? markerScenario(i, period) : undefined;
                const critical = scenario?.status === "CRITICAL";
                const color = anomalyPreview
                  ? critical
                    ? "#ef4444"
                    : "#f4b84e"
                  : SENSOR_METADATA[s].color;
                if (
                  !sensors[s] ||
                  !matchesSensor(sensorFilter, s) ||
                  (region !== "Global" && region !== r)
                )
                  return null;
                if (!mapObservation.total) return null;
                if (mapObservation.days === 1 && i % 5 === 0) return null;
                if (mapObservation.days <= 7 && i % 11 === 0) return null;
                return (
                  <g
                    key={i}
                    className={`hotspot ${selected?.markerIndex === i ? "is-selected" : ""} ${critical ? "hotspot-scenario-critical" : ""}`}
                    data-sensor={s}
                    data-marker-index={i}
                    style={{ "--hotspot-color": color } as CSSProperties}
                    role="button"
                    tabIndex={i === tabMarkerIndex ? 0 : -1}
                    aria-label={`Inspect ${sensorLabel(s)} illustrative hotspot in ${String(r)}${anomalyPreview ? (critical ? " · historical anomaly scenario, not an operational alert" : " · expected seasonal burning scenario, not a validated classification") : ""}`}
                    aria-haspopup="dialog"
                    aria-pressed={selected?.markerIndex === i}
                    aria-describedby={
                      tooltip?.index === i ? "hotspot-observation-tooltip" : undefined
                    }
                    onPointerDown={(e) => e.stopPropagation()}
                    onPointerEnter={(e) => showTooltip(e.currentTarget, i)}
                    onPointerLeave={() => setTooltip(null)}
                    onFocus={(e) => {
                      setFocusedMarkerIndex(i);
                      showTooltip(e.currentTarget, i);
                    }}
                    onBlur={() => setTooltip(null)}
                    onClick={() => inspectMarker(i)}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") {
                        setTooltip(null);
                        return;
                      }
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        inspectMarker(i);
                        return;
                      }
                      const steps: Record<string, number> = {
                        ArrowLeft: -1,
                        ArrowUp: -1,
                        ArrowRight: 1,
                        ArrowDown: 1,
                      };
                      const current = visibleMarkerIndices.indexOf(i);
                      const next =
                        e.key === "Home"
                          ? 0
                          : e.key === "End"
                            ? visibleMarkerIndices.length - 1
                            : e.key in steps
                              ? Math.max(
                                  0,
                                  Math.min(visibleMarkerIndices.length - 1, current + steps[e.key]),
                                )
                              : null;
                      if (next !== null) {
                        e.preventDefault();
                        const index = visibleMarkerIndices[next];
                        setPan(
                          panToMapPosition(
                            {
                              x: Number(mapData.markers[index][0]),
                              y: Number(mapData.markers[index][1]),
                            },
                            center,
                            scale,
                          ),
                        );
                        setFocusedMarkerIndex(index);
                        requestAnimationFrame(() =>
                          ref.current
                            ?.querySelector<SVGGElement>(`[data-marker-index="${index}"]`)
                            ?.focus(),
                        );
                      }
                    }}
                  >
                    <circle
                      className="hotspot-hit-target"
                      cx={Number(x)}
                      cy={Number(y)}
                      r={3 / scale}
                      fill="transparent"
                      stroke="transparent"
                      strokeWidth="14"
                      vectorEffect="non-scaling-stroke"
                    />
                    <circle
                      className="hotspot-selection-ring"
                      cx={Number(x)}
                      cy={Number(y)}
                      r={7 / scale}
                      vectorEffect="non-scaling-stroke"
                    />
                    <circle
                      className="hotspot-glow"
                      cx={Number(x)}
                      cy={Number(y)}
                      r={Number(radius) * 2.4}
                      fill={color}
                      opacity=".14"
                      filter="url(#hotGlow)"
                    />
                    {critical && (
                      <circle
                        className="scenario-anomaly-pulse"
                        cx={Number(x)}
                        cy={Number(y)}
                        r={9 / scale}
                        fill="none"
                        stroke="#ef4444"
                        strokeWidth="1.3"
                        vectorEffect="non-scaling-stroke"
                      />
                    )}
                    <circle
                      className="hotspot-core"
                      vectorEffect="non-scaling-stroke"
                      cx={Number(x)}
                      cy={Number(y)}
                      r={
                        (critical ? Math.max(2.6, Number(radius)) : Number(radius)) /
                        Math.sqrt(scale)
                      }
                      fill={color}
                      opacity={0.7 + (i % 3) * 0.13}
                    />
                  </g>
                );
              })}
            </g>
            {areaSelection && (
              <MapAreaSelection
                key={areaTool}
                tool={areaTool}
                value={areaSelection.value}
                onChange={areaSelection.onChange}
                initialCursor={{
                  x: Math.max(0, Math.min(1000, center[0] - pan.x / scale)),
                  y: Math.max(0, Math.min(450, center[1] - pan.y / scale)),
                }}
              />
            )}
          </g>
        </svg>
        {tooltip && !detailsOpen && visibleMarkerIndices.includes(tooltip.index) && (
          <HotspotTooltip
            location={describeMapMarker(mapData.markers[tooltip.index], tooltip.index)}
            position={tooltip}
            classification={
              anomalyPreview
                ? markerScenario(tooltip.index, period)?.status === "CRITICAL"
                  ? "anomaly"
                  : "seasonal"
                : undefined
            }
          />
        )}
        {anomalyPreview && (
          <aside className="scenario-map-legend" aria-label="Illustrative anomaly layer legend">
            <strong>
              <Icon name="layers" size={13} />
              PATTERN LAYERS <span>DEMO</span>
            </strong>
            <span>
              <i className="seasonal-key" />
              Expected seasonal burning
            </span>
            <span>
              <i className="critical-key" />
              Historical anomaly scenario
            </span>
            <p className="scenario-grid-key">1 km MODIS grid + 375 m VIIRS detections</p>
            <details>
              <summary>Calibration status</summary>
              <p>
                Calibration workflow preview only; no validated MODIS–VIIRS calibration is
                connected.
              </p>
            </details>
            <small>
              Colors indicate UI scenarios, not scientific classification. Sensor identity remains
              in each observation.
            </small>
          </aside>
        )}
        {(!hasDemoData(sensorFilter) ||
          !mapObservation.hasObservations ||
          !(
            (sensors.MODIS && matchesSensor(sensorFilter, "MODIS")) ||
            (sensors.VIIRS && matchesSensor(sensorFilter, "VIIRS"))
          )) && (
          <div className="map-source-note">
            {!hasDemoData(sensorFilter)
              ? unavailableMessage(sensorFilter)
              : !mapObservation.hasObservations
                ? "No demo observations are available for the selected sensor and date window. Missing observations are not zero activity."
                : "No available demo layers are enabled. Sentinel-3 SLSTR and GOES ABI remain planned with no observations loaded."}
          </div>
        )}
        <div className="map-coordinates">
          85° N <span>180° W</span>
        </div>
        <div className="map-controls">
          <button
            aria-label="Zoom in"
            onClick={() => setZoom((v) => Math.min(5, v + 0.4))}
            disabled={zoom >= 5}
          >
            <Icon name="plus" />
          </button>
          <button
            aria-label="Zoom out"
            onClick={() => setZoom((v) => Math.max(1, v - 0.4))}
            disabled={zoom <= 1}
          >
            <Icon name="minus" />
          </button>
          <span />
          <button
            aria-label="Reset map view"
            onClick={() => {
              setZoom(1);
              setPan({ x: 0, y: 0 });
              setRegion("Global");
              setSelected(null);
              setDetailsOpen(false);
              setFocusedMarkerIndex(null);
              areaSelection?.onChange(null);
            }}
          >
            <Icon name="target" />
          </button>
          <button
            aria-label="Toggle fullscreen map"
            onClick={() => {
              if (document.fullscreenElement) document.exitFullscreen();
              else ref.current?.requestFullscreen();
            }}
          >
            <Icon name="expand" size={16} />
          </button>
        </div>
        {selected && detailsOpen && visibleMarkerIndices.includes(selected.markerIndex) && (
          <MapLocationDialog
            location={selected}
            observationWindow={mapObservation.dateLabel}
            container={document.fullscreenElement ?? document.body}
            onClose={() => setDetailsOpen(false)}
            onFocusLocation={() => {
              const nextZoom = Math.max(zoom, 2);
              setZoom(nextZoom);
              setPan(
                panToMapPosition(
                  selected.mapPosition,
                  center,
                  nextZoom * (region === "Global" ? 1 : 1.7),
                ),
              );
              setDetailsOpen(false);
            }}
            onExploreRegion={() => {
              setRegion(selected.region);
              setDetailsOpen(false);
              setSelected(null);
            }}
          />
        )}
        <div className="map-bottom">
          <div className="map-legend">
            {SENSOR_IDS.map((s) => (
              <button
                key={s}
                className={!sensors[s] ? "muted-sensor" : ""}
                onClick={() => toggle(s)}
                aria-pressed={sensors[s]}
              >
                <SensorDot sensor={s} />
                {SENSOR_METADATA[s].label}
                <span>
                  {SENSOR_METADATA[s].tier === "extended"
                    ? "Planned · no data"
                    : SENSOR_METADATA[s].resolution}
                </span>
              </button>
            ))}
          </div>
          <span className="map-credit">Natural Earth · Illustrative detections</span>
        </div>
      </div>
      <div className="map-footer">
        <span>
          <Icon name="info" size={13} /> Illustrative spatial sample, not one marker per detection.
          Thermal anomalies are not confirmed wildfire boundaries.
        </span>
        <span className="map-scale">
          <i />{" "}
          {units === "Metric (km)" ? `${format(2000 / scale)} km` : `${format(1243 / scale)} mi`}
        </span>
      </div>
    </section>
  );
}
