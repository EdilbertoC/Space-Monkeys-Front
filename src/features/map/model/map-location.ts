import type { SensorId, SensorObservation } from "../../sensors/sensors.ts";

const REGION_CENTERS: Record<string, readonly [number, number]> = {
  Global: [500, 225],
  "South America": [337, 300],
  "North America": [220, 140],
  Africa: [555, 270],
  Europe: [535, 120],
  Asia: [780, 150],
  Oceania: [890, 340],
};

export function mapCenterForRegion(region: string): readonly [number, number] {
  return REGION_CENTERS[region] ?? REGION_CENTERS.Global;
}

export interface MapLocationSelection {
  region: string;
  sensor: SensorId;
  markerIndex: number;
  /** Existing projected demo coordinates, NOT georeferenced acquisition coordinates. */
  mapPosition: { x: number; y: number };
  observation: SensorObservation;
}

/** Preserve the original spatial demo record; do not infer country, acquisition time,
 * confidence, anomaly scores, FRP, or a scientific alert from a marker's position. */
export function describeMapMarker(
  marker: readonly (string | number)[],
  index: number,
): MapLocationSelection {
  const sensor: SensorId = marker[2] === 0 ? "MODIS" : "VIIRS";
  return {
    region: String(marker[4]),
    sensor,
    markerIndex: index,
    mapPosition: { x: Number(marker[0]), y: Number(marker[1]) },
    observation: {
      id: `demo-map-${index}`,
      sensor,
      observedAt: null,
      satellite: null,
      confidence: null,
      illustrative: true,
      original: marker,
    },
  };
}

/** Uses the existing map's pan/zoom transform to center an existing marker.
 * This is viewport navigation only, not a geographic or fire-risk calculation. */
export function panToMapPosition(
  position: { x: number; y: number },
  center: readonly [number, number],
  scale: number,
) {
  return { x: (center[0] - position.x) * scale, y: (center[1] - position.y) * scale };
}

/** Prefer a less crowded adjacent quadrant, keeping map controls and legend clear. */
export function placeHotspotTooltip(
  anchor: { x: number; y: number },
  canvas: { width: number; height: number },
  nearby: { x: number; y: number }[],
) {
  const width = Math.min(272, canvas.width - 24);
  const height = 246;
  const clampX = (x: number) => Math.max(12, Math.min(canvas.width - width - 54, x));
  const clampY = (y: number) => Math.max(56, Math.min(canvas.height - height - 54, y));
  const candidates = [
    { x: anchor.x + 16, y: anchor.y - height - 12 },
    { x: anchor.x - width - 16, y: anchor.y - height - 12 },
    { x: anchor.x + 16, y: anchor.y + 12 },
    { x: anchor.x - width - 16, y: anchor.y + 12 },
    { x: anchor.x - width / 2, y: anchor.y - height - 16 },
    { x: anchor.x - width / 2, y: anchor.y + 16 },
  ].map((p) => ({ left: clampX(p.x), top: clampY(p.y) }));
  const score = (p: (typeof candidates)[number]) => {
    const contains = (point: { x: number; y: number }) =>
      point.x > p.left - 4 &&
      point.x < p.left + width + 4 &&
      point.y > p.top - 4 &&
      point.y < p.top + height + 4;
    return (
      (contains(anchor) ? 100000 : 0) +
      nearby.filter(contains).length * 100 +
      Math.hypot(anchor.x - (p.left + width / 2), anchor.y - (p.top + height / 2)) / 100
    );
  };
  return candidates.sort((a, b) => score(a) - score(b))[0];
}
