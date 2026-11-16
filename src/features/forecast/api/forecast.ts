// SI-assisted: written with Claude (Anthropic), reviewed by the Space Monkeys team. See README.
import type { HttpClient, RequestOptions } from "../../../shared/api/http.ts";
import type { BBox, Biome } from "../../../shared/api/types.ts";

export function createForecastApi(http: HttpClient) {
  return {
    /** Cells reaching `min_p` on any of the next 7 days. 503 until a forecast is issued. */
    getForecast: (query: { min_p?: number; bbox?: BBox } = {}, options?: RequestOptions) =>
      http.get(
        "/forecast",
        {
          ...(query.min_p !== undefined ? { min_p: query.min_p } : {}),
          ...(query.bbox ? { bbox: query.bbox.join(",") } : {}),
        },
        options,
      ),
    getModel: (options?: RequestOptions) => http.get("/forecast/model", undefined, options),
    /** Expected fire cells per biome and Brazil for each of the next 7 days. */
    getSummary: (options?: RequestOptions) => http.get("/forecast/summary", undefined, options),
    /**
     * The 7-day forecast summed over a bbox or a biome, next to the normal for those dates.
     * Forecast units (0.25° VIIRS cells), never comparable with /history fire cell-days.
     */
    getOutlook: (query: { bbox: string } | { biome: Biome }, options?: RequestOptions) =>
      http.get("/forecast/outlook", query, options),
  };
}
