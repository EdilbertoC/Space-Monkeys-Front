import {
  createContext,
  useContext,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import SelectControl from "../../shared/ui/SelectControl";
import { Icon } from "../../shared/ui/ui";
import {
  hasDemoData,
  SENSOR_IDS,
  SENSOR_METADATA,
  unavailableMessage,
  type SensorId,
  type SensorSelection,
} from "./sensors";
import "./sensors.css";

const defaultLayers: Record<SensorId, boolean> = {
  MODIS: true,
  VIIRS: true,
  SENTINEL3_SLSTR: false,
  GOES_ABI: false,
};
const SensorLayersContext = createContext<{
  sensors: Record<SensorId, boolean>;
  setSensors: Dispatch<SetStateAction<Record<SensorId, boolean>>>;
} | null>(null);
export function SensorLayersProvider({ children }: { children: ReactNode }) {
  const [sensors, setSensors] = useState(defaultLayers);
  return (
    <SensorLayersContext.Provider value={{ sensors, setSensors }}>
      {children}
    </SensorLayersContext.Provider>
  );
}
export function useSensorLayers() {
  const layers = useContext(SensorLayersContext);
  if (!layers) throw new Error("Map layers require SensorLayersProvider");
  return layers;
}

export function SensorFilter({
  value,
  onChange,
  harmonized = false,
}: {
  value: SensorSelection;
  onChange: (value: SensorSelection) => void;
  harmonized?: boolean;
}) {
  return (
    <SelectControl
      label="Satellite sensor"
      icon="satellite"
      value={value === "All" ? "ALL" : value}
      onChange={(v) => onChange(v as SensorSelection)}
    >
      <option value="ALL">All Sensors</option>
      {SENSOR_IDS.map((id) => (
        <option key={id} value={id}>
          {SENSOR_METADATA[id].label}
        </option>
      ))}
      {harmonized && <option value="Harmonized">Harmonized · unavailable</option>}
    </SelectControl>
  );
}
export function SensorUnavailable({ selection }: { selection: SensorSelection }) {
  if (hasDemoData(selection)) return null;
  return (
    <div className="sensor-unavailable" role="status">
      <Icon name="info" size={16} />
      <span>
        {unavailableMessage(selection)} Original MODIS and VIIRS demo records remain available
        through their filters.
      </span>
    </div>
  );
}
export function SensorDot({ sensor }: { sensor: (typeof SENSOR_IDS)[number] }) {
  return <span className={`sensor-color sensor-${sensor}`} aria-hidden="true" />;
}
