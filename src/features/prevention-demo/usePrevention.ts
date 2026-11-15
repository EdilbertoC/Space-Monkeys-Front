import { useCallback, useEffect, useState } from "react";
import type { PreventionMode, PreventionResource, ReadStatus } from "./contracts";
import { hasPreventionData } from "./presentation";
import { loadPrevention } from "./source";

export function usePrevention() {
  const [mode, setMode] = useState<PreventionMode>("demonstration");
  const [resource, setResource] = useState<PreventionResource>({ status: "loading" });
  const [revision, setRevision] = useState(0);
  const [readOverrides, setReadOverrides] = useState<Record<string, ReadStatus>>({});
  const [selectedRegionId, setSelectedRegionId] = useState("amazonas");
  const [windowId, setWindowId] = useState("demo-24");
  const [selectedAlertId, setSelectedAlertId] = useState<string | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    setResource({ status: "loading" });
    loadPrevention(mode, controller.signal).then((result) => {
      if (!controller.signal.aborted) setResource(result);
    });
    return () => controller.abort();
  }, [mode, revision]);
  const setDataMode = useCallback((next: PreventionMode) => {
    setResource({ status: "loading" });
    setReadOverrides({});
    setSelectedAlertId(null);
    setMode(next);
  }, []);
  const payload = hasPreventionData(resource) ? resource.data : null;
  const alerts =
    payload?.alerts.map((alert) => ({
      ...alert,
      readStatus: readOverrides[`${mode}:${alert.id}`] ?? alert.readStatus,
    })) ?? [];
  return {
    mode,
    setMode: setDataMode,
    resource,
    payload,
    alerts,
    retry: () => setRevision((v) => v + 1),
    selectedRegionId,
    setSelectedRegionId,
    windowId,
    setWindowId,
    selectedAlertId,
    setSelectedAlertId,
    setRead: (id: string, status: ReadStatus) =>
      setReadOverrides((old) => ({ ...old, [`${mode}:${id}`]: status })),
  };
}
export type PreventionController = ReturnType<typeof usePrevention>;
