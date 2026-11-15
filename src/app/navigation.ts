// SI-assisted: written with Claude (Anthropic), reviewed by the Space Monkeys team. See README.
// Pages, grouped by the question they answer. `name` is the key used in code and in the URL
// (?view=); `label` is what people read in the menu.
export const pages = [
  { name: "Territory", label: "Trend in an area", icon: "target", group: "record" },
  { name: "Burning Calendar", label: "Burning calendar", icon: "calendar", group: "record" },
  { name: "Anomaly Alerts", label: "Unusual months", icon: "alert", group: "record" },
  { name: "Historical Analysis", label: "MODIS vs VIIRS", icon: "chart", group: "record" },
  { name: "Overview", label: "Period summary", icon: "grid", group: "now" },
  { name: "Fire Map", label: "Fire map", icon: "globe", group: "now" },
  { name: "Risk Forecast", label: "7-day forecast", icon: "chart", group: "now" },
  { name: "Data Sources", label: "About the data", icon: "layers", group: "data" },
  { name: "Settings", label: "Settings", icon: "settings", group: "data" },
] as const;

export type WorkspacePage = (typeof pages)[number]["name"];

export const groups = [
  { id: "record", label: "The record, 2000 to today" },
  { id: "now", label: "Now and next week" },
  { id: "data", label: "Reference" },
] as const;

export const labelOf = (page: WorkspacePage): string =>
  pages.find((p) => p.name === page)?.label ?? page;

export const titles: Record<WorkspacePage, [string, string]> = {
  Territory: [
    "Is fire rising or falling here?",
    "Fire cell-days per year since 2003, the long-term trend, and how two periods compare. Pick or draw the area on the map.",
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
    "The selected period at a glance",
    "Fire activity in the area and dates you pick, fires burning now, and the outlook for the next 7 days.",
  ],
  "Fire Map": [
    "Where it burned",
    "Fire cell-days per 0.1° cell in the selected dates, with the fires detected in the last 48 hours.",
  ],
  "Risk Forecast": [
    "Where fire is likely next week",
    "Probability of at least one VIIRS detection per 0.25° cell for each of the next 7 days. A model prediction, not an observation.",
  ],
  "Data Sources": [
    "Where the numbers come from",
    "The satellites, the archives they come from, and how MODIS and VIIRS become one record.",
  ],
  Settings: ["Settings", "The default dates used by Period summary, Fire map and MODIS vs VIIRS."],
};
