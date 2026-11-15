import { createForecastApi } from "../features/forecast/api/forecast.ts";
import { createHistoryApi } from "../features/history/api/history.ts";
import { createLiveApi } from "../features/live/api/live.ts";
import { createSystemApi } from "../features/system/api/system.ts";
import { HttpClient } from "../shared/api/http.ts";
/** Composition root. Import feature factories in unit tests to inject a transport. */
export const http = new HttpClient(import.meta.env.VITE_API_BASE_URL || "http://localhost:8000");
export const historyApi = createHistoryApi(http);
export const liveApi = createLiveApi(http);
export const systemApi = createSystemApi(http);
export const forecastApi = createForecastApi(http);
