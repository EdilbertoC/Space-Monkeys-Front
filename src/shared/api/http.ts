import type { paths } from "./generated/schema.ts";

type JsonPath = Exclude<keyof paths, "/fires/stream" | "/history/areas">;
type GetOperation<P extends JsonPath> = paths[P]["get"];
type Query<P extends JsonPath> = GetOperation<P>["parameters"]["query"];
type Response<P extends JsonPath> =
  GetOperation<P>["responses"][200]["content"]["application/json"];
type Fetch = typeof globalThis.fetch;

export class ApiError extends Error {
  readonly status: number;
  readonly detail: unknown;

  constructor(status: number, detail: unknown) {
    super(typeof detail === "string" ? detail : `API request failed (${status})`);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }
}

export interface RequestOptions {
  signal?: AbortSignal;
}

/** HTTP transport only. Domain rules belong to the feature services. */
export class HttpClient {
  readonly baseUrl: string;
  private readonly fetcher: Fetch;
  private readonly timeoutMs: number;

  constructor(baseUrl: string, options: { fetch?: Fetch; timeoutMs?: number } = {}) {
    this.baseUrl = baseUrl.trim().replace(/\/+$/, "");
    if (!/^https?:\/\//.test(this.baseUrl)) throw new Error("API URL must use http:// or https://");
    this.fetcher = options.fetch ?? globalThis.fetch.bind(globalThis);
    this.timeoutMs = options.timeoutMs ?? 15000;
  }

  url(path: string, query?: object): string {
    const url = new URL(this.baseUrl + path);
    for (const [key, value] of Object.entries(query ?? {})) {
      if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
    }
    return url.toString();
  }

  get<P extends JsonPath>(
    path: P,
    query?: Query<P>,
    options: RequestOptions = {},
  ): Promise<Response<P>> {
    return this.request(this.url(path, query), { method: "GET", signal: options.signal });
  }

  postArea(body: import("./types.ts").Schemas["AreaRequest"], options: RequestOptions = {}) {
    return this.request<import("./types.ts").Schemas["Area"]>(this.url("/history/areas"), {
      method: "POST",
      body: JSON.stringify(body),
      signal: options.signal,
    });
  }

  private async request<T>(url: string, init: RequestInit): Promise<T> {
    const timeout = new AbortController();
    const timer = setTimeout(
      () => timeout.abort(new DOMException("API request timed out", "TimeoutError")),
      this.timeoutMs,
    );
    const signal = init.signal ? AbortSignal.any([init.signal, timeout.signal]) : timeout.signal;
    try {
      const response = await this.fetcher(url, {
        ...init,
        signal,
        headers: {
          Accept: "application/json",
          ...(init.body ? { "Content-Type": "application/json" } : {}),
        },
      });
      const text = await response.text();
      let payload: unknown;
      try {
        payload = JSON.parse(text);
      } catch {
        if (!response.ok) throw new ApiError(response.status, response.statusText);
        throw new ApiError(response.status, "API returned invalid JSON");
      }
      if (!response.ok) {
        const detail =
          payload && typeof payload === "object" && "detail" in payload ? payload.detail : payload;
        throw new ApiError(response.status, detail);
      }
      return payload as T;
    } finally {
      clearTimeout(timer);
    }
  }
}
