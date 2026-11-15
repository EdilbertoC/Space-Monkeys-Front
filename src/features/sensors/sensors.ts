export const SENSOR_IDS = ["MODIS", "VIIRS", "SENTINEL3_SLSTR", "GOES_ABI"] as const;
export type SensorId = (typeof SENSOR_IDS)[number];
export type SensorSelection = SensorId | "ALL" | "All" | "Harmonized";
export const SENSOR_METADATA = {
  MODIS: {
    label: "MODIS",
    group: "MODIS",
    instrument: "MODIS",
    satellites: "Terra / Aqua",
    resolution: "≈1 km",
    orbit: "Polar-orbiting",
    coverage: "Global overpass coverage; clouds, overpass timing and quality screening create gaps",
    role: "Historical record: the reference series (MODIS units) since 2000",
    cadence: "Overpass-based; varies by platform and latitude",
    algorithm:
      "MODIS Collection 6.1 active fire product (FIRMS); low-confidence detections and static sources removed",
    format: "Product-specific MODIS fields; preserve original confidence and acquisition metadata",
    integration:
      "Connected: FIRMS standard archive in the historical record, FIRMS NRT for recent days",
    availability: "2000-11-01 to the last processed day (see Data sources in use)",
    color: "#e8b65f",
    tier: "core",
  },
  VIIRS: {
    label: "VIIRS",
    group: "VIIRS",
    instrument: "VIIRS",
    satellites: "Suomi-NPP / NOAA-20 / NOAA-21",
    resolution: "≈375 m",
    orbit: "Polar-orbiting",
    coverage:
      "Global overpass coverage; platform availability and valid observations vary with time",
    role: "Sees small fires MODIS misses; carries the record forward in MODIS-equivalent units",
    cadence: "Overpass-based; varies by platform and latitude",
    algorithm:
      "VIIRS 375 m active fire product (FIRMS); low-confidence detections and static sources removed",
    format: "Product-specific VIIRS fields; retain native confidence categories",
    integration:
      "Connected: FIRMS standard archive and NRT; input of the harmonization and the forecast",
    availability:
      "2012-01-20 (S-NPP) to the last processed day; NOAA-20 from 2018, NOAA-21 from 2023",
    color: "#ff8053",
    tier: "core",
  },
  SENTINEL3_SLSTR: {
    label: "Sentinel-3 SLSTR",
    group: "Sentinel-3",
    instrument: "SLSTR",
    satellites: "Sentinel-3A / Sentinel-3B",
    resolution: "≈1 km thermal",
    orbit: "Polar-orbiting",
    coverage: "Global overpass capability; no SLSTR observations are loaded in this workspace",
    role: "Active fire detection and Fire Radiative Power (FRP)",
    cadence: "Overpass-based; not continuous monitoring",
    algorithm: "SLSTR fire/FRP algorithms and product-specific quality flags",
    format: "Native SLSTR product structure and quality attributes require a dedicated adapter",
    integration: "Not used",
    availability: "Not loaded",
    color: "#73b9c2",
    tier: "extended",
  },
  GOES_ABI: {
    label: "GOES ABI",
    group: "GOES",
    instrument: "ABI",
    satellites: "GOES-East / GOES-West",
    resolution: "≈2 km at the subsatellite point for relevant fire observations",
    orbit: "Geostationary",
    coverage: "Americas and adjacent oceans within the GOES-East view; not global",
    role: "High-frequency fire monitoring and rapid observation of changing fire activity",
    cadence: "Frequent scans; cadence depends on sector and product",
    algorithm: "ABI fire algorithms; native mask and quality flags",
    format:
      "ABI product structure, scan metadata and confidence attributes need separate interpretation",
    integration:
      "Connected to the real-time layer only (GOES-19 fire product); not in the historical record",
    availability: "Live window only",
    color: "#b6a1cd",
    tier: "extended",
  },
} as const;
export const hasDemoData = (selection: SensorSelection) =>
  selection === "ALL" || selection === "All" || selection === "MODIS" || selection === "VIIRS";
export const isAllSensors = (selection: SensorSelection) =>
  selection === "ALL" || selection === "All";
export const matchesSensor = (selection: SensorSelection, sensor: string) =>
  isAllSensors(selection) || selection === sensor;
export const sensorLabel = (selection: SensorSelection) =>
  isAllSensors(selection)
    ? "All Sensors"
    : selection === "Harmonized"
      ? "Harmonized"
      : SENSOR_METADATA[selection as SensorId].label;
export const unavailableMessage = (selection: SensorSelection) =>
  selection === "Harmonized"
    ? "Harmonized output has not been implemented or scientifically validated."
    : `${sensorLabel(selection)} integration is planned, not connected. No observations are available; this is not zero detected activity.`;

export type SensorObservation = {
  id: string;
  sensor: SensorId;
  observedAt: string | null;
  satellite: string | null;
  confidence: string | number | null;
  illustrative: boolean;
  original: unknown;
};
