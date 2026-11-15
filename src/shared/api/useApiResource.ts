import { useCallback, useEffect, useState } from "react";

export type ApiResource<T> =
  | { status: "idle" | "loading"; data: null; error: null }
  | { status: "success"; data: T; error: null }
  | { status: "error"; data: null; error: Error };

/** Pass a useCallback-stabilized loader; null disables the request.
 * Cancels stale requests and never substitutes demonstration data on failure.
 */
export function useApiResource<T>(load: ((signal: AbortSignal) => Promise<T>) | null) {
  const [resource, setResource] = useState<ApiResource<T>>({
    status: "idle",
    data: null,
    error: null,
  });
  const [revision, setRevision] = useState(0);
  const reload = useCallback(() => setRevision((value) => value + 1), []);

  useEffect(() => {
    if (!load) {
      setResource({ status: "idle", data: null, error: null });
      return;
    }
    const controller = new AbortController();
    setResource({ status: "loading", data: null, error: null });
    Promise.resolve()
      .then(() => load(controller.signal))
      .then(
        (data) => {
          if (!controller.signal.aborted) setResource({ status: "success", data, error: null });
        },
        (error) => {
          if (!controller.signal.aborted) {
            setResource({
              status: "error",
              data: null,
              error: error instanceof Error ? error : new Error(String(error)),
            });
          }
        },
      );
    return () => controller.abort();
  }, [load, revision]);

  return { ...resource, reload };
}
