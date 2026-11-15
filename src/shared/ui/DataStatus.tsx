import { Icon } from "./ui";
export default function DataStatus() {
  return (
    <details className="workspace-data-status">
      <summary>
        <Icon name="info" size={14} />
        <span>Observation data: research preview</span>
        <small>Live NASA feeds not connected</small>
        <Icon name="chevron" size={13} />
      </summary>
      <p>
        MODIS and VIIRS observations and historical baselines are synthetic fixtures. HFI, FRP,
        regime and priority-AOI cards are fixed design scenarios, not validated scientific
        measurements or operational warnings. Sentinel-3 SLSTR and GOES ABI remain unavailable. Map
        geometry is schematic; no validated clipping or sensor calibration is connected. Forecast
        and advisory status is shown separately in its own data-mode controls.
      </p>
    </details>
  );
}
