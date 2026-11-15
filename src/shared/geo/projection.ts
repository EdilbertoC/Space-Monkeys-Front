// SI-assisted: written with Claude (Anthropic), reviewed by the Space Monkeys team. See README.
// public/world-map.svg is a 1000×450 equirectangular (plate carrée) map cropped to
// 85°N–60°S: x spans 360° of longitude, y spans 145° of latitude.
export const MAP_WIDTH = 1000;
export const MAP_HEIGHT = 450;
const NORTH = 85;
const LAT_SPAN = 145;

export type Bounds = [west: number, south: number, east: number, north: number];

/** Brazil and its neighbourhood, the extent of the historical record and the forecast. */
export const BRAZIL_BOUNDS: Bounds = [-75, -34.5, -33, 6.5];

export const lonToX = (lon: number) => ((lon + 180) * MAP_WIDTH) / 360;
export const latToY = (lat: number) => ((NORTH - lat) * MAP_HEIGHT) / LAT_SPAN;
export const xToLon = (x: number) => (x * 360) / MAP_WIDTH - 180;
export const yToLat = (y: number) => NORTH - (y * LAT_SPAN) / MAP_HEIGHT;

/** SVG viewBox for a lon/lat box, padded by `pad` of its size and at least `minSpan` degrees wide. */
export function viewBoxFor([west, south, east, north]: Bounds, pad = 0.08, minSpan = 16) {
  const grow = (lo: number, hi: number) => {
    const extra = Math.max(0, minSpan - (hi - lo)) / 2;
    return [lo - extra, hi + extra] as const;
  };
  [west, east] = grow(west, east);
  [south, north] = grow(south, north);
  const x0 = lonToX(west);
  const x1 = lonToX(east);
  const y0 = latToY(north);
  const y1 = latToY(south);
  const w = x1 - x0;
  const h = y1 - y0;
  return {
    x: x0 - w * pad,
    y: y0 - h * pad,
    width: w * (1 + 2 * pad),
    height: h * (1 + 2 * pad),
  };
}

/** Size in map units of a cell of `deg` degrees. */
export const cellSize = (deg: number) => ({
  width: (deg * MAP_WIDTH) / 360,
  height: (deg * MAP_HEIGHT) / LAT_SPAN,
});

/** Bounds of a set of points, or null when empty. */
export function boundsOf(points: { lon: number; lat: number }[]): Bounds | null {
  if (!points.length) return null;
  let [w, s, e, n] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const p of points) {
    w = Math.min(w, p.lon);
    e = Math.max(e, p.lon);
    s = Math.min(s, p.lat);
    n = Math.max(n, p.lat);
  }
  return [w, s, e, n];
}
