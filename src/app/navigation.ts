export const pages = [
  { name: "Overview", icon: "grid" },
  { name: "Fire Map", icon: "globe" },
  { name: "Burning Calendar", icon: "calendar" },
  { name: "Historical Analysis", icon: "chart" },
  { name: "Anomaly Alerts", icon: "alert" },
  { name: "Risk Forecast", icon: "chart" },
  { name: "Alert Center", icon: "bell" },
  { name: "Data Sources", icon: "layers" },
  { name: "Settings", icon: "settings" },
] as const;
export type WorkspacePage = (typeof pages)[number]["name"];
export const titles: Record<WorkspacePage, [string, string]> = {
  Overview: [
    "Monitoring Overview",
    "Fire activity in the selected area and period, live fires and the 7-day outlook.",
  ],
  "Fire Map": [
    "Fire Map",
    "Where fire was detected in the selected area and period, and where it burns now.",
  ],
  "Burning Calendar": [
    "Harmonized Fire Activity & Burning Calendar",
    "The seasonal fire signal of an area, day by day, against its normal year since 2000.",
  ],
  "Historical Analysis": [
    "Historical Analysis",
    "MODIS, VIIRS and the harmonized record side by side, and the long-term trend.",
  ],
  "Anomaly Alerts": [
    "Anomaly Alerts",
    "Months with fire activity outside the normal range, for every biome.",
  ],
  "Risk Forecast": [
    "7-Day Fire Forecast",
    "Probability of a VIIRS fire detection per 0.25° cell for the next seven days.",
  ],
  "Alert Center": ["Alert Center", "Advisories issued by the backend."],
  "Data Sources": ["Satellite Data Sources", "Understand the sensors behind the observations."],
  Settings: ["Workspace Settings", "Make OrbitBurn work for your mission."],
};
