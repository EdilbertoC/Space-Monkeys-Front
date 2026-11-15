import { HttpClient, type RequestOptions } from "../../../shared/api/http.ts";

export function createSystemApi(http: HttpClient) {
  return {
    getHealth: (options?: RequestOptions) => http.get("/health", undefined, options),
    getStatus: (options?: RequestOptions) => http.get("/status", undefined, options),
  };
}
