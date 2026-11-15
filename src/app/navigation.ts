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
    "Satellite observations, historical context, and preventive assessment review.",
  ],
  "Fire Map": ["Global Fire Map", "Explore thermal anomalies across the world."],
  "Burning Calendar": [
    "Harmonized Fire Activity & Burning Calendar",
    "Explore the seasonal fire signal across sensors, regions and two decades of historical context.",
  ],
  "Historical Analysis": [
    "Historical Analysis",
    "Put current activity into a longer-term perspective.",
  ],
  "Anomaly Alerts": [
    "Anomaly Alerts",
    "Review unusual observation patterns with historical context and source provenance.",
  ],
  "Risk Forecast": [
    "Fire Risk Forecast",
    "Review supplied regional assessments, forecast validity, and uncertainty.",
  ],
  "Alert Center": [
    "Preventive Alert Center",
    "Review supplied advisories, their rationale, and recommended preventive actions.",
  ],
  "Data Sources": ["Satellite Data Sources", "Understand the sensors behind the observations."],
  Settings: ["Workspace Settings", "Make OrbitBurn work for your mission."],
};
