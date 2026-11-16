import { createForecastApi } from "../features/forecast/api/forecast.ts";
import { createHistoryApi } from "../features/history/api/history.ts";
import { createLiveApi } from "../features/live/api/live.ts";
import { createSystemApi } from "../features/system/api/system.ts";
import { HttpClient } from "../shared/api/http.ts";
/** Composition root. Import feature factories in unit tests to inject a transport. */
const BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";
export const http = new HttpClient(BASE_URL);
export const historyApi = createHistoryApi(http);
/**
 * Same routes with a 60 s timeout, for the one request per area that Fires now makes to learn
 * the area's cells: all of Brazil takes several seconds, more when the server is busy.
 */
export const slowHistoryApi = createHistoryApi(new HttpClient(BASE_URL, { timeoutMs: 60_000 }));
export const liveApi = createLiveApi(http);
export const systemApi = createSystemApi(http);
export const forecastApi = createForecastApi(http);
