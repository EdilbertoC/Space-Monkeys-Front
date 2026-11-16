// SI-assisted: written with Claude (Anthropic), reviewed by the Space Monkeys team. See README.
// Keep the last answer on screen while a new one loads, so changing a period does not blank
// a map or a chart. Shared by every page that draws a map.
import { useEffect, useState } from "react";
import type { ApiResource } from "./useApiResource";

/**
 * The resource's data, or the last data it had for the same `scope` while it reloads.
 * `refreshing` is true while stale data is shown. A new scope (another area) starts empty.
 */
export function useKeep<T>(res: ApiResource<T>, scope: string) {
  const [last, setLast] = useState<{ scope: string; data: T } | null>(null);
  useEffect(() => {
    if (res.status === "success") setLast({ scope, data: res.data });
  }, [res.status, res.data, scope]);
  if (res.status === "success") return { data: res.data, refreshing: false };
  const stale = res.status === "loading" && last?.scope === scope ? last.data : null;
  return { data: stale, refreshing: stale !== null };
}
