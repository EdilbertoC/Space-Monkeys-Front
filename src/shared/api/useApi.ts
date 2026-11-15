// SI-assisted: written with Claude (Anthropic), reviewed by the Space Monkeys team. See README.
import { useMemo } from "react";
import { useApiResource } from "./useApiResource";

/** useApiResource with the loader memoised on `deps`; pass null to disable the request. */
export function useApi<T>(
  load: ((signal: AbortSignal) => Promise<T>) | null,
  deps: readonly unknown[],
) {
  // eslint-disable-next-line react-hooks/exhaustive-deps -- deps are supplied by the caller
  const loader = useMemo(() => load, deps);
  return useApiResource(loader);
}
