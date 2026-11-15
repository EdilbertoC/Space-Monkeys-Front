import type { operations } from "../../../shared/api/generated/schema.ts";
import { HttpClient, type RequestOptions } from "../../../shared/api/http.ts";
import type { Schemas } from "../../../shared/api/types.ts";

export function createLiveApi(http: HttpClient) {
  return {
    getFires: (
      query?: operations["getLiveFires"]["parameters"]["query"],
      options?: RequestOptions,
    ) => http.get("/fires/live", query, options),
    getDetections: (
      query?: operations["getRecentDetections"]["parameters"]["query"],
      options?: RequestOptions,
    ) => http.get("/detections/recent", query, options),
  };
}

/** Pure reducer: stable fire_id replaces updated records and removes expired fires. */
export function applyPulse(
  current: Schemas["FireCollection"],
  pulse: Schemas["Pulse"],
): Schemas["FireCollection"] {
  const fires = new Map(current.features.map((feature) => [feature.properties.fire_id, feature]));
  for (const feature of [...pulse.new.features, ...pulse.updated.features])
    fires.set(feature.properties.fire_id, feature);
  for (const id of pulse.removed) fires.delete(id);
  return { type: "FeatureCollection", features: [...fires.values()], updated_at: pulse.at };
}

export interface StreamHandlers {
  snapshot: (data: Schemas["FireCollection"]) => void;
  pulse: (data: Schemas["Pulse"]) => void;
  error?: (error: Event | Error) => void;
  open?: () => void;
}

/** EventSource reconnects automatically; call the returned cleanup on unmount. */
export function subscribeFires(
  http: HttpClient,
  handlers: StreamHandlers,
  createSource = (url: string) => new EventSource(url),
) {
  const source = createSource(http.url("/fires/stream"));
  const parse =
    <T>(handler: (value: T) => void) =>
    (event: MessageEvent<string>) => {
      try {
        handler(JSON.parse(event.data) as T);
      } catch (error) {
        handlers.error?.(error instanceof Error ? error : new Error(String(error)));
      }
    };
  source.addEventListener("snapshot", parse(handlers.snapshot));
  source.addEventListener("pulse", parse(handlers.pulse));
  source.onerror = (event) => handlers.error?.(event);
  source.onopen = () => handlers.open?.();
  return () => source.close();
}
