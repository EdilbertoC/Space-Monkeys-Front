// SI-assisted: written with Claude (Anthropic), reviewed by the Space Monkeys team. See README.
// Pages, grouped by what feeds them. `name` is the key used in code and in the URL
// (?view=); `label` is what people read in the menu.
export const pages = [
  { name: "Burning Calendar", label: "Burning calendar", icon: "calendar", group: "record" },
  { name: "Territory", label: "Trend in an area", icon: "target", group: "record" },
  { name: "Anomaly Alerts", label: "Unusual months", icon: "alert", group: "record" },
  { name: "Historical Analysis", label: "MODIS vs VIIRS", icon: "chart", group: "record" },
  { name: "Risk Forecast", label: "7-day forecast", icon: "chart", group: "forecast" },
  { name: "Overview", label: "Fires now", icon: "globe", group: "live" },
  { name: "Data Sources", label: "About the data", icon: "layers", group: "data" },
  { name: "Settings", label: "Settings", icon: "settings", group: "data" },
] as const;

export type WorkspacePage = (typeof pages)[number]["name"];

// Pages that run on our models come first. `tag` names what feeds the group: the harmonized
// record (VIIRS calibrated to MODIS units), the forecast model, or raw detections.
export const groups = [
  { id: "record", label: "2000 to today", tag: "Harmonized", tone: "record" },
  { id: "forecast", label: "Next 7 days", tag: "Forecast model", tone: "forecast" },
  { id: "live", label: "Live detections", tag: "Not harmonized", tone: "plain" },
  { id: "data", label: "Reference", tag: null, tone: null },
] as const;

export const labelOf = (page: WorkspacePage): string =>
  pages.find((p) => p.name === page)?.label ?? page;

export const titles: Record<WorkspacePage, [string, string]> = {
  Territory: [
    "Is fire rising or falling here?",
    "Fire cell-days per year since 2003, in the area you pick or draw.",
  ],
  "Burning Calendar": [
    "When does this area burn?",
    "Fire cell-days day by day for one year, against the area's normal year.",
  ],
  "Anomaly Alerts": [
    "Which months were unusual?",
    "Each month of a year against the same month in the base years, for every biome and for Brazil.",
  ],
  "Historical Analysis": [
    "How the two sensors compare",
    "MODIS, VIIRS and the harmonized record year by year. Raw VIIRS jumps when a satellite is added; the harmonized record does not.",
  ],
  Overview: [
    "Where is it burning now?",
    "What VIIRS detects in the area you pick, from its latest passes. Only VIIRS: no MODIS, no GOES.",
  ],
  "Risk Forecast": [
    "Where fire is likely next week",
    "Probability of at least one VIIRS detection per 0.25° cell for each of the next 7 days. A model prediction, not an observation.",
  ],
  "Data Sources": [
    "Where the numbers come from",
    "The satellites, the archives they come from, and how MODIS and VIIRS become one record.",
  ],
  Settings: ["Settings", "Workspace preferences for this session."],
};
