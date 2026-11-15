import { preventionIntegration } from "./config.ts";
import type { PreventionAdapter, PreventionMode, PreventionResource } from "./contracts.ts";
import { hasPreventionData, validPayload } from "./presentation.ts";

/** Retrieval boundary only: no HTTP routes are guessed and no backend services are created. */
export async function loadPrevention(
  mode: PreventionMode,
  signal: AbortSignal,
  adapter: PreventionAdapter | null = preventionIntegration.adapter,
): Promise<PreventionResource> {
  if (mode === "demonstration") {
    const { preventionDemo } = await import("./demo.ts");
    return { status: "demonstration", data: preventionDemo };
  }
  if (!adapter)
    return {
      status: "unavailable",
      message:
        "No prevention API adapter is configured. No forecasts or alerts have been requested.",
    };
  try {
    const result = await adapter.load(signal);
    if (signal.aborted) return { status: "loading" };
    if (hasPreventionData(result)) {
      if (!validPayload(result.data))
        return {
          status: "error",
          message:
            "The supplied prevention response does not match the provisional UI contract. No risk values are displayed.",
        };
      // Demonstration provenance can never silently become a production result.
      return {
        ...result,
        status: result.data.provenance === "demonstration" ? "demonstration" : result.status,
      };
    }
    if (!["loading", "empty", "insufficient", "unavailable", "error"].includes(result.status))
      return {
        status: "error",
        message: "Unsupported data state returned by the prevention adapter.",
      };
    return result;
  } catch {
    if (signal.aborted) return { status: "loading" };
    return {
      status: "error",
      message:
        "Unable to read the prevention response. Check the configured frontend adapter and try again. No risk values are substituted.",
    };
  }
}
