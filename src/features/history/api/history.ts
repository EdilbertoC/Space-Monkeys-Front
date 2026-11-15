import { ApiError, HttpClient, type RequestOptions } from "../../../shared/api/http.ts";
import type {
  AnomalyQuery,
  AnomalyScanQuery,
  AreaSelector,
  BBox,
  CalendarQuery,
  ClimatologyQuery,
  MapQuery,
  Schemas,
  SeasonQuery,
  Series,
  TrendQuery,
} from "../../../shared/api/types.ts";

export function bboxSelector(bbox: BBox): AreaSelector {
  const [west, south, east, north] = bbox;
  if (
    bbox.length !== 4 ||
    !bbox.every(Number.isFinite) ||
    west < -180 ||
    east > 180 ||
    south < -90 ||
    north > 90 ||
    west >= east ||
    south >= north
  ) {
    throw new Error("Invalid WGS84 bounding box: expected west,south,east,north");
  }
  return { bbox: bbox.join(",") };
}

function validateQuery(query: AreaSelector & { start?: string; end?: string }) {
  const selectors = [query.bbox, query.biome, query.area_id, query.country].filter(
    (value) => value !== undefined,
  );
  if (selectors.length !== 1 || !selectors[0]?.trim())
    throw new Error("Give exactly one of bbox, biome, area_id, country");
  if (query.bbox !== undefined) {
    if (!/^-?\d+(\.\d+)?(,-?\d+(\.\d+)?){3}$/.test(query.bbox))
      throw new Error("Invalid bbox format");
    bboxSelector(query.bbox.split(",").map(Number) as BBox);
  }
  for (const value of [query.start, query.end]) {
    if (
      value !== undefined &&
      (!/^\d{4}-\d{2}-\d{2}$/.test(value) ||
        !Number.isFinite(Date.parse(value)) ||
        new Date(value).toISOString().slice(0, 10) !== value)
    ) {
      throw new Error("Expected a valid ISO UTC date");
    }
  }
  if (query.start && query.end && query.start > query.end)
    throw new Error("Start must be on or before end");
}

export interface SeriesResult<T> {
  data: T;
  requestedSeries: Series;
  effectiveSeries: Series;
  fallback: boolean;
}

/** Fallback is explicit and only applies to a harmonized request receiving 409. */
async function withSeries<T>(
  requested: Series | undefined,
  load: (series: Series) => Promise<T>,
): Promise<SeriesResult<T>> {
  const requestedSeries = requested ?? "harmonized";
  try {
    return {
      data: await load(requestedSeries),
      requestedSeries,
      effectiveSeries: requestedSeries,
      fallback: false,
    };
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 409 || requestedSeries !== "harmonized")
      throw error;
    return { data: await load("modis"), requestedSeries, effectiveSeries: "modis", fallback: true };
  }
}

export function createHistoryApi(http: HttpClient) {
  return {
    getMeta: (options?: RequestOptions) => http.get("/history/meta", undefined, options),
    createArea: (body: Schemas["AreaRequest"], options?: RequestOptions) =>
      http.postArea(body, options),
    getCalendar(query: CalendarQuery, options?: RequestOptions) {
      validateQuery(query);
      return http.get("/history/calendar", query, options);
    },
    getClimatology(query: ClimatologyQuery, options?: RequestOptions) {
      validateQuery(query);
      return withSeries(query.series, (series) =>
        http.get("/history/climatology", { ...query, series }, options),
      );
    },
    getAnomaly(query: AnomalyQuery, options?: RequestOptions) {
      validateQuery(query);
      return withSeries(query.series, (series) =>
        http.get("/history/anomaly", { ...query, series }, options),
      );
    },
    getSeason(query: SeasonQuery, options?: RequestOptions) {
      validateQuery(query);
      return withSeries(query.series, (series) =>
        http.get("/history/season", { ...query, series }, options),
      );
    },
    getTrend(query: TrendQuery, options?: RequestOptions) {
      validateQuery(query);
      return withSeries(query.series, (series) =>
        http.get("/history/trend", { ...query, series }, options),
      );
    },
    getMap(query: MapQuery, options?: RequestOptions) {
      validateQuery(query);
      return http.get("/history/map", query, options);
    },
    /** Every month of a year against normal, for every biome (and Brazil), in one call. */
    getAnomalyScan(query: AnomalyScanQuery, options?: RequestOptions) {
      return withSeries(query.series, (series) =>
        http.get("/history/anomalies", { ...query, series }, options),
      );
    },
  };
}

/** Never sum MODIS and VIIRS or coerce missing observations to zero. */
export function calendarValue(bucket: Schemas["CalendarBucket"], series: Series): number | null {
  return series === "harmonized" ? (bucket.harmonized?.value ?? null) : bucket[series];
}
